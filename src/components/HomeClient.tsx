'use client';

/**
 * 홈. 문제은행은 서버에서 받고, 오늘 상태는 브라우저의 IndexedDB 에서 읽는다.
 * 그래서 처음 한 프레임은 '불러오는 중'이 보인다 — 서버는 학습 기록을 모른다.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { countDoneToday, getAllLogs, getAllStates } from '@/lib/db';
import { buildTodayQueue } from '@/lib/queue';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import { addDays, todayStr } from '@/lib/date';
import type { Question } from '@/lib/schema';
import { SOURCE_LABELS, type NewsItem } from '@/lib/news';
import { ProgressRing } from './ProgressRing';

/** 로그의 시각을 날짜 문자열로. 큐 판정과 같은 시간대를 써야 하루가 어긋나지 않는다. */
function toLocalDay(ms: number): string {
  return todayStr('Asia/Seoul', new Date(ms));
}

/**
 * 오늘(또는 어제)부터 거꾸로 이어지는 연속 학습일.
 * 오늘 아직 안 했어도 어제까지 이어졌으면 스트릭은 살아 있다 — 오늘 하루가 끝나야 끊긴다.
 */
function computeStreak(days: Set<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

interface Summary {
  review: number;
  fresh: number;
  doneToday: number;
  streak: number;
}

/** 홈에 보여줄 오늘 브리핑 미리보기. 뉴스가 없으면 null. */
export interface BriefingPreview {
  day: string;
  items: NewsItem[];
}

export function HomeClient({
  questions: base,
  today,
  briefing,
}: {
  questions: Question[];
  today: string;
  briefing: BriefingPreview | null;
}) {
  const { questions } = useMergedQuestions(base);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [states, logs, done] = await Promise.all([
          getAllStates(),
          getAllLogs(),
          countDoneToday(today),
        ]);
        if (cancelled) return;
        const queue = buildTodayQueue(questions, states, today, {
          newDoneToday: done.newDone,
          reviewDoneToday: done.reviewDone,
        });
        const days = new Set(logs.map((l) => toLocalDay(l.reviewedAt)));
        setSummary({
          review: queue.reviewCount,
          fresh: queue.newCount,
          doneToday: logs.filter((l) => toLocalDay(l.reviewedAt) === today).length,
          streak: computeStreak(days, today),
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, today]);

  const remaining = summary ? summary.review + summary.fresh : 0;
  const total = summary ? remaining + summary.doneToday : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold md:text-2xl">오늘</h1>
      <p className="mt-1 text-sm text-muted">{today}</p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
          학습 기록을 못 읽었다: {error}
        </p>
      )}

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        {summary === null ? (
          <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
        ) : (
          <>
            <div className="flex items-center gap-5">
              <ProgressRing
                done={summary.doneToday}
                total={total}
                label={String(remaining)}
                sub={remaining === 0 ? '다 했다' : '남음'}
              />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tabular-nums">{summary.streak}</span>
                  <span className="text-sm text-muted">일 연속</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  복습 <span className="font-medium text-foreground tabular-nums">{summary.review}</span>
                  {' · '}
                  신규 <span className="font-medium text-foreground tabular-nums">{summary.fresh}</span>
                </p>
                {summary.doneToday > 0 && (
                  <p className="mt-1 text-xs text-muted tabular-nums">
                    오늘 {summary.doneToday}장 함
                  </p>
                )}
              </div>
            </div>

            {remaining > 0 ? (
              <Link
                href="/drill"
                className="mt-5 flex w-full justify-center rounded-lg bg-accent px-4 py-3 text-sm font-medium text-accent-fg"
              >
                드릴 시작
              </Link>
            ) : (
              <p className="mt-5 text-center text-sm text-muted">
                오늘 몫은 끝났다. 내일 다시.
              </p>
            )}
          </>
        )}
      </div>

      {briefing && briefing.items.length > 0 && (
        <section className="mt-3 rounded-xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">오늘 브리핑</h2>
            <span className="text-xs text-muted tabular-nums">{briefing.day}</span>
          </div>
          <ul className="space-y-3">
            {briefing.items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm leading-snug hover:text-accent"
                >
                  {item.title}
                </a>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{SOURCE_LABELS[item.source]}</span>
                  {item.tags.map((tag, i) => (
                    <span key={`${i}-${tag}`} className="rounded-full bg-surface-muted px-1.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <Link href="/briefing" className="mt-4 inline-block text-xs text-accent">
            전체 보기 →
          </Link>
        </section>
      )}

      <Link
        href="/manage"
        className="mt-3 flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 text-sm"
      >
        <span>문제은행</span>
        <span className="text-muted tabular-nums">{questions.length}문항 →</span>
      </Link>
    </div>
  );
}
