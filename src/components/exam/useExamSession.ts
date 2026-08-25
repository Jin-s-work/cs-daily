'use client';

/**
 * 시험 세션의 상태 기계.
 *
 * 채점 규칙은 exam.ts 에 있고 여기서는 부르기만 한다. 이 훅이 하는 일은
 * '지금 몇 번째 문항인가, 답을 냈는가, 끝났는가' 뿐이다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllStates, saveExamResult } from '@/lib/db';
import {
  applyExamPenalty, isAutoGraded, pickExamQuestions, summarize, timeLimitMs,
  type ExamAnswer, type ExamConfig, type SelfGrade,
} from '@/lib/exam';
import type { Question } from '@/lib/schema';

export type ExamPhase = 'setup' | 'running' | 'grading' | 'result';

export interface ExamSession {
  phase: ExamPhase;
  questions: Question[];
  index: number;
  current: Question | null;
  /** 현재 문항에 고른 보기. */
  choice: number | undefined;
  setChoice: (i: number) => void;
  /** 현재 문항에 쓴 서술. */
  text: string;
  setText: (v: string) => void;
  answers: Map<string, ExamAnswer>;
  /** 남은 시간(ms). 타이머를 껐으면 null. */
  remainingMs: number | null;
  error: string | null;
  saving: boolean;
  start: (config: ExamConfig) => void;
  /** 답을 확정하고 채점 화면으로. */
  submit: () => void;
  /** 서술형 자가 채점 후 다음 문항으로. */
  selfGrade: (grade: SelfGrade) => void;
  /** 자동 채점 문항에서 다음으로. */
  next: () => void;
  summary: ReturnType<typeof summarize> | null;
  config: ExamConfig | null;
}

export function useExamSession(allQuestions: Question[], today: string): ExamSession {
  const [phase, setPhase] = useState<ExamPhase>('setup');
  const [config, setConfig] = useState<ExamConfig | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | undefined>(undefined);
  const [text, setText] = useState('');
  const [answers, setAnswers] = useState<Map<string, ExamAnswer>>(new Map());
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startedAt = useRef(0);
  const shownAt = useRef(0);
  const finished = useRef(false);

  const current = index < questions.length ? questions[index] : null;

  /** 결과 저장 + 오답의 복습 일정 앞당기기. 한 번만 돈다. */
  const finish = useCallback(
    async (finalAnswers: Map<string, ExamAnswer>, finalQuestions: Question[], cfg: ExamConfig) => {
      if (finished.current) return;
      finished.current = true;
      setPhase('result');
      setSaving(true);
      try {
        const result = summarize(finalQuestions, finalAnswers);
        const states = await getAllStates();
        const byQid = new Map(states.map((s) => [s.qid, s]));
        const penalties = result.wrongIds.map((qid) =>
          applyExamPenalty(byQid.get(qid), qid, today),
        );
        const finishedAt = Date.now();
        await saveExamResult(
          {
            startedAt: startedAt.current,
            finishedAt,
            msSpent: finishedAt - startedAt.current,
            config: cfg,
            answers: [...finalAnswers.values()],
            score: result.score,
            total: result.total,
            percent: result.percent,
          },
          penalties,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    },
    [today],
  );

  // 타이머. 0이 되면 지금까지의 답으로 끝낸다.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'grading') return;
    if (!config?.timer) return;
    const limit = timeLimitMs(questions.length);
    const tick = setInterval(() => {
      const left = limit - (Date.now() - startedAt.current);
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        clearInterval(tick);
        void finish(answers, questions, config);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [phase, config, questions, answers, finish]);

  const start = useCallback(
    (cfg: ExamConfig) => {
      const picked = pickExamQuestions(allQuestions, cfg);
      if (picked.length === 0) {
        setError('조건에 맞는 문항이 없다. 주제나 난이도를 넓혀야 한다.');
        return;
      }
      finished.current = false;
      setError(null);
      setConfig(cfg);
      setQuestions(picked);
      setAnswers(new Map());
      setIndex(0);
      setChoice(undefined);
      setText('');
      startedAt.current = Date.now();
      shownAt.current = Date.now();
      setRemainingMs(cfg.timer ? timeLimitMs(picked.length) : null);
      setPhase('running');
    },
    [allQuestions],
  );

  /** 답을 기록하고 채점 화면으로 넘어간다. */
  const submit = useCallback(() => {
    if (!current) return;
    const answer: ExamAnswer = {
      qid: current.id,
      msSpent: Date.now() - shownAt.current,
      ...(isAutoGraded(current) ? { choice } : { text }),
    };
    setAnswers((prev) => new Map(prev).set(current.id, answer));
    setPhase('grading');
  }, [current, choice, text]);

  const advance = useCallback(
    (nextAnswers: Map<string, ExamAnswer>) => {
      const nextIndex = index + 1;
      if (nextIndex >= questions.length) {
        if (config) void finish(nextAnswers, questions, config);
        return;
      }
      setIndex(nextIndex);
      setChoice(undefined);
      setText('');
      shownAt.current = Date.now();
      setPhase('running');
    },
    [index, questions, config, finish],
  );

  const next = useCallback(() => advance(answers), [advance, answers]);

  const selfGrade = useCallback(
    (grade: SelfGrade) => {
      if (!current) return;
      const updated = new Map(answers);
      const existing = updated.get(current.id);
      updated.set(current.id, {
        qid: current.id,
        msSpent: existing?.msSpent ?? 0,
        text: existing?.text ?? text,
        selfGrade: grade,
      });
      setAnswers(updated);
      advance(updated);
    },
    [current, answers, text, advance],
  );

  const summary = useMemo(
    () => (phase === 'result' ? summarize(questions, answers) : null),
    [phase, questions, answers],
  );

  return {
    phase, questions, index, current, choice, setChoice, text, setText,
    answers, remainingMs, error, saving, start, submit, selfGrade, next, summary, config,
  };
}
