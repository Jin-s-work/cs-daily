import { describe, expect, it } from 'vitest';
import { buildTodayQueue } from './queue';
import type { ReviewState } from './srs';
import type { Question } from './schema';

const TODAY = '2026-08-25';

function q(id: string, topic = 'os'): Question {
  return {
    id, topic: topic as Question['topic'], subtopic: 'test', difficulty: 1,
    type: 'concept', question: `질문 ${id}`, answerShort: `답 ${id}`, keywords: [],
  };
}

function state(qid: string, due: string, extra: Partial<ReviewState> = {}): ReviewState {
  return {
    qid, ease: 2.5, interval: 1, reps: 1, lapses: 0,
    due, suspended: false, updatedAt: 0, ...extra,
  };
}

/** 셔플을 끄고 순서를 확인하기 위한 고정 난수. */
const noShuffle = () => 0;

const osDeck = Array.from({ length: 100 }, (_, i) => q(`os-test-${String(i).padStart(3, '0')}`));

describe('buildTodayQueue — 복습', () => {
  it('due 가 오늘 이하인 카드만 넣는다', () => {
    const states = [
      state('os-test-000', '2026-08-24'),
      state('os-test-001', '2026-08-25'),
      state('os-test-002', '2026-08-26'),
    ];
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(2);
    expect(r.cards.slice(0, 2).map((c) => c.id).sort()).toEqual(['os-test-000', 'os-test-001']);
  });

  it('suspended 카드는 복습에도 신규에도 안 들어간다', () => {
    const states = [state('os-test-000', '2026-08-01', { suspended: true })];
    const r = buildTodayQueue(osDeck, states, TODAY, { newLimit: 100, rng: noShuffle });
    expect(r.reviewCount).toBe(0);
    expect(r.cards.some((c) => c.id === 'os-test-000')).toBe(false);
  });

  it('복습 상한 60 을 지키고 넘친 수를 알려준다', () => {
    const states = osDeck.map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(60);
    expect(r.overdueLeft).toBe(40);
    expect(r.newCount).toBe(0); // 자리가 남지 않았다
  });

  it('오래 밀린 카드를 먼저 고른다 (고른 뒤 순서는 섞인다)', () => {
    const states = [
      state('os-test-002', '2026-08-24'),
      state('os-test-003', '2026-08-01'),
      state('os-test-001', '2026-08-10'),
    ];
    const r = buildTodayQueue(osDeck, states, TODAY, { reviewLimit: 2, rng: noShuffle });
    expect(r.cards.map((c) => c.id).slice(0, 2).sort()).toEqual(['os-test-001', 'os-test-003']);
    expect(r.overdueLeft).toBe(1);
  });

  it('문제은행에서 사라진 문제의 상태는 무시한다', () => {
    const r = buildTodayQueue(osDeck, [state('deleted-999', '2026-01-01')], TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(0);
    expect(r.overdueLeft).toBe(0);
  });

  it('복습 카드를 섞는다', () => {
    const states = osDeck.slice(0, 20).map((card) => state(card.id, '2026-08-20'));
    const ordered = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    // rng 를 1 에 가깝게 주면 다른 순서가 나온다 — 셔플이 실제로 걸려 있다는 뜻.
    const shuffled = buildTodayQueue(osDeck, states, TODAY, { rng: () => 0.999 });
    expect(ordered.cards.map((c) => c.id)).not.toEqual(shuffled.cards.map((c) => c.id));
    expect(ordered.cards.map((c) => c.id).sort()).toEqual(shuffled.cards.map((c) => c.id).sort());
  });
});

describe('buildTodayQueue — 신규', () => {
  it('상태가 없는 카드를 신규 상한까지 넣고 복습 뒤에 배치한다', () => {
    const states = [state('os-test-000', '2026-08-20')];
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(1);
    expect(r.newCount).toBe(10);
    expect(r.cards[0].id).toBe('os-test-000'); // 복습이 앞
    expect(r.cards.length).toBe(11);
    expect(r.newLeft).toBe(89);
  });

  it('복습이 상한을 채우면 신규 자리가 없다', () => {
    const states = osDeck.slice(0, 60).map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(60);
    expect(r.newCount).toBe(0);
    expect(r.newLeft).toBe(40);
  });

  it('남는 자리가 신규 상한보다 적으면 자리만큼만 넣는다', () => {
    const states = osDeck.slice(0, 55).map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.reviewCount).toBe(55);
    expect(r.newCount).toBe(5); // 60 - 55
  });

  it('신규를 주제 라운드로빈으로 뽑는다', () => {
    const mixed = [
      ...Array.from({ length: 5 }, (_, i) => q(`os-a-${String(i).padStart(3, '0')}`, 'os')),
      ...Array.from({ length: 5 }, (_, i) => q(`db-a-${String(i).padStart(3, '0')}`, 'db')),
      ...Array.from({ length: 5 }, (_, i) => q(`net-a-${String(i).padStart(3, '0')}`, 'network')),
    ];
    const r = buildTodayQueue(mixed, [], TODAY, { newLimit: 6, rng: noShuffle });
    expect(r.cards.map((c) => c.topic)).toEqual(['os', 'db', 'network', 'os', 'db', 'network']);
  });

  it('한 주제가 바닥나도 남은 주제로 계속 채운다', () => {
    const mixed = [
      q('os-a-000', 'os'),
      ...Array.from({ length: 5 }, (_, i) => q(`db-a-${String(i).padStart(3, '0')}`, 'db')),
    ];
    const r = buildTodayQueue(mixed, [], TODAY, { newLimit: 4, rng: noShuffle });
    expect(r.cards.map((c) => c.id)).toEqual(['os-a-000', 'db-a-000', 'db-a-001', 'db-a-002']);
  });

  it('신규가 부족하면 있는 만큼만 넣는다', () => {
    const r = buildTodayQueue(osDeck.slice(0, 3), [], TODAY, { rng: noShuffle });
    expect(r.newCount).toBe(3);
    expect(r.newLeft).toBe(0);
  });

  it('빈 문제은행이면 빈 큐를 준다', () => {
    const r = buildTodayQueue([], [], TODAY, { rng: noShuffle });
    expect(r.cards).toEqual([]);
    expect(r.reviewCount).toBe(0);
    expect(r.newCount).toBe(0);
  });
});

describe('buildTodayQueue — 하루 상한 누적', () => {
  it('오늘 이미 한 신규 수를 상한에서 뺀다', () => {
    const r = buildTodayQueue(osDeck, [], TODAY, { newDoneToday: 7, rng: noShuffle });
    expect(r.newCount).toBe(3);
  });

  it('오늘 신규 상한을 다 썼으면 더 안 준다', () => {
    const r = buildTodayQueue(osDeck, [], TODAY, { newDoneToday: 10, rng: noShuffle });
    expect(r.newCount).toBe(0);
    expect(r.cards).toEqual([]);
  });

  it('상한을 넘겨 했어도 음수로 내려가지 않는다', () => {
    const r = buildTodayQueue(osDeck, [], TODAY, { newDoneToday: 99, rng: noShuffle });
    expect(r.newCount).toBe(0);
  });

  it('오늘 이미 한 복습 수를 복습 상한에서 뺀다', () => {
    const states = osDeck.map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, { reviewDoneToday: 50, rng: noShuffle });
    expect(r.reviewCount).toBe(10); // 60 - 50
    expect(r.overdueLeft).toBe(90);
  });

  it('평가를 마친 카드가 신규 자리를 다시 열어주지 않는다', () => {
    // 신규 10장을 끝낸 상황: 그 10장은 상태가 생겨 '신규'에서 빠지지만,
    // 그 자리를 아직 안 본 카드가 다시 채우면 하루 상한이 무의미해진다.
    const doneStates = osDeck.slice(0, 10).map((card) => state(card.id, '2026-08-26'));
    const r = buildTodayQueue(osDeck, doneStates, TODAY, {
      newDoneToday: 10,
      rng: noShuffle,
    });
    expect(r.newCount).toBe(0);
    expect(r.reviewCount).toBe(0);
  });
});

describe('buildTodayQueue — 하루 총량은 하나다', () => {
  it('신규로 끝낸 몫도 복습 자리를 줄인다', () => {
    // 신규 10장을 끝낸 뒤 복습이 60장 더 나오면 하루 70장이 된다. 총량은 60 하나다.
    const states = osDeck.map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, { newDoneToday: 10, rng: noShuffle });
    expect(r.reviewCount).toBe(50);
    expect(r.newCount).toBe(0);
  });

  it('복습과 신규를 섞어 끝냈어도 합쳐서 총량을 지킨다', () => {
    const states = osDeck.map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, {
      reviewDoneToday: 30,
      newDoneToday: 10,
      rng: noShuffle,
    });
    expect(r.reviewCount).toBe(20); // 60 - (30 + 10)
  });

  it('총량을 다 쓰면 아무것도 안 준다', () => {
    const states = osDeck.map((card) => state(card.id, '2026-08-20'));
    const r = buildTodayQueue(osDeck, states, TODAY, {
      reviewDoneToday: 55,
      newDoneToday: 5,
      rng: noShuffle,
    });
    expect(r.cards).toEqual([]);
    expect(r.reviewCount).toBe(0);
    expect(r.newCount).toBe(0);
  });
});

describe('buildTodayQueue — 밀린 카드가 먼저', () => {
  it('due 가 지난 카드를 오늘 due 카드보다 앞에 둔다', () => {
    const states = [
      state('os-test-000', TODAY),          // 오늘
      state('os-test-001', '2026-08-20'),   // 밀림
      state('os-test-002', TODAY),          // 오늘
      state('os-test-003', '2026-08-22'),   // 밀림
    ];
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    const ids = r.cards.slice(0, 4).map((c) => c.id);
    expect(ids.slice(0, 2).sort()).toEqual(['os-test-001', 'os-test-003']);
    expect(ids.slice(2, 4).sort()).toEqual(['os-test-000', 'os-test-002']);
  });

  it('시험에서 due 를 오늘로 당긴 카드는 다음 날 큐 앞쪽에 온다', () => {
    // 시험 당일 due=오늘 로 강제된 카드는, 다음 날이면 '밀린 카드' 가 된다.
    const tomorrow = '2026-08-26';
    const states = [
      state('os-test-005', tomorrow),  // 내일 예정된 평범한 복습
      state('os-test-009', TODAY),     // 어제 시험에서 틀려 당겨진 카드
    ];
    const r = buildTodayQueue(osDeck, states, tomorrow, { rng: noShuffle });
    expect(r.cards[0].id).toBe('os-test-009');
  });

  it('밀린 것과 오늘 것이 각각 섞인다 — 그룹 경계는 지킨다', () => {
    const states = [
      ...osDeck.slice(0, 10).map((c) => state(c.id, '2026-08-20')),
      ...osDeck.slice(10, 20).map((c) => state(c.id, TODAY)),
    ];
    const a = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    const b = buildTodayQueue(osDeck, states, TODAY, { rng: () => 0.999 });
    expect(a.cards.map((c) => c.id)).not.toEqual(b.cards.map((c) => c.id));
    // 어느 순서로 섞이든 앞 10장은 밀린 카드여야 한다.
    const overdueIds = new Set(osDeck.slice(0, 10).map((c) => c.id));
    for (const r of [a, b]) {
      expect(r.cards.slice(0, 10).every((c) => overdueIds.has(c.id))).toBe(true);
    }
  });
});

describe('buildTodayQueue — 배우기와 복습의 분리', () => {
  it('복습과 신규를 따로 돌려준다', () => {
    const states = [state('os-test-000', '2026-08-20')];
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.review.map((c) => c.id)).toEqual(['os-test-000']);
    expect(r.fresh.length).toBe(10);
    // 두 배열에 같은 카드가 겹쳐 들어가면 안 된다.
    const overlap = r.review.filter((c) => r.fresh.some((f) => f.id === c.id));
    expect(overlap).toEqual([]);
  });

  it('cards 는 복습 뒤에 신규를 이어 붙인 것과 같다', () => {
    const states = [state('os-test-000', '2026-08-20')];
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    expect(r.cards.map((c) => c.id)).toEqual(
      [...r.review, ...r.fresh].map((c) => c.id),
    );
  });

  it('한 번이라도 배운 카드는 신규에 다시 오지 않는다', () => {
    // 배우기를 마치면 상태가 생긴다. 그 뒤로는 복습 대상일 뿐이다.
    const states = osDeck.slice(0, 10).map((c) => state(c.id, '2026-08-26'));
    const r = buildTodayQueue(osDeck, states, TODAY, { rng: noShuffle });
    const learnedIds = new Set(states.map((s) => s.qid));
    expect(r.fresh.some((c) => learnedIds.has(c.id))).toBe(false);
  });
});
