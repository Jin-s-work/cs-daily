'use client';

import type { Heatmap as HeatmapData } from '@/lib/stats';

/**
 * 잔디 히트맵. 차트 라이브러리 없이 CSS grid 로만 그린다.
 *
 * 열이 주, 행이 요일이다. `grid-flow-col` 로 세로로 채우면 주 단위 열이 자연스럽게 만들어진다.
 */
const LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-surface-muted',
  1: 'bg-accent/25',
  2: 'bg-accent/50',
  3: 'bg-accent/75',
  4: 'bg-accent',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function Heatmap({ data, today }: { data: HeatmapData; today: string }) {
  return (
    <div>
      {/* 가로가 좁으면 스크롤한다. 셀을 줄이면 알아보기 어려워진다. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5">
          <div className="grid shrink-0 grid-rows-7 gap-[3px] pt-[1px] text-[9px] text-muted">
            {WEEKDAYS.map((d, i) => (
              <span key={d} className="flex h-[11px] items-center">
                {/* 월·수·금만 적는다. 다 적으면 빽빽해서 오히려 안 읽힌다. */}
                {i % 2 === 1 ? d : ''}
              </span>
            ))}
          </div>

          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {data.weeks.flat().map((cell, i) =>
              cell === null ? (
                <span key={`pad-${i}`} className="size-[11px]" />
              ) : (
                <span
                  key={cell.day}
                  title={`${cell.day} · ${cell.count}장`}
                  aria-label={`${cell.day} ${cell.count}장`}
                  className={`size-[11px] rounded-[2px] ${LEVEL_CLASS[cell.level]} ${
                    cell.day === today ? 'ring-1 ring-foreground/40' : ''
                  }`}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span className="tabular-nums">
          1년간 {data.total}장 · {data.activeDays}일
        </span>
        <span className="flex items-center gap-1">
          적음
          {([0, 1, 2, 3, 4] as const).map((l) => (
            <span key={l} className={`size-[10px] rounded-[2px] ${LEVEL_CLASS[l]}`} />
          ))}
          많음
        </span>
      </div>
    </div>
  );
}
