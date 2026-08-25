/**
 * 간격 반복 스케줄러. SM-2 변형.
 *
 * 이 파일은 순수하다. React·Dexie·Date.now() 를 import 하지 않는다.
 * 오늘 날짜는 항상 인자로 받으므로, 같은 입력이면 언제 어디서 돌려도 같은 결과가 나온다.
 * 이 순수성이 D0~D201 회귀 테스트를 가능하게 하는 전제다.
 */

import { addDays, type DateString } from './date';

/** 카드를 본 뒤 누르는 버튼. 1=Again 2=Hard 3=Good 4=Easy. */
export type Grade = 1 | 2 | 3 | 4;

export const GRADES: readonly Grade[] = [1, 2, 3, 4];

/** 등급 라벨. 버튼과 통계가 같은 문자열을 쓴다. */
export const GRADE_LABELS: Record<Grade, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

/**
 * 카드 한 장의 학습 상태. IndexedDB 에 저장되는 형태 그대로다.
 * 문제 본문은 여기 들어오지 않는다 — 문제은행과 학습 상태는 분리한다.
 */
export type ReviewState = {
  /** Question.id. 영구 불변이며 이 상태의 주키다. */
  qid: string;
  /** 용이도. 클수록 간격이 빨리 늘어난다. */
  ease: number;
  /** 현재 간격(일). 아직 한 번도 평가하지 않았으면 0. */
  interval: number;
  /** 연속 성공 횟수. Again 을 누르면 0으로 돌아간다. */
  reps: number;
  /** Again 을 누른 누적 횟수. */
  lapses: number;
  /** 다음에 볼 날짜. */
  due: DateString;
  /** 보류된 카드는 큐에 넣지 않는다. */
  suspended: boolean;
  /** 마지막으로 누른 등급. 한 번도 안 봤으면 없음. */
  lastGrade?: Grade;
  /** 마지막 갱신 시각(epoch ms). 아래 주석 참고. */
  updatedAt: number;
};

const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MAX_INTERVAL = 365;

/** grade 2~4 의 ease 증감. Again(1)은 별도 규칙이라 여기 없다. */
const EASE_DELTA: Record<2 | 3 | 4, number> = {
  2: -0.15,
  3: 0,
  4: 0.15,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * today 의 로컬 자정을 epoch ms 로. updatedAt 에 쓴다.
 *
 * Date.now() 를 못 쓰기 때문에(순수 함수) 시:분:초는 담을 수 없다. 정확한 시각이
 * 필요한 곳은 reviewLogs.reviewedAt 이고, 이 값은 '어느 날 갱신됐나' 까지만 뜻한다.
 */
function midnightMs(today: DateString): number {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** 아직 한 번도 평가하지 않은 카드의 상태. 오늘부터 바로 대상이 된다. */
export function initialState(qid: string, today: DateString): ReviewState {
  return {
    qid,
    ease: INITIAL_EASE,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: today,
    suspended: false,
    updatedAt: midnightMs(today),
  };
}

/**
 * 채점 결과를 반영한 새 상태를 돌려준다. 인자로 받은 s 는 건드리지 않는다.
 *
 * Again(1): ease 를 0.2 깎고 간격을 1일로 되돌린다. reps 는 0, lapses 는 +1.
 * 2~4: ease 를 먼저 조정하고 reps 를 올린 다음, 올라간 reps 로 간격을 정한다.
 *      ease 를 먼저 반영하는 순서가 중요하다 — Easy 를 누른 그 회차부터 늘어난 ease 가 쓰인다.
 */
export function schedule(s: ReviewState, grade: Grade, today: DateString): ReviewState {
  if (grade === 1) {
    return {
      ...s,
      ease: Math.max(MIN_EASE, s.ease - 0.2),
      interval: 1,
      reps: 0,
      lapses: s.lapses + 1,
      due: addDays(today, 1),
      lastGrade: 1,
      updatedAt: midnightMs(today),
    };
  }

  const ease = clamp(s.ease + EASE_DELTA[grade], MIN_EASE, MAX_EASE);
  const reps = s.reps + 1;

  let interval: number;
  if (reps === 1) {
    interval = 1;
  } else if (reps === 2) {
    interval = 6;
  } else if (grade === 2) {
    // 최소 하루는 늘어나야 한다. interval 이 작을 때 1.2배는 반올림에서 제자리가 된다.
    interval = Math.max(Math.round(s.interval * 1.2), s.interval + 1);
  } else if (grade === 3) {
    interval = Math.round(s.interval * ease);
  } else {
    interval = Math.round(s.interval * ease * 1.3);
  }

  interval = Math.min(interval, MAX_INTERVAL);

  return {
    ...s,
    ease,
    interval,
    reps,
    due: addDays(today, interval),
    lastGrade: grade,
    updatedAt: midnightMs(today),
  };
}

/**
 * 버튼마다 다음 간격이 며칠인지 미리 계산한다. 상태를 바꾸지 않는다.
 * 화면의 'Good / 38일' 표시가 실제 채점 결과와 어긋나지 않도록 schedule 을 그대로 돌린다.
 */
export function preview(s: ReviewState, today: DateString): Record<Grade, number> {
  return {
    1: schedule(s, 1, today).interval,
    2: schedule(s, 2, today).interval,
    3: schedule(s, 3, today).interval,
    4: schedule(s, 4, today).interval,
  };
}
