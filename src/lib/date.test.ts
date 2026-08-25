import { describe, expect, it } from 'vitest';
import { addDays, compareDates, diffDays, isDateString, isDue, todayStr } from './date';

describe('todayStr', () => {
  it('tz 기준 날짜를 준다 — 실행 환경 시간대와 무관하다', () => {
    // 2026-08-25 15:30 UTC = KST 로는 이미 8/26 00:30 이다.
    const t = new Date('2026-08-25T15:30:00Z');
    expect(todayStr('Asia/Seoul', t)).toBe('2026-08-26');
    expect(todayStr('UTC', t)).toBe('2026-08-25');
    expect(todayStr('America/Los_Angeles', t)).toBe('2026-08-25');
  });

  it('KST 자정 직전·직후에서 날짜가 갈린다', () => {
    expect(todayStr('Asia/Seoul', new Date('2026-08-25T14:59:59Z'))).toBe('2026-08-25');
    expect(todayStr('Asia/Seoul', new Date('2026-08-25T15:00:00Z'))).toBe('2026-08-26');
  });

  it('기본 시간대는 Asia/Seoul 이다', () => {
    const t = new Date('2026-08-25T15:30:00Z');
    expect(todayStr(undefined, t)).toBe(todayStr('Asia/Seoul', t));
  });

  it('한 자리 월·일도 0을 채운다', () => {
    expect(todayStr('UTC', new Date('2026-03-05T12:00:00Z'))).toBe('2026-03-05');
  });
});

describe('addDays', () => {
  it('월말·연말·윤년을 넘긴다', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('0일을 더하면 그대로다', () => {
    expect(addDays('2026-08-25', 0)).toBe('2026-08-25');
  });

  it('정수가 아니면 던진다', () => {
    expect(() => addDays('2026-08-25', 1.5)).toThrow(/정수/);
  });
});

describe('diffDays', () => {
  it('부호가 대칭이고 정수를 준다', () => {
    expect(diffDays('2026-03-01', '2026-02-28')).toBe(1);
    expect(diffDays('2026-02-28', '2026-03-01')).toBe(-1);
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
    expect(diffDays('2024-03-01', '2024-02-28')).toBe(2); // 윤년
    expect(diffDays('2026-08-25', '2026-08-25')).toBe(0);
  });
});

describe('isDateString', () => {
  it('실재하지 않는 날짜와 잘못된 형식을 거부한다', () => {
    expect(isDateString('2026-02-30')).toBe(false);
    expect(isDateString('2026-13-01')).toBe(false);
    expect(isDateString('2026-8-5')).toBe(false);
    expect(isDateString('2026-08-05')).toBe(true);
    expect(isDateString(20260805)).toBe(false);
    expect(() => addDays('2026-02-30', 1)).toThrow(/잘못된 날짜/);
  });
});

describe('isDue / compareDates', () => {
  it('isDue 는 문자열 비교로 판정한다', () => {
    expect(isDue('2026-08-24', '2026-08-25')).toBe(true);
    expect(isDue('2026-08-25', '2026-08-25')).toBe(true);
    expect(isDue('2026-08-26', '2026-08-25')).toBe(false);
  });

  it('compareDates 는 오래된 날짜를 앞에 둔다', () => {
    const sorted = ['2026-08-26', '2026-08-24', '2026-08-25'].sort(compareDates);
    expect(sorted).toEqual(['2026-08-24', '2026-08-25', '2026-08-26']);
  });
});
