'use client';

import Link from 'next/link';

/** 상단 진행바와 닫기. 남은 장수를 항상 보이게 해서 끝이 보이도록 한다. */
export function DrillHeader({ index, total }: { index: number; total: number }) {
  const done = Math.min(index, total);
  const percent = total === 0 ? 0 : (done / total) * 100;

  return (
    <div className="mb-6 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
          <span className="tabular-nums">
            {done} / {total}
          </span>
          <span className="tabular-nums">{Math.round(percent)}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="진행률"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <Link
        href="/"
        aria-label="드릴 닫기"
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-lg leading-none text-muted hover:bg-surface-2 hover:text-foreground"
      >
        ✕
      </Link>
    </div>
  );
}
