/**
 * 날짜는 전부 여기를 거친다.
 *
 * 규칙: 날짜는 항상 'YYYY-MM-DD' 문자열이다. 문자열 in / 문자열 out 이며
 * Date 객체를 밖으로 내보내지 않는다. Date 를 흘려보내면 호출부에서 ms 뺄셈으로
 * 날짜 차이를 구하게 되고, DST 가 있는 지역에서 하루가 23/25시간이 되어 하루씩 밀린다.
 */

/** 'YYYY-MM-DD'. 이 앱에서 날짜를 표현하는 유일한 형식. */
export type DateString = string;

const PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** DateString 형식이자 실재하는 날짜인지 검사한다. 2026-02-30 은 false. */
export function isDateString(value: unknown): value is DateString {
  if (typeof value !== 'string' || !PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

function assertDateString(value: string, label: string): asserts value is DateString {
  if (!isDateString(value)) {
    throw new Error(`${label}: 잘못된 날짜 문자열 '${value}' (기대 형식 YYYY-MM-DD)`);
  }
}

/**
 * 지금이 속한 날짜를 tz 기준으로 돌려준다.
 *
 * 서버(UTC)와 브라우저(KST)가 같은 날짜를 봐야 due 판정이 갈리지 않으므로
 * 실행 환경의 시간대가 아니라 tz 를 명시해서 계산한다.
 * now 는 테스트에서 시각을 고정하기 위한 것이다.
 */
export function todayStr(tz: string = 'Asia/Seoul', now: Date = new Date()): DateString {
  // en-CA 로케일이 곧 YYYY-MM-DD 지만, 로케일 데이터에 기대지 않고 부분을 직접 조립한다.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const get = (type: string): string => {
    const found = parts.find((p) => p.type === type);
    if (!found) throw new Error(`todayStr: '${tz}' 로 ${type} 를 못 구했다`);
    return found.value;
  };

  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * n 일 뒤(음수면 앞)의 날짜.
 * Date 생성자는 넘치는 일자를 허용하므로(1월 32일 → 2월 1일) 월말·연말·윤년이 자동 처리된다.
 * 여기서 만든 Date 는 이 함수 밖으로 나가지 않는다.
 */
export function addDays(dateStr: DateString, n: number): DateString {
  assertDateString(dateStr, 'addDays');
  if (!Number.isInteger(n)) throw new Error(`addDays: n 은 정수여야 한다 (받은 값 ${n})`);
  const [y, m, d] = dateStr.split('-').map(Number);
  const shifted = new Date(y, m - 1, d + n);
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}-${pad2(shifted.getDate())}`;
}

/**
 * a - b (일 단위). 로컬 자정끼리 UTC 로 정규화해서 뺀다.
 * 로컬 Date 를 그대로 빼면 DST 경계에서 ±1시간이 남아 반올림이 흔들린다.
 */
export function diffDays(a: DateString, b: DateString): number {
  assertDateString(a, 'diffDays(a)');
  assertDateString(b, 'diffDays(b)');
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000);
}

/** due 가 오늘 이하이면 복습 대상. 형식이 고정폭이라 문자열 비교로 충분하다. */
export function isDue(due: DateString, today: DateString): boolean {
  assertDateString(due, 'isDue(due)');
  assertDateString(today, 'isDue(today)');
  return due <= today;
}

/** 문자열 비교 기반 정렬 비교자. 오래된 날짜가 앞. */
export function compareDates(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
