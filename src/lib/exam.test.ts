import { describe, expect, it } from 'vitest';
import {
  applyExamPenalty, isAutoGraded, isWrong, needsReview,
  pickExamQuestions, scoreOf, summarize, timeLimitMs,
  type ExamAnswer, type ExamConfig,
} from './exam';
import type { Question } from './schema';
import type { ReviewState } from './srs';

const TODAY = '2026-08-25';

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id, topic: 'os', subtopic: 'test', difficulty: 2, type: 'concept',
    question: `질문 ${id}`, answerShort: `답 ${id}`, keywords: [], ...over,
  } as Question;
}
const mcq = (id: string) =>
  q(id, { type: 'mcq', choices: ['가', '나', '다'], correct: 1 });
const ox = (id: string) => q(id, { type: 'ox', choices: ['O', 'X'], correct: 0 });

const cfg = (over: Partial<ExamConfig> = {}): ExamConfig => ({
  topics: [], count: 20, difficulties: [], timer: false, ...over,
});
const answer = (over: Partial<ExamAnswer> = {}): ExamAnswer => ({
  qid: 'x', msSpent: 1000, ...over,
});

describe('isAutoGraded', () => {
  it('mcq 와 ox 만 자동 채점한다', () => {
    expect(isAutoGraded(mcq('os-a-001'))).toBe(true);
    expect(isAutoGraded(ox('os-a-002'))).toBe(true);
    expect(isAutoGraded(q('os-a-003'))).toBe(false);
    expect(isAutoGraded(q('os-a-004', { type: 'code' }))).toBe(false);
  });
});

describe('scoreOf', () => {
  it('객관식은 정답 인덱스와 맞아야 1점', () => {
    expect(scoreOf(mcq('a'), answer({ choice: 1 }))).toBe(1);
    expect(scoreOf(mcq('a'), answer({ choice: 0 }))).toBe(0);
    expect(scoreOf(mcq('a'), answer({}))).toBe(0);
  });

  it('자가 채점은 맞음 1 · 애매 0.5 · 틀림 0', () => {
    expect(scoreOf(q('a'), answer({ selfGrade: 'correct' }))).toBe(1);
    expect(scoreOf(q('a'), answer({ selfGrade: 'partial' }))).toBe(0.5);
    expect(scoreOf(q('a'), answer({ selfGrade: 'wrong' }))).toBe(0);
  });

  it('답이 없으면 0점', () => {
    expect(scoreOf(q('a'), undefined)).toBe(0);
    expect(scoreOf(mcq('a'), undefined)).toBe(0);
  });
});

describe('isWrong / needsReview', () => {
  it('애매는 오답 처리 대상이 아니지만 오답 목록에는 남는다', () => {
    const partial = answer({ selfGrade: 'partial' });
    expect(isWrong(q('a'), partial)).toBe(false);
    expect(needsReview(q('a'), partial)).toBe(true);
  });

  it('틀림과 무응답은 둘 다 오답 처리 대상', () => {
    expect(isWrong(q('a'), answer({ selfGrade: 'wrong' }))).toBe(true);
    expect(isWrong(q('a'), undefined)).toBe(true);
    expect(isWrong(mcq('a'), answer({ choice: 2 }))).toBe(true);
  });

  it('맞으면 둘 다 false', () => {
    expect(isWrong(mcq('a'), answer({ choice: 1 }))).toBe(false);
    expect(needsReview(mcq('a'), answer({ choice: 1 }))).toBe(false);
  });
});

describe('pickExamQuestions', () => {
  const pool = [
    ...Array.from({ length: 30 }, (_, i) => q(`os-a-${String(i).padStart(3, '0')}`)),
    ...Array.from({ length: 10 }, (_, i) =>
      q(`db-a-${String(i).padStart(3, '0')}`, { topic: 'db', difficulty: 3 })),
  ];

  it('요청한 수만큼 고른다', () => {
    expect(pickExamQuestions(pool, cfg({ count: 10 }), () => 0).length).toBe(10);
  });

  it('주제 필터를 지킨다', () => {
    const picked = pickExamQuestions(pool, cfg({ topics: ['db'] }), () => 0);
    expect(picked.every((x) => x.topic === 'db')).toBe(true);
  });

  it('난이도 필터를 지킨다', () => {
    const picked = pickExamQuestions(pool, cfg({ difficulties: [3] }), () => 0);
    expect(picked.every((x) => x.difficulty === 3)).toBe(true);
  });

  it('조건에 맞는 게 부족하면 있는 만큼만 낸다 — 다른 주제를 섞지 않는다', () => {
    const picked = pickExamQuestions(pool, cfg({ topics: ['db'], count: 30 }), () => 0);
    expect(picked.length).toBe(10);
    expect(picked.every((x) => x.topic === 'db')).toBe(true);
  });

  it('빈 필터는 전체를 대상으로 한다', () => {
    expect(pickExamQuestions(pool, cfg({ count: 30 }), () => 0).length).toBe(30);
  });

  it('섞는다', () => {
    const a = pickExamQuestions(pool, cfg({ count: 30 }), () => 0).map((x) => x.id);
    const b = pickExamQuestions(pool, cfg({ count: 30 }), () => 0.999).map((x) => x.id);
    expect(a).not.toEqual(b);
  });
});

describe('applyExamPenalty', () => {
  const state: ReviewState = {
    qid: 'os-a-001', ease: 2.5, interval: 30, reps: 5,
    lapses: 1, due: '2026-09-20', suspended: false, updatedAt: 0,
  };

  it('due 를 오늘로 당기고 ease 를 0.15 깎는다', () => {
    const next = applyExamPenalty(state, 'os-a-001', TODAY);
    expect(next.due).toBe(TODAY);
    expect(next.ease).toBeCloseTo(2.35, 10);
  });

  it('interval 과 reps 는 건드리지 않는다', () => {
    const next = applyExamPenalty(state, 'os-a-001', TODAY);
    expect(next.interval).toBe(30);
    expect(next.reps).toBe(5);
    expect(next.lapses).toBe(1);
  });

  it('ease 하한 1.3 을 뚫지 않는다', () => {
    let s: ReviewState = { ...state, ease: 1.3 };
    for (let i = 0; i < 5; i++) s = applyExamPenalty(s, s.qid, TODAY);
    expect(s.ease).toBe(1.3);
  });

  it('상태가 없던 신규 카드도 처리한다', () => {
    const next = applyExamPenalty(undefined, 'os-a-999', TODAY);
    expect(next.qid).toBe('os-a-999');
    expect(next.due).toBe(TODAY);
    expect(next.ease).toBeCloseTo(2.35, 10);
  });

  it('보류된 카드는 다시 굴린다', () => {
    const next = applyExamPenalty({ ...state, suspended: true }, 'os-a-001', TODAY);
    expect(next.suspended).toBe(false);
  });

  it('원본을 변형하지 않는다', () => {
    const snapshot = JSON.stringify(state);
    applyExamPenalty(state, 'os-a-001', TODAY);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('summarize', () => {
  const questions = [mcq('os-a-001'), q('os-a-002'), q('db-a-001', { topic: 'db' })];

  it('점수·백분율·오답 목록을 낸다', () => {
    const answers = new Map<string, ExamAnswer>([
      ['os-a-001', answer({ qid: 'os-a-001', choice: 1 })],            // 1점
      ['os-a-002', answer({ qid: 'os-a-002', selfGrade: 'partial' })], // 0.5점
      ['db-a-001', answer({ qid: 'db-a-001', selfGrade: 'wrong' })],   // 0점
    ]);
    const s = summarize(questions, answers);
    expect(s.total).toBe(3);
    expect(s.score).toBe(1.5);
    expect(s.percent).toBe(50);
    expect(s.wrongIds).toEqual(['db-a-001']);
    expect(s.reviewIds).toEqual(['os-a-002', 'db-a-001']);
  });

  it('주제별 정답률을 낮은 순으로 준다', () => {
    const answers = new Map<string, ExamAnswer>([
      ['os-a-001', answer({ qid: 'os-a-001', choice: 1 })],
      ['os-a-002', answer({ qid: 'os-a-002', selfGrade: 'correct' })],
      ['db-a-001', answer({ qid: 'db-a-001', selfGrade: 'wrong' })],
    ]);
    const s = summarize(questions, answers);
    expect(s.byTopic[0]).toMatchObject({ topic: 'db', percent: 0 });
    expect(s.byTopic[1]).toMatchObject({ topic: 'os', percent: 100 });
  });

  it('답을 하나도 안 내면 0점이고 전부 오답', () => {
    const s = summarize(questions, new Map());
    expect(s.score).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.wrongIds.length).toBe(3);
  });

  it('빈 시험은 0으로 나눈 결과를 내지 않는다', () => {
    expect(summarize([], new Map()).percent).toBe(0);
  });
});

describe('timeLimitMs', () => {
  it('문항당 90초', () => {
    expect(timeLimitMs(20)).toBe(20 * 90 * 1000);
  });
});
