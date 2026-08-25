import { describe, expect, it } from 'vitest';
import {
  buildHeatmap, computeStreaks, isCorrect, maturity,
  topLapses, topicAccuracy, type ReviewEvent,
} from './stats';
import type { Question } from './schema';
import type { ReviewState } from './srs';

const TODAY = '2026-08-25';

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id, topic: 'os', subtopic: 't', difficulty: 1, type: 'concept',
    question: 'q', answerShort: 'a', keywords: [], ...over,
  } as Question;
}
function state(qid: string, over: Partial<ReviewState> = {}): ReviewState {
  return {
    qid, ease: 2.5, interval: 5, reps: 2, lapses: 0,
    due: TODAY, suspended: false, updatedAt: 0, ...over,
  };
}
const ev = (qid: string, grade: 1 | 2 | 3 | 4, day: string): ReviewEvent => ({ qid, grade, day });

describe('buildHeatmap', () => {
  it('오늘로 끝나는 365일을 담고 주 단위로 나눈다', () => {
    const h = buildHeatmap([], TODAY);
    const flat = h.weeks.flat().filter((c) => c !== null);
    expect(flat.length).toBe(365);
    expect(flat[flat.length - 1]?.day).toBe(TODAY);
    expect(h.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it('첫 열이 일요일에서 시작하도록 앞을 비운다', () => {
    const h = buildHeatmap([], TODAY, 10);
    const firstWeek = h.weeks[0];
    const firstCell = firstWeek.findIndex((c) => c !== null);
    // 비어 있는 앞칸 다음이 실제 시작일이고, 그 앞은 전부 null 이어야 한다.
    expect(firstWeek.slice(0, firstCell).every((c) => c === null)).toBe(true);
  });

  it('날짜별로 센다', () => {
    const h = buildHeatmap([ev('a', 3, TODAY), ev('b', 1, TODAY), ev('c', 3, '2026-08-24')], TODAY, 7);
    const cells = h.weeks.flat().filter((c) => c !== null);
    expect(cells.find((c) => c?.day === TODAY)?.count).toBe(2);
    expect(cells.find((c) => c?.day === '2026-08-24')?.count).toBe(1);
    expect(h.total).toBe(3);
    expect(h.activeDays).toBe(2);
    expect(h.max).toBe(2);
  });

  it('개수에 따라 색 단계를 매긴다', () => {
    const many = (n: number, day: string) => Array.from({ length: n }, () => ev('x', 3, day));
    const h = buildHeatmap(
      [...many(1, '2026-08-21'), ...many(6, '2026-08-22'), ...many(12, '2026-08-23'), ...many(25, TODAY)],
      TODAY, 7,
    );
    const at = (d: string) => h.weeks.flat().find((c) => c?.day === d)?.level;
    expect(at('2026-08-20')).toBe(0);
    expect(at('2026-08-21')).toBe(1);
    expect(at('2026-08-22')).toBe(2);
    expect(at('2026-08-23')).toBe(3);
    expect(at(TODAY)).toBe(4);
  });

  it('범위 밖 로그는 무시한다', () => {
    const h = buildHeatmap([ev('a', 3, '2020-01-01')], TODAY, 7);
    expect(h.total).toBe(0);
  });
});

describe('computeStreaks', () => {
  it('오늘 했으면 오늘부터 센다', () => {
    const days = new Set([TODAY, '2026-08-24', '2026-08-23']);
    expect(computeStreaks(days, TODAY)).toEqual({ current: 3, longest: 3 });
  });

  it('오늘 안 했어도 어제까지 이어졌으면 살아 있다', () => {
    const days = new Set(['2026-08-24', '2026-08-23']);
    expect(computeStreaks(days, TODAY).current).toBe(2);
  });

  it('그저께가 마지막이면 끊긴다', () => {
    const days = new Set(['2026-08-23', '2026-08-22']);
    expect(computeStreaks(days, TODAY).current).toBe(0);
  });

  it('최장 연속일은 과거 구간에서도 찾는다', () => {
    const days = new Set([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', // 4일
      '2026-08-24', TODAY, // 2일
    ]);
    const s = computeStreaks(days, TODAY);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(4);
  });

  it('기록이 없으면 0', () => {
    expect(computeStreaks(new Set(), TODAY)).toEqual({ current: 0, longest: 0 });
  });

  it('하루만 있으면 1', () => {
    expect(computeStreaks(new Set([TODAY]), TODAY)).toEqual({ current: 1, longest: 1 });
  });
});

describe('topicAccuracy', () => {
  const byId = new Map([
    ['os-a-001', q('os-a-001')],
    ['db-a-001', q('db-a-001', { topic: 'db' })],
  ]);

  it('Again 만 오답으로 세고 낮은 순으로 정렬한다', () => {
    const rows = topicAccuracy(
      [
        ev('os-a-001', 3, TODAY), ev('os-a-001', 2, TODAY), // os 2/2
        ev('db-a-001', 1, TODAY), ev('db-a-001', 3, TODAY), // db 1/2
      ],
      byId,
    );
    expect(rows[0]).toMatchObject({ topic: 'db', percent: 50 });
    expect(rows[1]).toMatchObject({ topic: 'os', percent: 100 });
  });

  it('문제은행에 없는 로그는 뺀다', () => {
    expect(topicAccuracy([ev('gone-a-001', 3, TODAY)], byId)).toEqual([]);
  });

  it('isCorrect 는 Again 만 오답으로 본다', () => {
    expect([1, 2, 3, 4].map((g) => isCorrect(g as 1 | 2 | 3 | 4)))
      .toEqual([false, true, true, true]);
  });
});

describe('topLapses', () => {
  const byId = new Map(
    Array.from({ length: 15 }, (_, i) => [`os-a-${String(i).padStart(3, '0')}`, q(`os-a-${String(i).padStart(3, '0')}`)]),
  );

  it('lapses 많은 순으로 최대 10개', () => {
    const states = Array.from({ length: 15 }, (_, i) =>
      state(`os-a-${String(i).padStart(3, '0')}`, { lapses: i }));
    const rows = topLapses(states, byId);
    expect(rows.length).toBe(10);
    expect(rows[0].lapses).toBe(14);
    expect(rows[9].lapses).toBe(5);
  });

  it('한 번도 안 틀린 카드는 넣지 않는다', () => {
    expect(topLapses([state('os-a-000', { lapses: 0 })], byId)).toEqual([]);
  });

  it('문제은행에서 사라진 카드는 뺀다', () => {
    expect(topLapses([state('gone-a-001', { lapses: 9 })], byId)).toEqual([]);
  });
});

describe('maturity', () => {
  const questions = Array.from({ length: 5 }, (_, i) => q(`os-a-${String(i).padStart(3, '0')}`));

  it('신규 / 학습중 / 성숙 / 보류로 가른다', () => {
    const m = maturity(questions, [
      state('os-a-000', { interval: 5 }),   // 학습중
      state('os-a-001', { interval: 21 }),  // 성숙 (경계값 포함)
      state('os-a-002', { interval: 40 }),  // 성숙
      state('os-a-003', { suspended: true, interval: 30 }), // 보류
      // os-a-004 는 상태 없음 → 신규
    ]);
    expect(m).toEqual({ fresh: 1, learning: 1, mature: 2, suspended: 1, total: 5 });
  });

  it('상태가 하나도 없으면 전부 신규', () => {
    expect(maturity(questions, [])).toMatchObject({ fresh: 5, learning: 0, mature: 0 });
  });
});
