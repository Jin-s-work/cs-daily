/**
 * 통계 집계. 순수 함수다 — 로그와 상태를 받아 화면이 그릴 수 있는 형태로만 바꾼다.
 *
 * 차트 라이브러리를 쓰지 않는다. 여기서 격자 배열까지 만들어 주면 화면은 CSS grid 로 칠하기만 하면 된다.
 */

import { addDays, compareDates, diffDays, type DateString } from './date';
import type { Question, Topic } from './schema';
import type { Grade, ReviewState } from './srs';

/** 간격이 이 일수 이상이면 '성숙' 으로 본다. */
export const MATURE_INTERVAL_DAYS = 21;

/** 잔여 신규 카드가 이 아래로 내려가면 화면이 경고색을 쓴다. */
export const LOW_BACKLOG_THRESHOLD = 20;

/** 채점 한 건. reviewLogs 에서 필요한 것만 뽑아 쓴다 — Dexie 를 import 하지 않기 위해서다. */
export interface ReviewEvent {
  qid: string;
  grade: Grade;
  /** 로컬 날짜 문자열. 호출부가 시간대를 정해 넘긴다. */
  day: DateString;
}

/** Again(1)만 오답으로 센다. Hard 도 결국 기억해 낸 것이다 — 드릴 완료 화면과 같은 기준. */
export function isCorrect(grade: Grade): boolean {
  return grade >= 2;
}

// ─── 잔디 히트맵 ───

export interface HeatCell {
  day: DateString;
  count: number;
  /** 0(없음) ~ 4(많음). 색 단계. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Heatmap {
  /** 주 단위 열. 각 열은 일요일부터 7칸이고, 범위 밖은 null. */
  weeks: Array<Array<HeatCell | null>>;
  total: number;
  /** 활동한 날 수. */
  activeDays: number;
  max: number;
}

function levelOf(count: number): HeatCell['level'] {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 10) return 2;
  if (count < 20) return 3;
  return 4;
}

/**
 * 오늘로 끝나는 days 일치 히트맵.
 *
 * 첫 열이 일요일로 시작하도록 앞을 비워 둔다. 그래야 요일 축이 어긋나지 않는다.
 */
export function buildHeatmap(
  events: readonly ReviewEvent[],
  today: DateString,
  days = 365,
): Heatmap {
  const counts = new Map<DateString, number>();
  for (const e of events) counts.set(e.day, (counts.get(e.day) ?? 0) + 1);

  const start = addDays(today, -(days - 1));
  const cells: HeatCell[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const count = counts.get(day) ?? 0;
    cells.push({ day, count, level: levelOf(count) });
  }

  // 첫 칸의 요일만큼 앞을 비운다. Date 는 이 안에서만 쓰고 밖으로 내보내지 않는다.
  const [y, m, d] = start.split('-').map(Number);
  const leading = new Date(y, m - 1, d).getDay();

  const weeks: Array<Array<HeatCell | null>> = [];
  let week: Array<HeatCell | null> = Array<HeatCell | null>(leading).fill(null);
  for (const cell of cells) {
    week.push(cell);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  let total = 0;
  let activeDays = 0;
  let max = 0;
  for (const cell of cells) {
    total += cell.count;
    if (cell.count > 0) activeDays++;
    if (cell.count > max) max = cell.count;
  }

  return { weeks, total, activeDays, max };
}

// ─── 스트릭 ───

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * 현재 연속일과 최장 연속일.
 *
 * 오늘 아직 안 했어도 어제까지 이어졌으면 현재 스트릭은 살아 있다 —
 * 하루가 끝나야 끊긴 것으로 본다.
 */
export function computeStreaks(activeDays: ReadonlySet<DateString>, today: DateString): Streaks {
  if (activeDays.size === 0) return { current: 0, longest: 0 };

  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (activeDays.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...activeDays].sort(compareDates);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = diffDays(sorted[i], sorted[i - 1]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

// ─── 주제별 정답률 ───

export interface TopicAccuracy {
  topic: Topic;
  total: number;
  correct: number;
  /** 백분율(정수). */
  percent: number;
}

/** 낮은 순으로 정렬해 돌려준다 — 약한 주제를 먼저 보라는 뜻이다. */
export function topicAccuracy(
  events: readonly ReviewEvent[],
  byId: ReadonlyMap<string, Question>,
): TopicAccuracy[] {
  const buckets = new Map<Topic, { total: number; correct: number }>();
  for (const e of events) {
    const q = byId.get(e.qid);
    if (!q) continue; // 문제은행에서 지운 문제의 로그는 뺀다
    const b = buckets.get(q.topic) ?? { total: 0, correct: 0 };
    b.total += 1;
    if (isCorrect(e.grade)) b.correct += 1;
    buckets.set(q.topic, b);
  }
  return [...buckets.entries()]
    .map(([topic, b]) => ({
      topic,
      total: b.total,
      correct: b.correct,
      percent: Math.round((b.correct / b.total) * 100),
    }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total);
}

// ─── 오답노트 ───

export interface LapseRow {
  question: Question;
  lapses: number;
  ease: number;
  due: DateString;
}

/** lapses 가 많은 순. 자주 잊는 카드가 곧 오답노트다. */
export function topLapses(
  states: readonly ReviewState[],
  byId: ReadonlyMap<string, Question>,
  limit = 10,
): LapseRow[] {
  return states
    .filter((s) => s.lapses > 0 && byId.has(s.qid))
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, limit)
    .map((s) => ({
      question: byId.get(s.qid) as Question,
      lapses: s.lapses,
      ease: s.ease,
      due: s.due,
    }));
}

// ─── 성숙도 ───

export interface Maturity {
  /** 아직 한 번도 안 본 카드. */
  fresh: number;
  /** 간격이 21일 미만. */
  learning: number;
  /** 간격이 21일 이상. */
  mature: number;
  /** 보류된 카드. 위 셋에 넣지 않고 따로 센다. */
  suspended: number;
  total: number;
}

export function maturity(
  questions: readonly Question[],
  states: readonly ReviewState[],
): Maturity {
  const byQid = new Map(states.map((s) => [s.qid, s]));
  let fresh = 0;
  let learning = 0;
  let mature = 0;
  let suspended = 0;

  for (const q of questions) {
    const s = byQid.get(q.id);
    if (!s) fresh++;
    else if (s.suspended) suspended++;
    else if (s.interval >= MATURE_INTERVAL_DAYS) mature++;
    else learning++;
  }

  return { fresh, learning, mature, suspended, total: questions.length };
}
