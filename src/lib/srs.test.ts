import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { GRADES, initialState, preview, schedule, type Grade, type ReviewState } from './srs';

/** D0 을 이 날짜로 잡는다. 윤년이 아니어서 날짜 덧셈이 눈으로 검산된다. */
const D0 = '2026-01-01';
const D = (n: number): string => addDays(D0, n);

describe('srs 회귀 시퀀스 (D0 → D201)', () => {
  /** 각 행: [평가 시점(D+n), 등급, 기대 reps, 기대 ease, 기대 interval, 기대 due(D+n)] */
  const table: Array<[number, Grade, number, number, number, number]> = [
    [0, 3, 1, 2.5, 1, 1],
    [1, 3, 2, 2.5, 6, 7],
    [7, 3, 3, 2.5, 15, 22],
    [22, 2, 4, 2.35, 18, 40],
    [40, 1, 0, 2.15, 1, 41],
    [41, 3, 1, 2.15, 1, 42],
    [42, 3, 2, 2.15, 6, 48],
    [48, 4, 3, 2.3, 18, 66],
    [66, 3, 4, 2.3, 41, 107],
    [107, 3, 5, 2.3, 94, 201],
  ];

  it('표 전체가 한 줄도 어긋나지 않는다', () => {
    let s = initialState('os-process-001', D0);
    expect(s.ease).toBe(2.5);
    expect(s.interval).toBe(0);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(0);

    for (const [day, grade, reps, ease, interval, dueDay] of table) {
      s = schedule(s, grade, D(day));
      const at = `D${day} grade ${grade}`;
      expect(`${at} reps=${s.reps}`).toBe(`${at} reps=${reps}`);
      expect(`${at} ease=${s.ease.toFixed(2)}`).toBe(`${at} ease=${ease.toFixed(2)}`);
      expect(`${at} interval=${s.interval}`).toBe(`${at} interval=${interval}`);
      expect(`${at} due=${s.due}`).toBe(`${at} due=${D(dueDay)}`);
    }
  });

  it('시퀀스가 끝나면 lapses 는 1이고 마지막 등급이 남는다', () => {
    let s = initialState('os-process-001', D0);
    for (const [day, grade] of table) s = schedule(s, grade, D(day));
    expect(s.lapses).toBe(1);
    expect(s.lastGrade).toBe(3);
    expect(s.qid).toBe('os-process-001');
    expect(s.suspended).toBe(false);
  });
});

describe('srs 경계', () => {
  it('Again 을 20번 눌러도 ease 가 1.3 아래로 안 내려간다', () => {
    let s = initialState('os-process-001', D0);
    for (let i = 0; i < 20; i++) s = schedule(s, 1, D(i));
    expect(s.ease).toBe(1.3);
    expect(s.interval).toBe(1);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(20);
  });

  it('Easy 를 반복해도 ease 가 3.0 위로 안 올라간다', () => {
    let s = initialState('os-process-001', D0);
    for (let i = 0; i < 20; i++) s = schedule(s, 4, D(i));
    expect(s.ease).toBe(3.0);
  });

  it('interval 은 365 를 넘지 않는다', () => {
    const long: ReviewState = {
      qid: 'os-process-001', ease: 3.0, interval: 300, reps: 9,
      lapses: 0, due: D0, suspended: false, updatedAt: 0,
    };
    expect(schedule(long, 3, D0).interval).toBe(365);
    expect(schedule(long, 4, D0).interval).toBe(365);
    expect(schedule(long, 3, D0).due).toBe(addDays(D0, 365));
  });

  it('Hard 는 간격이 제자리에 머물지 않는다', () => {
    // interval 1 에 1.2 를 곱하면 반올림으로 다시 1이 된다. +1 하한이 이걸 막는다.
    const s: ReviewState = {
      qid: 'q', ease: 2.5, interval: 1, reps: 5,
      lapses: 0, due: D0, suspended: false, updatedAt: 0,
    };
    expect(schedule(s, 2, D0).interval).toBe(2);
  });

  it('schedule 은 인자로 받은 상태를 변형하지 않는다', () => {
    const s = initialState('os-process-001', D0);
    const snapshot = JSON.stringify(s);
    for (const g of GRADES) schedule(s, g, D0);
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('preview 는 네 버튼의 간격을 주고 실제 채점과 일치한다', () => {
    const s = schedule(schedule(initialState('q', D0), 3, D0), 3, D(1));
    const p = preview(s, D(7));
    expect(Object.keys(p).map(Number).sort()).toEqual([1, 2, 3, 4]);
    for (const g of GRADES) {
      expect(p[g]).toBe(schedule(s, g, D(7)).interval);
    }
    expect(p[1]).toBe(1);
    expect(p[3]).toBe(15);
  });
});

describe('날짜 덧셈 경계', () => {
  it('연말을 넘어간다', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('윤년 2월을 넘어간다', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });

  it('평년 2월은 28일에서 끝난다', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });

  it('due 계산이 연말을 넘어도 맞는다', () => {
    const s: ReviewState = {
      qid: 'q', ease: 2.5, interval: 3, reps: 5,
      lapses: 0, due: '2026-12-30', suspended: false, updatedAt: 0,
    };
    expect(schedule(s, 3, '2026-12-30').due).toBe('2027-01-07'); // interval 8
  });
});
