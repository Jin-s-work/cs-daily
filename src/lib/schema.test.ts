import { describe, expect, it } from 'vitest';
import { questionSchema } from './schema';

const base = {
  id: 'os-process-001',
  topic: 'os',
  subtopic: 'process',
  difficulty: 1,
  type: 'concept',
  question: '프로세스와 스레드의 차이는?',
  answerShort: '주소 공간을 공유하는지가 다르다.',
  keywords: ['프로세스'],
};

describe('questionSchema', () => {
  it('필수 필드만 있으면 통과한다', () => {
    expect(questionSchema.safeParse(base).success).toBe(true);
  });

  it('id 형식을 강제한다', () => {
    const bad = ['os-0001', 'OS-process-001', 'os-process-1', 'osprocess001', 'os-process-0001'];
    for (const id of bad) {
      expect(questionSchema.safeParse({ ...base, id }).success).toBe(false);
    }
    expect(questionSchema.safeParse({ ...base, id: 'os-io-multiplex-012' }).success).toBe(true);
  });

  it('id 접두사와 topic 이 어긋나면 거부한다', () => {
    const r = questionSchema.safeParse({ ...base, id: 'db-index-001' });
    expect(r.success).toBe(false);
  });

  it('difficulty 는 1~3 만 받는다', () => {
    expect(questionSchema.safeParse({ ...base, difficulty: 0 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, difficulty: 4 }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, difficulty: 3 }).success).toBe(true);
  });

  it('mcq 와 ox 는 choices 와 correct 를 요구한다', () => {
    for (const type of ['mcq', 'ox'] as const) {
      expect(questionSchema.safeParse({ ...base, type }).success).toBe(false);
      expect(
        questionSchema.safeParse({ ...base, type, choices: ['가', '나'], correct: 1 }).success,
      ).toBe(true);
    }
  });

  it('concept 은 choices 가 없어도 된다', () => {
    expect(questionSchema.safeParse({ ...base, type: 'concept' }).success).toBe(true);
  });

  it('correct 가 choices 범위를 벗어나면 거부한다', () => {
    const r = questionSchema.safeParse({
      ...base, type: 'mcq', choices: ['가', '나'], correct: 2,
    });
    expect(r.success).toBe(false);
  });

  it('keywords·choices·followUps 에 같은 값이 두 번 오면 거부한다', () => {
    expect(questionSchema.safeParse({ ...base, keywords: ['a', 'a'] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, followUps: ['q', 'q'] }).success).toBe(false);
    expect(
      questionSchema.safeParse({ ...base, type: 'mcq', choices: ['가', '가'], correct: 0 }).success,
    ).toBe(false);
    // 서로 다른 값이면 통과한다.
    expect(questionSchema.safeParse({ ...base, keywords: ['a', 'b'] }).success).toBe(true);
  });

  it('refs 의 url 형식을 검사한다', () => {
    expect(
      questionSchema.safeParse({ ...base, refs: [{ title: 'x', url: 'not-a-url' }] }).success,
    ).toBe(false);
    expect(
      questionSchema.safeParse({ ...base, refs: [{ title: 'x', url: 'https://a.com/b' }] }).success,
    ).toBe(true);
  });
});
