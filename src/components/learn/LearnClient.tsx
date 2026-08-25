'use client';

/**
 * 배우기. 오늘 처음 만나는 개념을 읽고 이해하는 단계다.
 *
 * 드릴과 일부러 다르게 만들었다. 여기서는 답을 가리지 않는다 —
 * 모르는 것을 맞히라고 하면 배우는 게 아니라 틀리는 경험만 남는다.
 * 읽고 '이해했다'를 누르면 그 카드는 내일부터 복습 큐에 들어간다.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Collapsible } from '@/components/Collapsible';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import { DIFFICULTY_LABELS, TOPICS } from '@/lib/config';
import { countDoneToday, getAllStates, recordReview } from '@/lib/db';
import { buildTodayQueue } from '@/lib/queue';
import type { Question } from '@/lib/schema';
import { initialState, schedule } from '@/lib/srs';

type Phase = 'loading' | 'learning' | 'done' | 'empty';

export function LearnClient({ questions: base, today }: { questions: Question[]; today: string }) {
  const { questions, ready } = useMergedQuestions(base);
  const [phase, setPhase] = useState<Phase>('loading');
  const [cards, setCards] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [learned, setLearned] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const [states, done] = await Promise.all([getAllStates(), countDoneToday(today)]);
        if (cancelled) return;
        const queue = buildTodayQueue(questions, states, today, {
          newDoneToday: done.newDone,
          reviewDoneToday: done.reviewDone,
        });
        setCards(queue.fresh);
        setPhase(queue.fresh.length === 0 ? 'empty' : 'learning');
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
  }, [ready, questions, today]);

  const card = index < cards.length ? cards[index] : null;

  const advance = useCallback(() => {
    setIndex((i) => {
      const next = i + 1;
      if (next >= cards.length) setPhase('done');
      return next;
    });
  }, [cards.length]);

  /** 이해했다 — 첫 학습을 기록하고 내일 복습 대상으로 만든다. */
  const understand = useCallback(() => {
    if (!card) return;
    const prev = initialState(card.id, today);
    const next = schedule(prev, 3, today);
    void recordReview({
      next,
      prev,
      grade: 3,
      msSpent: 0,
      reviewedAt: Date.now(),
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    setLearned((n) => n + 1);
    advance();
  }, [card, today, advance]);

  // 키보드: Enter 로 다음. 한 손으로 넘기며 읽을 수 있어야 한다.
  useEffect(() => {
    if (phase !== 'learning') return;
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return;
      if (e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        understand();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, understand]);

  const progress = useMemo(
    () => (cards.length === 0 ? 0 : (index / cards.length) * 100),
    [index, cards.length],
  );

  if (phase === 'loading') {
    return <p className="t-caption py-24 text-center">불러오는 중…</p>;
  }

  if (phase === 'empty') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <div className="text-4xl">✓</div>
        <h1 className="t-title mt-4">오늘 배울 것을 다 봤다</h1>
        <p className="t-caption mt-2">
          {error ? `기록을 못 읽었다: ${error}` : '내일 새 카드가 다시 열린다.'}
        </p>
        <Link href="/drill" className="btn btn-primary mt-8">익히러 가기</Link>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center enter">
        <div className="text-4xl">🌱</div>
        <h1 className="t-display mt-4">{learned}개를 배웠다</h1>
        <p className="t-caption mt-2">내일 이 카드들이 복습으로 돌아온다.</p>
        <div className="mt-8 flex justify-center gap-2">
          <Link href="/" className="btn btn-secondary">오늘로</Link>
          <Link href="/drill" className="btn btn-primary">익히러 가기</Link>
        </div>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="t-caption mb-1.5 flex justify-between">
            <span className="t-num">{index + 1} / {cards.length}</span>
            <span>배우는 중</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Link href="/" aria-label="닫기" className="btn btn-ghost !px-2.5 text-lg leading-none">✕</Link>
      </div>

      {/* key 를 주어 카드가 바뀔 때마다 등장 모션이 다시 돈다. */}
      <article key={card.id} className="card enter p-6">
        <div className="t-caption mb-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{TOPICS[card.topic]}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{DIFFICULTY_LABELS[card.difficulty]}</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">새 개념</span>
        </div>

        <h1 className="t-title">{card.question}</h1>
        <p className="t-body mt-4">{card.answerShort}</p>

        {card.keywords.length > 0 && (
          <div className="mt-5">
            <div className="t-caption mb-2">이 말들로 설명할 수 있으면 된다</div>
            <div className="flex flex-wrap gap-1.5">
              {card.keywords.map((k, i) => (
                <span key={`${i}-${k}`} className="chip">{k}</span>
              ))}
            </div>
          </div>
        )}

        {card.answerDeep && (
          <div className="mt-5">
            <Collapsible title="더 깊이">
              <p className="t-body">{card.answerDeep}</p>
            </Collapsible>
          </div>
        )}

        {card.refs && card.refs.length > 0 && (
          <ul className="mt-4 space-y-1">
            {card.refs.map((ref) => (
              <li key={ref.url}>
                <a href={ref.url} target="_blank" rel="noreferrer"
                  className="t-caption text-accent underline underline-offset-2">
                  {ref.title} ↗
                </a>
              </li>
            ))}
          </ul>
        )}
      </article>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={advance} className="btn btn-secondary flex-1">
          나중에
        </button>
        <button type="button" onClick={understand} className="btn btn-primary flex-[2]">
          이해했다
        </button>
      </div>
      <p className="t-caption mt-3 text-center">Enter 로 넘어간다</p>
    </div>
  );
}
