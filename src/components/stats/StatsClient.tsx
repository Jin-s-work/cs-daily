'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import { TOPICS } from '@/lib/config';
import { getAllLogs, getAllStates } from '@/lib/db';
import { todayStr } from '@/lib/date';
import type { Question } from '@/lib/schema';
import type { ReviewState } from '@/lib/srs';
import {
  buildHeatmap, computeStreaks, LOW_BACKLOG_THRESHOLD, MATURE_INTERVAL_DAYS,
  maturity, topLapses, topicAccuracy, type ReviewEvent,
} from '@/lib/stats';
import { Heatmap } from './Heatmap';

interface Loaded {
  events: ReviewEvent[];
  states: ReviewState[];
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

export function StatsClient({ questions: base, today }: { questions: Question[]; today: string }) {
  const { questions } = useMergedQuestions(base);
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [logs, states] = await Promise.all([getAllLogs(), getAllStates()]);
        if (cancelled) return;
        setData({
          // 로그 시각을 큐 판정과 같은 시간대로 날짜화한다.
          events: logs.map((l) => ({
            qid: l.qid,
            grade: l.grade,
            day: todayStr('Asia/Seoul', new Date(l.reviewedAt)),
          })),
          states,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
        학습 기록을 못 읽었다: {error}
      </p>
    );
  }
  if (!data) return <p className="py-20 text-center text-sm text-muted">불러오는 중…</p>;

  const byId = new Map(questions.map((q) => [q.id, q]));
  const heat = buildHeatmap(data.events, today);
  const streaks = computeStreaks(new Set(data.events.map((e) => e.day)), today);
  const accuracy = topicAccuracy(data.events, byId);
  const lapses = topLapses(data.states, byId);
  const m = maturity(questions, data.states);
  const low = m.fresh <= LOW_BACKLOG_THRESHOLD;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">통계</h1>
        <p className="mt-1 text-sm text-muted">{today}</p>
      </div>

      <Card title="1년">
        <Heatmap data={heat} today={today} />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card title="현재 연속">
          <div className="text-3xl font-semibold tabular-nums">{streaks.current}<span className="ml-1 text-sm font-normal text-muted">일</span></div>
        </Card>
        <Card title="최장 연속">
          <div className="text-3xl font-semibold tabular-nums">{streaks.longest}<span className="ml-1 text-sm font-normal text-muted">일</span></div>
        </Card>
      </div>

      <Card title="문제은행 잔량">
        <div className={`text-4xl font-semibold tabular-nums ${low ? 'text-amber-500' : ''}`}>
          {m.fresh}
        </div>
        <p className="mt-1 text-xs text-muted">
          아직 한 번도 안 본 카드
          {low && ' — 곧 바닥난다. 문제를 더 넣어야 한다.'}
        </p>
      </Card>

      <Card title="카드 성숙도">
        {m.total === 0 ? (
          <p className="text-sm text-muted">문항이 없다.</p>
        ) : (
          <>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="bg-accent/30" style={{ width: `${(m.fresh / m.total) * 100}%` }} />
              <div className="bg-accent/60" style={{ width: `${(m.learning / m.total) * 100}%` }} />
              <div className="bg-accent" style={{ width: `${(m.mature / m.total) * 100}%` }} />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <li className="flex justify-between"><span className="text-muted">신규</span><span className="tabular-nums">{m.fresh}</span></li>
              <li className="flex justify-between"><span className="text-muted">학습중 (&lt;{MATURE_INTERVAL_DAYS}일)</span><span className="tabular-nums">{m.learning}</span></li>
              <li className="flex justify-between"><span className="text-muted">성숙 (≥{MATURE_INTERVAL_DAYS}일)</span><span className="tabular-nums">{m.mature}</span></li>
              <li className="flex justify-between"><span className="text-muted">보류</span><span className="tabular-nums">{m.suspended}</span></li>
            </ul>
          </>
        )}
      </Card>

      <Card title="주제별 정답률">
        {accuracy.length === 0 ? (
          <p className="text-sm text-muted">아직 채점 기록이 없다.</p>
        ) : (
          <ul className="space-y-2.5">
            {accuracy.map((t) => (
              <li key={t.topic}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span>{TOPICS[t.topic]}</span>
                  <span className="text-muted tabular-nums">{t.correct}/{t.total} · {t.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${t.percent < 60 ? 'bg-amber-500' : 'bg-accent'}`}
                    style={{ width: `${t.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="오답노트">
        {lapses.length === 0 ? (
          <p className="text-sm text-muted">아직 Again 을 누른 카드가 없다.</p>
        ) : (
          <ul className="space-y-1.5">
            {lapses.map((row) => (
              <li key={row.question.id}>
                <Link
                  href={`/manage?q=${encodeURIComponent(row.question.id)}`}
                  className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 text-sm leading-snug">{row.question.question}</span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {row.lapses}회 · ease {row.ease.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
