'use client';

import { useState } from 'react';
import { DIFFICULTY_LABELS, TOPICS } from '@/lib/config';
import { DEFAULT_EXAM_CONFIG, EXAM_COUNTS, SECONDS_PER_QUESTION, type ExamConfig, type ExamCount } from '@/lib/exam';
import type { Question, Topic } from '@/lib/schema';

/** 조건에 맞는 문항이 몇 개인지 미리 세어 보여준다. 시작하고 나서 부족한 걸 알면 늦다. */
function countMatching(questions: readonly Question[], config: ExamConfig): number {
  return questions.filter(
    (q) =>
      (config.topics.length === 0 || config.topics.includes(q.topic)) &&
      (config.difficulties.length === 0 || config.difficulties.includes(q.difficulty)),
  ).length;
}

export function ExamSetup({
  questions,
  onStart,
  error,
}: {
  questions: Question[];
  onStart: (config: ExamConfig) => void;
  error: string | null;
}) {
  const [config, setConfig] = useState<ExamConfig>(DEFAULT_EXAM_CONFIG);

  const availableTopics = [...new Set(questions.map((q) => q.topic))].sort();
  const matching = countMatching(questions, config);
  const actual = Math.min(matching, config.count);

  const toggleTopic = (t: Topic) =>
    setConfig((c) => ({
      ...c,
      topics: c.topics.includes(t) ? c.topics.filter((x) => x !== t) : [...c.topics, t],
    }));

  const toggleDifficulty = (d: 1 | 2 | 3) =>
    setConfig((c) => ({
      ...c,
      difficulties: c.difficulties.includes(d)
        ? c.difficulties.filter((x) => x !== d)
        : [...c.difficulties, d],
    }));

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs transition-colors ${
      active ? 'bg-accent text-accent-fg font-medium' : 'bg-surface-muted text-muted hover:text-foreground'
    }`;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">주제</h2>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setConfig((c) => ({ ...c, topics: [] }))}
            className={chip(config.topics.length === 0)}>
            전체
          </button>
          {availableTopics.map((t) => (
            <button key={t} type="button" onClick={() => toggleTopic(t)}
              className={chip(config.topics.includes(t))}>
              {TOPICS[t]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">문항 수</h2>
        <div className="grid grid-cols-3 gap-2">
          {EXAM_COUNTS.map((n) => (
            <button key={n} type="button"
              onClick={() => setConfig((c) => ({ ...c, count: n as ExamCount }))}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                config.count === n ? 'border-accent bg-accent text-accent-fg font-medium' : 'border-border'
              }`}>
              {n}문항
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">난이도</h2>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setConfig((c) => ({ ...c, difficulties: [] }))}
            className={chip(config.difficulties.length === 0)}>
            전체
          </button>
          {([1, 2, 3] as const).map((d) => (
            <button key={d} type="button" onClick={() => toggleDifficulty(d)}
              className={chip(config.difficulties.includes(d))}>
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
          <span>
            <span className="block text-sm font-medium">타이머</span>
            <span className="block text-xs text-muted">
              문항당 {SECONDS_PER_QUESTION}초 · 전체 {Math.round((actual * SECONDS_PER_QUESTION) / 60)}분
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.timer}
            onChange={(e) => setConfig((c) => ({ ...c, timer: e.target.checked }))}
            className="size-5 accent-[var(--accent)]"
          />
        </label>
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">{error}</p>
      )}

      <div>
        <p className="mb-2 text-xs text-muted">
          조건에 맞는 문항 {matching}개 · 이번 시험 <span className="text-foreground">{actual}문항</span>
          {matching < config.count && ' (요청보다 적어 있는 만큼만 낸다)'}
        </p>
        <button
          type="button"
          onClick={() => onStart(config)}
          disabled={actual === 0}
          className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-40"
        >
          시험 시작
        </button>
      </div>
    </div>
  );
}
