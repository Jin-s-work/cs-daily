'use client';

import { GRADES, GRADE_LABELS, type Grade } from '@/lib/srs';

/** 간격을 사람이 읽는 단위로. 90일을 '3개월'로 보여주면 감이 온다. */
function intervalLabel(days: number): string {
  if (days <= 0) return '오늘';
  if (days < 30) return `${days}일`;
  if (days < 365) return `${Math.round(days / 30)}개월`;
  return `${(days / 365).toFixed(1)}년`;
}

const STYLES: Record<Grade, string> = {
  1: 'border-red-500/40 hover:bg-red-500/10',
  2: 'border-amber-500/40 hover:bg-amber-500/10',
  3: 'border-accent/40 hover:bg-accent/10',
  4: 'border-emerald-500/40 hover:bg-emerald-500/10',
};

/** 평가 4버튼. 각 버튼이 자기를 누르면 언제 다시 나오는지 미리 보여준다. */
export function GradeBar({
  intervals,
  onGrade,
}: {
  intervals: Record<Grade, number>;
  onGrade: (g: Grade) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {GRADES.map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onGrade(g)}
          className={`rounded-xl border bg-surface px-2 py-3 text-center transition-colors ${STYLES[g]}`}
        >
          <span className="block text-sm font-medium">{GRADE_LABELS[g]}</span>
          <span className="mt-0.5 block text-xs text-muted tabular-nums">
            {intervalLabel(intervals[g])}
          </span>
          <span className="mt-1 block text-[10px] text-muted">{g}</span>
        </button>
      ))}
    </div>
  );
}
