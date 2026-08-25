'use client';

import Link from 'next/link';

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m === 0 ? `${s}초` : `${m}분 ${s}초`;
}

/** 큐를 다 비운 뒤. 숫자 세 개만 보여준다. */
export function DoneScreen({
  reviewed,
  correct,
  elapsedMs,
}: {
  reviewed: number;
  correct: number;
  elapsedMs: number;
}) {
  const rate = reviewed === 0 ? 0 : Math.round((correct / reviewed) * 100);

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="text-5xl">✓</div>
      <h1 className="mt-4 text-xl font-semibold">오늘 몫을 끝냈다</h1>

      <dl className="mt-8 grid grid-cols-3 gap-3 text-left">
        {[
          { label: '평가한 카드', value: `${reviewed}장` },
          { label: '소요 시간', value: formatDuration(elapsedMs) },
          { label: '정답률', value: `${rate}%` },
        ].map((item) => (
          <div key={item.label} className="card p-3">
            <dt className="text-[11px] text-muted">{item.label}</dt>
            <dd className="mt-1 text-base font-semibold tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-muted">
        정답률은 Again 을 뺀 비율이다. Hard 도 기억해낸 것으로 센다.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex btn btn-primary"
      >
        홈으로
      </Link>
    </div>
  );
}
