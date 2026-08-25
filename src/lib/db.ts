'use client';

/**
 * IndexedDB 계층. 학습 상태와 복습 로그만 담는다 — 문제 본문은 여기 들어오지 않는다.
 *
 * 브라우저 전용이다. 서버 컴포넌트에서 import 하면 indexedDB 가 없어 터진다.
 */

import Dexie, { type EntityTable } from 'dexie';
import { todayStr } from './date';
import type { ExamAnswer, ExamConfig } from './exam';
import type { Question } from './schema';
import type { Grade, ReviewState } from './srs';

/**
 * 평가 한 번의 기록. prev 를 통째로 들고 있어서 되돌리기(U)가 가능하다.
 * 되돌릴 때 계산을 역산하지 않는다 — Again 은 정보를 잃어서 역산이 불가능하다.
 */
export interface ReviewLog {
  id?: number;
  qid: string;
  grade: Grade;
  /** 실제 평가 시각(epoch ms). ReviewState.updatedAt 과 달리 시:분까지 담긴다. */
  reviewedAt: number;
  /** 카드를 보고 평가하기까지 걸린 시간(ms). */
  msSpent: number;
  /** 평가 직전의 상태. 신규 카드면 initialState 결과가 들어간다. */
  prev: ReviewState;
}

/** 북마크한 기사. 기사 본문은 담지 않는다 — 어느 날 파일에 있는지만 기억한다. */
export interface Bookmark {
  /** NewsItem.id (정규화 URL 의 sha1). */
  newsId: string;
  /** 그 기사가 들어 있는 content/news 파일의 날짜. 다시 찾을 때 쓴다. */
  day: string;
  createdAt: number;
}

/** 시험 한 회차의 기록. 문항 본문은 담지 않는다 — qid 로 문제은행을 찾는다. */
export interface ExamResult {
  id: number;
  startedAt: number;
  finishedAt: number;
  msSpent: number;
  config: ExamConfig;
  answers: ExamAnswer[];
  /** 맞음 1 · 애매 0.5 로 더한 점수. */
  score: number;
  total: number;
  percent: number;
}

/** 브라우저에서 고친 문항. 같은 id 의 Git 문항 위에 얹힌다. */
export interface QuestionOverride {
  id: string;
  question: Question;
  updatedAt: number;
}

const db = new Dexie('cs-daily-drill') as Dexie & {
  reviewStates: EntityTable<ReviewState, 'qid'>;
  reviewLogs: EntityTable<ReviewLog, 'id'>;
  bookmarks: EntityTable<Bookmark, 'newsId'>;
  examResults: EntityTable<ExamResult, 'id'>;
  questionOverrides: EntityTable<QuestionOverride, 'id'>;
};

db.version(1).stores({
  // 주키 qid + 조회에 쓰는 인덱스. boolean 은 IndexedDB 키가 될 수 없어서
  // suspended 는 아래 toStored/fromStored 에서 0/1 로 바꿔 저장한다.
  reviewStates: 'qid, due, suspended',
  reviewLogs: '++id, qid, reviewedAt',
});

// Phase 2 에서 북마크가 붙었다. 기존 두 테이블은 그대로 두고 새 테이블만 더한다 —
// version 을 올리면 이미 저장된 학습 이력은 건드리지 않고 스키마만 확장된다.
db.version(2).stores({
  bookmarks: 'newsId, day, createdAt',
});

// Phase 3: 시험 기록과 문항 오버레이.
db.version(3).stores({
  examResults: '++id, finishedAt',
  questionOverrides: 'id, updatedAt',
});

/** IndexedDB 는 boolean 을 인덱싱하지 못한다. 저장 시 0/1 로 눕힌다. */
type StoredState = Omit<ReviewState, 'suspended'> & { suspended: 0 | 1 };

function toStored(s: ReviewState): StoredState {
  return { ...s, suspended: s.suspended ? 1 : 0 };
}

function fromStored(s: StoredState): ReviewState {
  return { ...s, suspended: s.suspended === 1 };
}

export async function getAllStates(): Promise<ReviewState[]> {
  const rows = (await db.reviewStates.toArray()) as unknown as StoredState[];
  return rows.map(fromStored);
}

export async function getState(qid: string): Promise<ReviewState | undefined> {
  const row = (await db.reviewStates.get(qid)) as unknown as StoredState | undefined;
  return row ? fromStored(row) : undefined;
}

/**
 * 평가 하나를 기록한다. 상태 저장과 로그 적재를 한 트랜잭션으로 묶어,
 * 로그만 남고 상태가 안 바뀌는(또는 그 반대) 어긋남을 막는다.
 */
export async function recordReview(params: {
  next: ReviewState;
  prev: ReviewState;
  grade: Grade;
  msSpent: number;
  reviewedAt: number;
}): Promise<void> {
  const { next, prev, grade, msSpent, reviewedAt } = params;
  await db.transaction('rw', db.reviewStates, db.reviewLogs, async () => {
    await db.reviewStates.put(toStored(next) as unknown as ReviewState);
    await db.reviewLogs.add({ qid: next.qid, grade, reviewedAt, msSpent, prev });
  });
}

/**
 * 가장 최근 평가를 되돌린다. 되돌린 로그는 지운다.
 * 되돌릴 것이 없으면 null 을 준다.
 */
export async function undoLastReview(): Promise<ReviewLog | null> {
  return db.transaction('rw', db.reviewStates, db.reviewLogs, async () => {
    const last = await db.reviewLogs.orderBy('id').last();
    if (!last?.id) return null;

    if (last.prev.reps === 0 && last.prev.interval === 0 && last.prev.lapses === 0) {
      // 신규 카드의 첫 평가였다. 상태 자체를 없애 다시 '신규'로 돌린다.
      await db.reviewStates.delete(last.qid);
    } else {
      await db.reviewStates.put(toStored(last.prev) as unknown as ReviewState);
    }
    await db.reviewLogs.delete(last.id);
    return last;
  });
}

/** 북마크한 기사 id 전부. */
export async function getBookmarkIds(): Promise<Set<string>> {
  const rows = await db.bookmarks.toArray();
  return new Set(rows.map((b) => b.newsId));
}

/** 북마크를 켜고 끈다. 켜졌으면 true 를 돌려준다. */
export async function toggleBookmark(newsId: string, day: string): Promise<boolean> {
  return db.transaction('rw', db.bookmarks, async () => {
    const existing = await db.bookmarks.get(newsId);
    if (existing) {
      await db.bookmarks.delete(newsId);
      return false;
    }
    await db.bookmarks.add({ newsId, day, createdAt: Date.now() });
    return true;
  });
}

/** 로그 하나가 '한 번도 안 본 카드'의 첫 평가였는지. 하루 신규 상한을 셀 때 쓴다. */
export function wasNewCard(log: ReviewLog): boolean {
  return log.prev.reps === 0 && log.prev.interval === 0 && log.prev.lapses === 0;
}

export interface TodayCounts {
  newDone: number;
  reviewDone: number;
}

/**
 * 오늘 이미 끝낸 신규·복습 수. buildTodayQueue 가 상한에서 빼는 데 쓴다.
 * undo 로 로그를 지우면 이 값도 같이 줄어든다 — 되돌린 카드는 다시 오늘 몫이 된다.
 */
export async function countDoneToday(today: string, tz = 'Asia/Seoul'): Promise<TodayCounts> {
  const logs = await getAllLogs();

  // 상한의 단위는 '카드 장수'다. Again 을 눌러 같은 카드를 세션 안에서 다시 봐도
  // 로그는 두 줄이 되지만 오늘 몫은 한 장이다. qid 로 묶어서 센다.
  const newIds = new Set<string>();
  const reviewIds = new Set<string>();
  for (const log of logs) {
    if (todayStr(tz, new Date(log.reviewedAt)) !== today) continue;
    if (wasNewCard(log)) newIds.add(log.qid);
    else reviewIds.add(log.qid);
  }
  // 신규로 처음 본 카드가 같은 날 Again 재출제로 또 나오면 양쪽에 잡힌다. 신규 쪽만 센다.
  for (const id of newIds) reviewIds.delete(id);

  return { newDone: newIds.size, reviewDone: reviewIds.size };
}

// ─── 시험 ───

/** 시험 한 회차를 저장하고, 틀린 카드의 복습 일정을 함께 앞당긴다. */
export async function saveExamResult(
  result: Omit<ExamResult, 'id'>,
  penalties: readonly ReviewState[],
): Promise<number> {
  return db.transaction('rw', db.examResults, db.reviewStates, async () => {
    for (const state of penalties) {
      await db.reviewStates.put(toStored(state) as unknown as ReviewState);
    }
    return db.examResults.add(result);
  });
}

/** 최근 시험부터. */
export async function getExamResults(limit = 20): Promise<ExamResult[]> {
  return db.examResults.orderBy('finishedAt').reverse().limit(limit).toArray();
}

// ─── 문항 오버레이 ───

export async function getOverrides(): Promise<Question[]> {
  const rows = await db.questionOverrides.toArray();
  return rows.map((r) => r.question);
}

export async function saveOverride(question: Question): Promise<void> {
  await db.questionOverrides.put({ id: question.id, question, updatedAt: Date.now() });
}

export async function deleteOverride(id: string): Promise<void> {
  await db.questionOverrides.delete(id);
}

// ─── 카드 관리 ───

/**
 * 복습 이력을 지운다. 그 카드는 다시 '신규' 가 된다.
 * 되돌리기를 위해 지우기 전 상태를 돌려준다.
 */
export async function resetCard(qid: string): Promise<ReviewState | null> {
  return db.transaction('rw', db.reviewStates, async () => {
    const row = (await db.reviewStates.get(qid)) as unknown as StoredState | undefined;
    if (!row) return null;
    await db.reviewStates.delete(qid);
    return fromStored(row);
  });
}

/** 지운 상태를 되돌려 놓는다. */
export async function restoreState(state: ReviewState): Promise<void> {
  await db.reviewStates.put(toStored(state) as unknown as ReviewState);
}

/** 보류를 켜고 끈다. 상태가 없으면 만들어서 켠다. 켜졌으면 true. */
export async function toggleSuspend(qid: string, today: string): Promise<boolean> {
  return db.transaction('rw', db.reviewStates, async () => {
    const row = (await db.reviewStates.get(qid)) as unknown as StoredState | undefined;
    const current: ReviewState = row
      ? fromStored(row)
      : { qid, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today, suspended: false, updatedAt: Date.now() };
    const next = { ...current, suspended: !current.suspended };
    await db.reviewStates.put(toStored(next) as unknown as ReviewState);
    return next.suspended;
  });
}

/** 로그를 오래된 순으로. 스트릭과 통계가 쓴다. */
export async function getAllLogs(): Promise<ReviewLog[]> {
  return db.reviewLogs.orderBy('reviewedAt').toArray();
}

/** 특정 시각 이후의 로그. 오늘 몇 장 했는지 셀 때 쓴다. */
export async function getLogsSince(since: number): Promise<ReviewLog[]> {
  return db.reviewLogs.where('reviewedAt').aboveOrEqual(since).toArray();
}

export { db };
