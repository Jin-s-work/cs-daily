import { describe, expect, it } from 'vitest';
import { groupByTopic, mergeQuestions, toExportJson } from './overrides';
import { questionSchema, type Question } from './schema';

function q(id: string, over: Partial<Question> = {}): Question {
  return {
    id, topic: 'os', subtopic: 't', difficulty: 1, type: 'concept',
    question: `질문 ${id}`, answerShort: `답 ${id}`, keywords: [], ...over,
  } as Question;
}

describe('mergeQuestions', () => {
  it('같은 id 면 오버레이가 이긴다', () => {
    const base = [q('os-a-001'), q('os-a-002')];
    const over = [q('os-a-001', { question: '고친 질문' })];
    const merged = mergeQuestions(base, over);
    expect(merged.length).toBe(2);
    expect(merged.find((x) => x.id === 'os-a-001')?.question).toBe('고친 질문');
    expect(merged.find((x) => x.id === 'os-a-002')?.question).toBe('질문 os-a-002');
  });

  it('원래 순서를 지킨다', () => {
    const base = [q('os-a-001'), q('os-a-002'), q('os-a-003')];
    const merged = mergeQuestions(base, [q('os-a-002', { question: 'x' })]);
    expect(merged.map((x) => x.id)).toEqual(['os-a-001', 'os-a-002', 'os-a-003']);
  });

  it('오버레이에만 있는 문항은 뒤에 붙는다', () => {
    const merged = mergeQuestions([q('os-a-001')], [q('os-new-001')]);
    expect(merged.map((x) => x.id)).toEqual(['os-a-001', 'os-new-001']);
  });

  it('오버레이가 비면 원본 그대로', () => {
    const base = [q('os-a-001')];
    expect(mergeQuestions(base, [])).toEqual(base);
  });

  it('원본 배열을 변형하지 않는다', () => {
    const base = [q('os-a-001')];
    const snapshot = JSON.stringify(base);
    mergeQuestions(base, [q('os-a-001', { question: 'x' })]);
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe('toExportJson', () => {
  it('id 순으로 정렬한다', () => {
    const json = JSON.parse(toExportJson([q('os-b-001'), q('os-a-001')]));
    expect(json.map((x: Question) => x.id)).toEqual(['os-a-001', 'os-b-001']);
  });

  it('필드를 스키마 순서대로 낸다', () => {
    const json = toExportJson([q('os-a-001', { source: 'manual', answerDeep: '깊은 답' })]);
    const keys = Object.keys(JSON.parse(json)[0]);
    expect(keys).toEqual([
      'id', 'topic', 'subtopic', 'difficulty', 'type',
      'question', 'answerShort', 'answerDeep', 'keywords', 'source',
    ]);
  });

  it('없는 선택 필드는 넣지 않는다 — null 은 스키마가 거부한다', () => {
    const parsed = JSON.parse(toExportJson([q('os-a-001')]))[0];
    expect('answerDeep' in parsed).toBe(false);
    expect('choices' in parsed).toBe(false);
  });

  it('내보낸 JSON 이 스키마를 통과한다', () => {
    const items = [
      q('os-a-001'),
      q('os-b-001', { type: 'mcq', choices: ['가', '나'], correct: 1, source: 'manual' }),
    ];
    for (const item of JSON.parse(toExportJson(items))) {
      expect(questionSchema.safeParse(item).success).toBe(true);
    }
  });

  it('줄바꿈으로 끝난다 — 파일에 붙여넣기 좋게', () => {
    expect(toExportJson([q('os-a-001')]).endsWith('\n')).toBe(true);
  });
});

describe('groupByTopic', () => {
  it('주제별로 가른다', () => {
    const groups = groupByTopic([
      q('os-a-001'), q('db-a-001', { topic: 'db' }), q('os-a-002'),
    ]);
    expect([...groups.keys()].sort()).toEqual(['db', 'os']);
    expect(groups.get('os')?.length).toBe(2);
  });
});
