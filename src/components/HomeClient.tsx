'use client';

/**
 * 오늘. 하루의 시작점이자 유일한 '무엇부터 할까' 화면이다.
 *
 * 원칙 하나: 지금 할 일 하나를 크게 보여준다. 배울 게 남았으면 배우기,
 * 다 배웠으면 익히기, 둘 다 끝났으면 끝났다고 말한다. 선택지를 나란히 늘어놓으면
 * 매일 아침 같은 결정을 다시 하게 된다.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import { countDoneToday, getAllLogs, getAllStates } from '@/lib/db';
import { addDays, todayStr } from '@/lib/date';
import { SOURCE_LABELS, type NewsItem } from '@/lib/news';
import { buildTodayQueue } from '@/lib/queue';
import type { Question } from '@/lib/schema';
import { computeStreaks, LOW_BACKLOG_THRESHOLD } from '@/lib/stats';

export interface BriefingPreview {
  day: string;
  items: NewsItem[];
}

interface Summary {
  toLearn: number;
  toReview: number;
  doneToday: number;
  streak: number;
  unseen: number;
}

/** 오늘 남은 일에 따라 다음 한 걸음을 정한다. */
function nextStep(s: Summary): { href: string; label: string; hint: string } | null {
  if (s.toLearn > 0) {
    return { href: '/learn', label: `새 개념 ${s.toLearn}개 배우기`, hint: '답을 먼저 읽고 이해하면 된다' };
  }
  if (s.toReview > 0) {
    return { href: '/drill', label: `${s.toReview}장 익히기`, hint: '전에 배운 것을 떠올려 본다' };
  }
  return null;
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
        const days = new Set(logs.map((l) => todayStr('Asia/Seoul', new Date(l.reviewedAt))));
        setSummary({
          toLearn: queue.fresh.length,
          toReview: queue.review.length,
          doneToday: done.newDone + done.reviewDone,
          streak: computeStreaks(days, today).current,
          unseen: questions.filter((q) => !states.some((s) => s.qid === q.id)).length,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [questions, today]);

  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(`${today}T00:00:00`).getDay()
  ];
  const step = summary ? nextStep(summary) : null;
  const remaining = summary ? summary.toLearn + summary.toReview : 0;
  const total = summary ? remaining + summary.doneToday : 0;
  const percent = total === 0 ? 100 : Math.round((100 * (summary?.doneToday ?? 0)) / total);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="t-caption t-num">{today} · {weekday}요일</p>
        <h1 className="t-display mt-1">오늘</h1>
      </header>

      {error && (
        <p className="t-caption mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-danger">
          학습 기록을 못 읽었다: {error}
        </p>
      )}

      {summary === null ? (
        <div className="card p-6">
          <p className="t-caption py-10 text-center">불러오는 중…</p>
        </div>
      ) : (
        <>
          {/* 오늘 할 일 하나. 나머지는 아래에 작게. */}
          <section className="card enter overflow-hidden">
            <div className="p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="t-heading">오늘의 코스</span>
                <span className="t-caption t-num">{summary.doneToday} / {total}</span>
              </div>

              <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>

              {step ? (
                <>
                  <Link href={step.href} className="btn btn-primary w-full !py-3.5 text-base">
                    {step.label}
                  </Link>
                  <p className="t-caption mt-2.5 text-center">{step.hint}</p>
                </>
              ) : (
                <div className="py-2 text-center">
                  <p className="t-title">오늘 몫을 끝냈다</p>
                  <p className="t-caption mt-1">
                    {summary.streak > 0 ? `${summary.streak}일째 이어 가는 중이다.` : '내일 또 만나자.'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
              {[
                { label: '배울 것', value: summary.toLearn, href: '/learn' },
                { label: '익힐 것', value: summary.toReview, href: '/drill' },
                { label: '연속', value: summary.streak, href: '/stats', unit: '일' },
              ].map((cell) => (
                <Link key={cell.label} href={cell.href}
                  className="px-3 py-3.5 text-center transition-colors hover:bg-surface-2">
                  <div className="t-num text-xl font-semibold">
                    {cell.value}
                    {cell.unit && <span className="t-caption ml-0.5 font-normal">{cell.unit}</span>}
                  </div>
                  <div className="t-caption">{cell.label}</div>
                </Link>
              ))}
            </div>
          </section>

          {summary.unseen <= LOW_BACKLOG_THRESHOLD && (
            <p className="t-caption mt-3 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-warn">
              아직 안 본 카드가 {summary.unseen}개 남았다. 곧 바닥나니 문제를 더 넣어야 한다.
            </p>
          )}
        </>
      )}

      {briefing && briefing.items.length > 0 && (
        <section className="card mt-4 p-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="t-heading">오늘 브리핑</h2>
            <span className="t-caption t-num">{briefing.day}</span>
          </div>
          <ul className="space-y-3.5">
            {briefing.items.map((item) => (
              <li key={item.id}>
                <a href={item.url} target="_blank" rel="noreferrer"
                  className="t-body block leading-snug transition-colors hover:text-accent">
                  {item.title}
                </a>
                <div className="t-caption mt-1 flex flex-wrap items-center gap-1.5">
                  <span>{SOURCE_LABELS[item.source]}</span>
                  {item.tags.map((tag, i) => (
                    <span key={`${i}-${tag}`} className="rounded-full bg-surface-2 px-1.5 py-0.5">{tag}</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <Link href="/briefing" className="t-caption mt-4 inline-block text-accent">전체 보기 →</Link>
        </section>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/exam" className="card p-4 transition-colors hover:bg-surface-2">
          <div className="t-heading">점검 시험</div>
          <div className="t-caption mt-0.5">실력을 재고 약한 곳을 찾는다</div>
        </Link>
        <Link href="/manage" className="card p-4 transition-colors hover:bg-surface-2">
          <div className="t-heading">문제은행</div>
          <div className="t-caption t-num mt-0.5">{questions.length}문항</div>
        </Link>
      </div>

      <p className="t-caption mt-6 text-center">
        어제 배운 것은 내일 다시 온다 · {addDays(today, 1)} 예정
      </p>
    </div>
  );
}
