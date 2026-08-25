'use client';

import Link from 'next/link';
import { TOPICS } from '@/lib/config';
import { needsReview, scoreOf, type ExamAnswer, type ExamSummary } from '@/lib/exam';
import type { Question } from '@/lib/schema';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m === 0 ? `${s}초` : `${m}분 ${s}초`;
}

export function ExamResultView({
  summary, questions, answers, msSpent, saving, error, onRestart,
}: {
  summary: ExamSummary;
  questions: Question[];
  answers: Map<string, ExamAnswer>;
  msSpent: number;
  saving: boolean;
  error: string | null;
  onRestart: () => void;
}) {
  const review = questions.filter((q) => needsReview(q, answers.get(q.id)));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <div className="text-4xl font-semibold tabular-nums">{summary.percent}%</div>
        <p className="mt-1 text-sm text-muted tabular-nums">
          {summary.score} / {summary.total}점 · {formatDuration(msSpent)}
        </p>
      </div>

      {saving && <p className="mt-4 text-center text-xs text-muted">기록을 저장하는 중…</p>}
      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
          기록을 저장하지 못했다: {error}
        </p>
      )}

      {summary.wrongIds.length > 0 && (
        <p className="mt-4 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-xs text-muted">
          틀린 {summary.wrongIds.length}문항은 복습 일정을 오늘로 당겼다. 다음 드릴에서 앞쪽에 나온다.
        </p>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium">주제별</h2>
        <ul className="space-y-2">
          {summary.byTopic.map((t) => (
            <li key={t.topic} className="rounded-lg border border-border bg-surface px-3.5 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between text-xs">
                <span>{TOPICS[t.topic]}</span>
                <span className="text-muted tabular-nums">{t.score}/{t.total} · {t.percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${t.percent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {review.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium">다시 볼 문항 {review.length}개</h2>
          <ul className="space-y-2">
            {review.map((q) => {
              const answer = answers.get(q.id);
              const score = scoreOf(q, answer);
              return (
                <li key={q.id} className="rounded-lg border border-border bg-surface p-3.5">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-muted">
                    <span className={score === 0.5 ? 'text-amber-500' : 'text-red-500'}>
                      {score === 0.5 ? '애매' : '틀림'}
                    </span>
                    <code className="rounded bg-surface-muted px-1.5 py-0.5">{q.id}</code>
                  </div>
                  <p className="text-sm leading-relaxed">{q.question}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{q.answerShort}</p>
                  {answer?.text?.trim() && (
                    <p className="mt-2 border-l-2 border-border pl-3 text-xs whitespace-pre-wrap text-muted">
                      내 답: {answer.text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-8 flex gap-2">
        <button type="button" onClick={onRestart}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm">
          다시 보기
        </button>
        <Link href="/drill"
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-fg">
          드릴로
        </Link>
      </div>
    </div>
  );
}
