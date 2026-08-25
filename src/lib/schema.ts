/**
 * 문제은행 JSON 의 유일한 진실. 외부 데이터는 반드시 여기를 통과한 뒤에 쓴다.
 *
 * Question 타입을 손으로 또 적지 않는다 — 스키마에서 추론한다.
 * 스키마와 타입이 따로 놀면 Zod 를 통과한 값이 타입과 어긋나는 일이 생긴다.
 */

import { z } from 'zod';

/** 같은 값이 두 번 들어간 배열을 막는다. 중복은 데이터 오류이고, 화면에서 key 충돌을 낳는다. */
function noDuplicates<T>(label: string) {
  return (items: T[], ctx: z.RefinementCtx) => {
    const seen = new Set<T>();
    items.forEach((item, i) => {
      if (seen.has(item)) {
        ctx.addIssue({ code: 'custom', path: [i], message: `${label}에 같은 값이 두 번 있다` });
      }
      seen.add(item);
    });
  };
}

/** 주제 코드. 파일명(content/questions/<topic>.json)과 맞춘다. */
export const TOPIC_VALUES = [
  'network', 'os', 'db', 'ds', 'algo', 'lang', 'web', 'arch', 'devops', 'ai',
] as const;

export const topicSchema = z.enum(TOPIC_VALUES);
export type Topic = z.infer<typeof topicSchema>;

export const questionTypeSchema = z.enum(['concept', 'mcq', 'ox', 'code']);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/**
 * id 형식: <주제>-<소주제>-<3자리 일련번호>. 예: os-process-001
 *
 * 한 번 발급한 id 는 어떤 이유로도 바꾸지 않는다. 오타를 고치거나 주제를 옮길 때도
 * id 는 그대로 둔다. id 가 바뀌면 IndexedDB 의 복습 이력과 연결이 끊긴다.
 */
export const ID_PATTERN = /^[a-z]+-[a-z0-9-]+-\d{3}$/;

const refSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});

export const questionSchema = z
  .object({
    id: z.string().regex(ID_PATTERN, "id 형식은 '<주제>-<소주제>-<3자리>' 여야 한다 (예: os-process-001)"),
    topic: topicSchema,
    subtopic: z.string().min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)], {
      error: 'difficulty 는 1(기초), 2(중급), 3(심화) 중 하나여야 한다',
    }),
    type: questionTypeSchema,
    question: z.string().min(1),
    /** 30초 안에 말할 수 있는 분량의 답. 카드 앞면을 뒤집으면 이게 보인다. */
    answerShort: z.string().min(1),
    /** 꼬리 질문까지 대비한 긴 설명. 없어도 된다. */
    answerDeep: z.string().min(1).optional(),
    keywords: z.array(z.string().min(1)).superRefine(noDuplicates('keywords')),
    followUps: z.array(z.string().min(1)).superRefine(noDuplicates('followUps')).optional(),
    choices: z.array(z.string().min(1)).superRefine(noDuplicates('choices')).optional(),
    correct: z.number().int().nonnegative().optional(),
    refs: z.array(refSchema).optional(),
    source: z.enum(['seed', 'manual', 'news']).optional(),
  })
  .superRefine((q, ctx) => {
    const needsChoices = q.type === 'mcq' || q.type === 'ox';

    if (needsChoices) {
      if (!q.choices || q.choices.length < 2) {
        ctx.addIssue({
          code: 'custom',
          path: ['choices'],
          message: `type '${q.type}' 이면 choices 가 2개 이상 필요하다`,
        });
      }
      if (q.correct === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['correct'],
          message: `type '${q.type}' 이면 correct 가 필요하다`,
        });
      }
    }

    // 정답 인덱스가 보기 범위를 벗어나면 화면에서 조용히 undefined 가 된다. 여기서 막는다.
    if (q.correct !== undefined && q.choices && q.correct >= q.choices.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['correct'],
        message: `correct=${q.correct} 가 choices 개수(${q.choices.length})를 벗어난다`,
      });
    }

    // id 접두사와 topic 이 어긋나면 파일 분류가 틀어진다.
    if (!q.id.startsWith(`${q.topic}-`)) {
      ctx.addIssue({
        code: 'custom',
        path: ['id'],
        message: `id 는 topic('${q.topic}')으로 시작해야 한다`,
      });
    }
  });

export type Question = z.infer<typeof questionSchema>;

/** 파일 하나의 내용. 최상위는 항상 배열이다. */
export const questionFileSchema = z.array(questionSchema);
