/**
 * 오늘 풀 카드를 고른다. 순수 함수다 — 오늘 날짜와 셔플용 난수를 인자로 받는다.
 *
 * 여기서 하는 일은 '고르기'와 '순서 정하기'뿐이다. 채점은 srs.ts, 저장은 db.ts 가 한다.
 */

import { MAX_NEW_PER_DAY, MAX_REVIEW_PER_DAY } from './config';
import { compareDates, isDue, type DateString } from './date';
import type { ReviewState } from './srs';
import type { Question } from './schema';

export interface TodayQueue {
  /** 실제로 넘길 순서. 복습(셔플됨)이 먼저, 신규가 뒤. */
  cards: Question[];
  /** cards 중 복습 카드 수. */
  reviewCount: number;
  /** cards 중 신규 카드 수. */
  newCount: number;
  /** 오늘 기한이 지났지만 상한에 걸려 못 넣은 복습 수. */
  overdueLeft: number;
  /** 아직 한 번도 안 꺼낸 카드 수(오늘 꺼낸 것 제외). */
  newLeft: number;
}

export interface QueueOptions {
  reviewLimit?: number;
  newLimit?: number;
  /**
   * 오늘 이미 끝낸 신규 카드 수. 상한에서 뺀다.
   *
   * 이게 없으면 하루 상한이 무의미해진다 — 신규 10장을 끝내면 그 카드들은 상태가 생겨
   * '신규'에서 빠지고, 그 자리를 아직 안 본 카드가 다시 10장 채운다. 하루에 몇 번이든
   * 새 카드를 계속 꺼낼 수 있게 되고, 그만큼 내일치 복습 빚이 늘어난다.
   */
  newDoneToday?: number;
  /** 오늘 이미 끝낸 복습 수. 같은 이유로 상한에서 뺀다. */
  reviewDoneToday?: number;
  /** 0 이상 1 미만을 주는 난수원. 테스트에서 고정하려고 주입받는다. */
  rng?: () => number;
}

/** Fisher-Yates. 원본을 건드리지 않는다. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * 주제를 번갈아 가며 뽑는다. 한 주제가 연달아 10장 나오면 그날 공부가 편식이 된다.
 * 주제 순서는 문제은행에 나온 순서를 따르고, 각 주제 안에서도 원래 순서를 지킨다.
 */
function roundRobinByTopic(questions: readonly Question[], limit: number): Question[] {
  const buckets = new Map<string, Question[]>();
  for (const q of questions) {
    const bucket = buckets.get(q.topic);
    if (bucket) bucket.push(q);
    else buckets.set(q.topic, [q]);
  }

  const lists = [...buckets.values()];
  const picked: Question[] = [];
  let cursor = 0;

  while (picked.length < limit) {
    let tookAny = false;
    for (const list of lists) {
      if (cursor >= list.length) continue;
      picked.push(list[cursor]);
      tookAny = true;
      if (picked.length === limit) return picked;
    }
    if (!tookAny) break; // 모든 주제가 바닥났다
    cursor++;
  }

  return picked;
}

/**
 * 오늘의 큐.
 *
 * 하루 총량은 reviewLimit(60)이다. 복습을 먼저 채우고 '남는 자리'에 신규를
 * newLimit(10)까지 넣는다. 그래서 밀린 복습이 60장이면 신규는 0장이 된다 —
 * 밀린 걸 두고 새 카드를 계속 꺼내면 빚만 늘어난다.
 */
export function buildTodayQueue(
  questions: readonly Question[],
  states: readonly ReviewState[],
  today: DateString,
  options: QueueOptions = {},
): TodayQueue {
  const reviewDone = options.reviewDoneToday ?? 0;
  const newDone = options.newDoneToday ?? 0;

  // 하루 총량은 reviewLimit(60) 한 개다. 오늘 끝낸 것은 복습이든 신규든 똑같이 총량을 쓴다.
  // 신규 몫을 총량에서 빼지 않으면 '신규 10 + 복습 60 = 70장' 이 되어 상한이 새어 나간다.
  const doneToday = reviewDone + newDone;
  const totalLimit = Math.max(0, (options.reviewLimit ?? MAX_REVIEW_PER_DAY) - doneToday);
  const newLimit = Math.max(0, (options.newLimit ?? MAX_NEW_PER_DAY) - newDone);
  const rng = options.rng ?? Math.random;

  const byId = new Map<string, Question>();
  for (const q of questions) byId.set(q.id, q);

  const stateById = new Map<string, ReviewState>();
  for (const s of states) stateById.set(s.qid, s);

  // 문제은행에서 지운 문제의 상태가 남아 있을 수 있다. 조용히 건너뛴다.
  const dueStates = states
    .filter((s) => !s.suspended && byId.has(s.qid) && isDue(s.due, today))
    .sort(
      (a, b) =>
        compareDates(a.due, b.due) ||
        b.lapses - a.lapses ||
        (a.qid < b.qid ? -1 : a.qid > b.qid ? 1 : 0),
    );

  const reviewPicked = dueStates.slice(0, totalLimit);

  // 밀린 카드(due < 오늘)를 오늘 카드보다 앞에 둔다. 각 그룹 안에서만 섞는다.
  //
  // 통째로 섞으면 며칠 밀린 카드가 큐 끝으로 밀려 또 안 하게 되고, 시험에서 틀려
  // due 를 앞당긴 카드도 앞에 온다는 보장이 사라진다. 순서에 의미를 주되
  // 같은 급함끼리는 섞어서 문항 순서를 외우지 않게 한다.
  const overdue = reviewPicked.filter((s) => s.due < today);
  const dueNow = reviewPicked.filter((s) => s.due >= today);
  const toQuestion = (list: readonly ReviewState[]) =>
    shuffle(list.map((s) => byId.get(s.qid) as Question), rng);
  const review = [...toQuestion(overdue), ...toQuestion(dueNow)];

  // suspended 카드는 아직 안 본 카드가 아니다. 상태가 있으면 신규가 아니다.
  const unseen = questions.filter((q) => !stateById.has(q.id));
  const roomLeft = Math.max(0, totalLimit - review.length);
  const fresh = roundRobinByTopic(unseen, Math.min(newLimit, roomLeft));

  return {
    cards: [...review, ...fresh],
    reviewCount: review.length,
    newCount: fresh.length,
    overdueLeft: Math.max(0, dueStates.length - review.length),
    newLeft: Math.max(0, unseen.length - fresh.length),
  };
}
