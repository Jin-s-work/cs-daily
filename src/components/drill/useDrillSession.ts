'use client';

/**
 * 드릴 세션의 상태 기계.
 *
 * 화면(어떻게 보이나)과 채점(무엇이 맞나)을 갈라 놓으려고 훅으로 뺐다.
 * 채점 규칙 자체는 srs.ts 에 있고 여기서는 부르기만 한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { countDoneToday, getAllStates, recordReview, undoLastReview } from '@/lib/db';
import { buildTodayQueue } from '@/lib/queue';
import { initialState, preview, schedule, type Grade, type ReviewState } from '@/lib/srs';
import type { Question } from '@/lib/schema';

/** Again 을 눌러도 한 세션에 이만큼까지만 다시 꺼낸다. 무한 반복을 막는다. */
const MAX_AGAIN_REPEATS = 2;

interface HistoryEntry {
  /** 평가한 시점의 큐 위치. undo 하면 여기로 돌아간다. */
  index: number;
  qid: string;
  grade: Grade;
  /** 이 평가 때문에 카드를 큐 끝에 다시 넣었는지. undo 하면 그것도 빼야 한다. */
  requeued: boolean;
}

export type SessionPhase = 'loading' | 'running' | 'done' | 'empty';

export interface DrillSession {
  phase: SessionPhase;
  card: Question | null;
  flipped: boolean;
  index: number;
  total: number;
  intervals: Record<Grade, number> | null;
  canUndo: boolean;
  reviewedCount: number;
  correctCount: number;
  elapsedMs: number;
  /** 세션 한정 메모. 저장하지 않는다. */
  note: string;
  setNote: (v: string) => void;
  flip: () => void;
  grade: (g: Grade) => void;
  undo: () => void;
  error: string | null;
}

export function useDrillSession(questions: Question[], today: string): DrillSession {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [cards, setCards] = useState<Question[]>([]);
  const [states, setStates] = useState<Map<string, ReviewState>>(new Map());
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [againCount, setAgainCount] = useState<Map<string, number>>(new Map());
  const [reviewedCount, setReviewedCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startedAt = useRef<number>(0);
  const cardShownAt = useRef<number>(0);

  // 최초 1회: IndexedDB 에서 상태를 읽어 오늘 큐를 만든다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stored, done] = await Promise.all([getAllStates(), countDoneToday(today)]);
        if (cancelled) return;
        const queue = buildTodayQueue(questions, stored, today, {
          newDoneToday: done.newDone,
          reviewDoneToday: done.reviewDone,
        });
        // 드릴은 이미 배운 카드만 다룬다. 처음 보는 개념은 배우기 화면의 몫이다.
        setStates(new Map(stored.map((s) => [s.qid, s])));
        setCards(queue.review);
        startedAt.current = Date.now();
        cardShownAt.current = Date.now();
        setPhase(queue.cards.length === 0 ? 'empty' : 'running');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setPhase('empty');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, today]);

  // 경과 시간. 완료 화면에서 쓰므로 1초마다면 충분하다.
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const card = index < cards.length ? cards[index] : null;

  const currentState = useMemo(
    () => (card ? (states.get(card.id) ?? initialState(card.id, today)) : null),
    [card, states, today],
  );

  const intervals = useMemo(
    () => (currentState ? preview(currentState, today) : null),
    [currentState, today],
  );

  const advance = useCallback((nextCards: Question[], nextIndex: number) => {
    setFlipped(false);
    setNote('');
    cardShownAt.current = Date.now();
    if (nextIndex >= nextCards.length) {
      setPhase('done');
      setElapsedMs(Date.now() - startedAt.current);
    }
    setIndex(nextIndex);
  }, []);

  const flip = useCallback(() => setFlipped((v) => !v), []);

  const grade = useCallback(
    (g: Grade) => {
      if (phase !== 'running' || !card || !currentState) return;

      const next = schedule(currentState, g, today);
      const reviewedAt = Date.now();
      const msSpent = reviewedAt - cardShownAt.current;

      // 저장은 비동기지만 화면은 기다리지 않는다. 실패하면 배너로 알린다.
      void recordReview({ next, prev: currentState, grade: g, msSpent, reviewedAt }).catch((e) =>
        setError(e instanceof Error ? e.message : String(e)),
      );

      setStates((prev) => new Map(prev).set(card.id, next));
      setReviewedCount((n) => n + 1);
      if (g >= 2) setCorrectCount((n) => n + 1);

      // Again 이면 세션 끝에 다시 세운다. 단 카드당 MAX_AGAIN_REPEATS 회까지.
      const seen = againCount.get(card.id) ?? 0;
      const requeued = g === 1 && seen < MAX_AGAIN_REPEATS;
      const nextCards = requeued ? [...cards, card] : cards;
      if (requeued) {
        setCards(nextCards);
        setAgainCount((prev) => new Map(prev).set(card.id, seen + 1));
      }

      setHistory((h) => [...h, { index, qid: card.id, grade: g, requeued }]);
      advance(nextCards, index + 1);
    },
    [phase, card, currentState, today, againCount, cards, index, advance],
  );

  const undo = useCallback(() => {
    const last = history[history.length - 1];
    if (!last) return;

    void (async () => {
      try {
        const log = await undoLastReview();
        setStates((prev) => {
          const copy = new Map(prev);
          if (log) {
            const wasNew =
              log.prev.reps === 0 && log.prev.interval === 0 && log.prev.lapses === 0;
            if (wasNew) copy.delete(log.qid);
            else copy.set(log.qid, log.prev);
          }
          return copy;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    // 되돌리면서 다시 세워 뒀던 카드도 걷어낸다.
    const restored = last.requeued ? cards.slice(0, -1) : cards;
    if (last.requeued) setCards(restored);

    setHistory((h) => h.slice(0, -1));
    setReviewedCount((n) => Math.max(0, n - 1));
    if (last.grade >= 2) setCorrectCount((n) => Math.max(0, n - 1));
    setPhase('running');
    setFlipped(false);
    setNote('');
    cardShownAt.current = Date.now();
    setIndex(last.index);
  }, [history, cards]);

  return {
    phase,
    card,
    flipped,
    index,
    total: cards.length,
    intervals,
    canUndo: history.length > 0,
    reviewedCount,
    correctCount,
    elapsedMs,
    note,
    setNote,
    flip,
    grade,
    undo,
    error,
  };
}
