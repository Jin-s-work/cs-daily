/** 튜닝 가능한 숫자와 라벨은 전부 여기에 모은다. 로직 파일에 상수를 흩뿌리지 않는다. */

import type { Topic } from './schema';

/** 하루에 보여줄 복습 카드 상한. */
export const MAX_REVIEW_PER_DAY = 60;

/** 하루에 새로 꺼낼 카드 상한. */
export const MAX_NEW_PER_DAY = 10;

/** 주제 코드 → 화면에 쓸 한국어 라벨. */
export const TOPICS: Record<Topic, string> = {
  network: '네트워크',
  os: '운영체제',
  db: '데이터베이스',
  ds: '자료구조',
  algo: '알고리즘',
  lang: '언어·런타임',
  web: '웹',
  arch: '아키텍처',
  devops: '데브옵스',
  ai: 'AI·ML',
};

/** 난이도 라벨. */
export const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: '기초',
  2: '중급',
  3: '심화',
};

/** 문제 유형 라벨. */
export const TYPE_LABELS: Record<string, string> = {
  concept: '개념',
  mcq: '객관식',
  ox: 'OX',
  code: '코드',
};

// ─── 아래는 간격 반복(Phase 1) 계수. Phase 0 화면에서는 쓰지 않는다. ───

/** 새 카드의 시작 용이도. SM-2 의 초기값을 그대로 쓴다. */
export const INITIAL_EASE = 2.5;

/** 용이도 하한. 이 아래로 내려가면 간격이 사실상 늘지 않아 카드가 영원히 돌아온다. */
export const MIN_EASE = 1.3;

/** 용이도 상한. */
export const MAX_EASE = 3.0;

/** 간격 상한(일). 1년 넘게 안 보는 카드는 사실상 삭제된 것과 같다. */
export const MAX_INTERVAL_DAYS = 365;

/** 'good' 을 처음 눌렀을 때의 간격(일). */
export const FIRST_INTERVAL_DAYS = 1;

/** 'good' 을 두 번째로 눌렀을 때의 간격(일). */
export const SECOND_INTERVAL_DAYS = 3;

/** 등급별 용이도 증감. */
export const EASE_DELTA = {
  again: -0.20,
  hard: -0.15,
  good: 0,
  easy: 0.15,
} as const;

/** 'hard' 일 때 기존 간격에 곱하는 값. */
export const HARD_MULTIPLIER = 1.2;

/** 'easy' 일 때 'good' 결과에 추가로 곱하는 값. */
export const EASY_BONUS = 1.3;
