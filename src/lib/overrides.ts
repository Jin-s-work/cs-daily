/**
 * 로컬 오버레이. 브라우저에서 고친 문항을 Git 문제은행 위에 얹는다.
 *
 * 브라우저는 content/questions/*.json 에 쓸 수 없다. 그래서 수정본을 IndexedDB 에 두고
 * 읽을 때 병합한다. 레포에 반영하는 것은 '내보내기 → 붙여넣기 → 커밋' 이라는 사람 손을 거친다.
 * 오버레이는 그때까지의 임시 보관소이지 진실의 원본이 아니다.
 */

import type { Question } from './schema';

/** 같은 id 면 오버레이가 이긴다. 오버레이에만 있는 문항은 뒤에 붙는다. */
export function mergeQuestions(
  base: readonly Question[],
  overrides: readonly Question[],
): Question[] {
  if (overrides.length === 0) return [...base];

  const byId = new Map(overrides.map((q) => [q.id, q]));
  const merged = base.map((q) => byId.get(q.id) ?? q);

  const baseIds = new Set(base.map((q) => q.id));
  for (const q of overrides) {
    if (!baseIds.has(q.id)) merged.push(q);
  }
  return merged;
}

/**
 * 내보내기용 필드 순서. 스키마 선언 순서와 맞춘다.
 *
 * 순서를 고정하는 이유는 diff 다. 필드가 매번 다른 순서로 나오면 한 글자만 고쳐도
 * 커밋 diff 가 통째로 뒤집힌다.
 */
const FIELD_ORDER: Array<keyof Question> = [
  'id', 'topic', 'subtopic', 'difficulty', 'type',
  'question', 'answerShort', 'answerDeep',
  'keywords', 'followUps', 'choices', 'correct', 'refs', 'source',
];

function orderFields(question: Question): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) {
    const value = question[key];
    // 없는 선택 필드는 아예 넣지 않는다. `"answerDeep": null` 은 스키마가 거부한다.
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** 붙여넣기 좋은 JSON 문자열. 항목은 id 순, 필드는 스키마 순. */
export function toExportJson(questions: readonly Question[]): string {
  const sorted = [...questions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return `${JSON.stringify(sorted.map(orderFields), null, 2)}\n`;
}

/** 주제별로 갈라 내보낸다 — content/questions/<topic>.json 구조와 맞추기 위해서다. */
export function groupByTopic(questions: readonly Question[]): Map<string, Question[]> {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const list = groups.get(q.topic);
    if (list) list.push(q);
    else groups.set(q.topic, [q]);
  }
  return groups;
}
