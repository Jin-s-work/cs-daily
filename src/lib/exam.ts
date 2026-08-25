/**
 * 모의 시험. 순수 함수다 — 오늘 날짜와 난수를 인자로 받는다.
 *
 * 드릴(간격 반복)과 일부러 갈라 놓았다. 시험은 '지금 아는지'를 재고,
 * 드릴은 '언제 다시 볼지'를 정한다. 다만 시험에서 틀린 것은 드릴 일정에 되먹임된다.
 */

import { addDays, type DateString } from './date';
import type { Question, Topic } from './schema';
import { initialState, type ReviewState } from './srs';

export const EXAM_COUNTS = [10, 20, 30] as const;
export type ExamCount = (typeof EXAM_COUNTS)[number];

/** 타이머를 켰을 때 문항당 제한 시간(초). */
export const SECONDS_PER_QUESTION = 90;

/** 시험에서 틀렸을 때 깎는 용이도. */
export const WRONG_EASE_PENALTY = 0.15;

/** srs 와 같은 하한을 쓴다. 여기서만 다르면 카드가 두 규칙 사이에서 흔들린다. */
const MIN_EASE = 1.3;

export interface ExamConfig {
  /** 빈 배열이면 주제를 가리지 않는다. */
  topics: Topic[];
  count: ExamCount;
  /** 빈 배열이면 난이도를 가리지 않는다. */
  difficulties: Array<1 | 2 | 3>;
  timer: boolean;
}

export const DEFAULT_EXAM_CONFIG: ExamConfig = {
  topics: [],
  count: 20,
  difficulties: [],
  timer: false,
};

/** 자가 채점 3단계. 객관식·OX 는 자동 채점되므로 쓰이지 않는다. */
export type SelfGrade = 'correct' | 'partial' | 'wrong';

export interface ExamAnswer {
  qid: string;
  /** 객관식·OX 에서 고른 보기 인덱스. 안 골랐으면 없음. */
  choice?: number;
  /** 서술형에 쓴 답. 채점에는 쓰지 않고 결과 화면에서 되돌아볼 때만 쓴다. */
  text?: string;
  /** 서술형 자가 채점. */
  selfGrade?: SelfGrade;
  msSpent: number;
}

/** 보기를 고르는 유형인가. 이 유형만 자동 채점된다. */
export function isAutoGraded(question: Question): boolean {
  return question.type === 'mcq' || question.type === 'ox';
}

/**
 * 한 문항의 점수. 맞음 1, 애매 0.5, 틀림 0.
 *
 * 애매를 0.5로 둔 이유: 자가 채점에서 '반쯤 말했다'가 실제로 가장 흔하고,
 * 그걸 0이나 1로 몰면 총점이 실제 실력과 멀어진다.
 */
export function scoreOf(question: Question, answer: ExamAnswer | undefined): number {
  if (!answer) return 0;
  if (isAutoGraded(question)) {
    return answer.choice !== undefined && answer.choice === question.correct ? 1 : 0;
  }
  if (answer.selfGrade === 'correct') return 1;
  if (answer.selfGrade === 'partial') return 0.5;
  return 0;
}

/**
 * 오답 처리 대상인가 — 다음 드릴 큐를 앞당길 문항.
 *
 * '애매'는 여기 넣지 않는다. 스펙이 정한 것은 '틀린 문항'이고, 애매까지 끌어오면
 * 시험 한 번에 큐가 통째로 밀려온다. 애매는 결과 화면의 오답 목록에는 남는다.
 */
export function isWrong(question: Question, answer: ExamAnswer | undefined): boolean {
  if (!answer) return true;
  if (isAutoGraded(question)) {
    return answer.choice === undefined || answer.choice !== question.correct;
  }
  return answer.selfGrade === 'wrong';
}

/** 결과 화면의 '오답 목록'에 넣을 것 — 틀림과 애매를 모두 담는다. */
export function needsReview(question: Question, answer: ExamAnswer | undefined): boolean {
  return scoreOf(question, answer) < 1;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 시험에 낼 문항을 고른다.
 *
 * 필터를 통과한 것 중에서 무작위로 count 개. 요청한 수보다 적으면 있는 만큼만 낸다 —
 * 조건을 억지로 넓혀서 원하지 않은 주제를 섞지 않는다.
 */
export function pickExamQuestions(
  questions: readonly Question[],
  config: ExamConfig,
  rng: () => number = Math.random,
): Question[] {
  const pool = questions.filter((q) => {
    if (config.topics.length > 0 && !config.topics.includes(q.topic)) return false;
    if (config.difficulties.length > 0 && !config.difficulties.includes(q.difficulty)) return false;
    return true;
  });
  return shuffle(pool, rng).slice(0, config.count);
}

/**
 * 시험에서 틀린 카드의 복습 일정을 앞당긴다.
 *
 * due 를 오늘로 당기고 ease 를 깎는다. interval·reps 는 건드리지 않는다 —
 * 시험은 채점이 아니라 '지금 모른다'는 신호이고, 간격 계산의 이력은 드릴이 갖고 있다.
 * 다음 날 드릴에서 이 카드는 '밀린 카드' 가 되어 큐 앞쪽에 온다.
 */
export function applyExamPenalty(
  state: ReviewState | undefined,
  qid: string,
  today: DateString,
): ReviewState {
  const base = state ?? initialState(qid, today);
  return {
    ...base,
    // 오늘로 두면 오늘 드릴에서도 바로 나오고, 내일이면 밀린 카드가 된다.
    due: today,
    ease: Math.max(MIN_EASE, base.ease - WRONG_EASE_PENALTY),
    // 보류된 카드였다면 시험에서 틀린 이상 다시 굴려야 한다.
    suspended: false,
  };
}

export interface ExamSummary {
  total: number;
  /** 맞음 1 · 애매 0.5 로 더한 점수. */
  score: number;
  /** 백분율(정수). */
  percent: number;
  wrongIds: string[];
  reviewIds: string[];
  byTopic: Array<{ topic: Topic; total: number; score: number; percent: number }>;
}

/** 결과 집계. 화면과 저장이 같은 계산을 쓰도록 한 곳에 둔다. */
export function summarize(
  questions: readonly Question[],
  answers: ReadonlyMap<string, ExamAnswer>,
): ExamSummary {
  let score = 0;
  const wrongIds: string[] = [];
  const reviewIds: string[] = [];
  const topics = new Map<Topic, { total: number; score: number }>();

  for (const q of questions) {
    const answer = answers.get(q.id);
    const s = scoreOf(q, answer);
    score += s;
    if (isWrong(q, answer)) wrongIds.push(q.id);
    if (needsReview(q, answer)) reviewIds.push(q.id);

    const bucket = topics.get(q.topic) ?? { total: 0, score: 0 };
    bucket.total += 1;
    bucket.score += s;
    topics.set(q.topic, bucket);
  }

  const total = questions.length;
  return {
    total,
    score,
    percent: total === 0 ? 0 : Math.round((score / total) * 100),
    wrongIds,
    reviewIds,
    byTopic: [...topics.entries()]
      .map(([topic, b]) => ({
        topic,
        total: b.total,
        score: b.score,
        percent: Math.round((b.score / b.total) * 100),
      }))
      .sort((a, b) => a.percent - b.percent),
  };
}

/** 타이머를 켰을 때 이 시험의 전체 제한 시간(ms). */
export function timeLimitMs(count: number): number {
  return count * SECONDS_PER_QUESTION * 1000;
}

/** 내일 날짜. 결과 화면에서 '내일 드릴에 나온다'를 보여줄 때 쓴다. */
export function tomorrow(today: DateString): DateString {
  return addDays(today, 1);
}
