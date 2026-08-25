'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import type { Question } from '@/lib/schema';
import { GRADES, type Grade } from '@/lib/srs';
import { CardBack } from './CardBack';
import { CardPrompt } from './CardPrompt';
import { DoneScreen } from './DoneScreen';
import { DrillHeader } from './DrillHeader';
import { GradeBar } from './GradeBar';
import { useDrillSession } from './useDrillSession';

/**
 * 오버레이 병합이 끝난 뒤에 세션을 연다.
 *
 * 병합 전 목록으로 큐를 만들면 수정한 문항이 옛 내용으로 나오고, 큐가 도중에 다시 짜인다.
 * 훅은 조건부로 부를 수 없으니 한 겹 감싸서 '준비된 뒤에만 마운트' 로 푼다.
 */
export function DrillClient({ questions: base, today }: { questions: Question[]; today: string }) {
  const { questions, ready } = useMergedQuestions(base);
  if (!ready) return <p className="py-20 text-center text-sm text-muted">불러오는 중…</p>;
  return <DrillRunner questions={questions} today={today} />;
}

function DrillRunner({ questions, today }: { questions: Question[]; today: string }) {
  const s = useDrillSession(questions, today);
  const router = useRouter();

  // 키보드: Space 뒤집기, 1~4 평가, U 되돌리기, E 편집.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // 메모를 타이핑하는 중이면 단축키가 가로채면 안 된다.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'u' || e.key === 'U') {
        if (s.canUndo) {
          e.preventDefault();
          s.undo();
        }
        return;
      }
      if (s.phase !== 'running' || !s.card) return;

      if (e.code === 'Space') {
        e.preventDefault();
        s.flip();
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        router.push(`/manage?q=${encodeURIComponent(s.card.id)}`);
        return;
      }
      const n = Number(e.key);
      if (GRADES.includes(n as Grade)) {
        if (!s.flipped) return; // 답을 안 보고 평가하는 것은 막는다
        e.preventDefault();
        s.grade(n as Grade);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s, router]);

  if (s.phase === 'loading') {
    return <p className="py-20 text-center text-sm text-muted">불러오는 중…</p>;
  }

  if (s.phase === 'empty') {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-sm text-muted">
          {s.error ? `학습 기록을 못 읽었다: ${s.error}` : '오늘 복습할 카드가 없다. 배우기에서 새 개념을 열어 보자.'}
        </p>
      </div>
    );
  }

  if (s.phase === 'done') {
    return (
      <DoneScreen reviewed={s.reviewedCount} correct={s.correctCount} elapsedMs={s.elapsedMs} />
    );
  }

  if (!s.card || !s.intervals) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <DrillHeader index={s.index} total={s.total} />

      {s.error && (
        <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
          저장 중 문제가 생겼다: {s.error}
        </p>
      )}

      {/* lg 미만: 한 단. lg 이상: 왼쪽 질문+메모 / 오른쪽 모범답안. */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <section className="card p-5">
          <CardPrompt question={s.card} />

          <textarea
            value={s.note}
            onChange={(e) => s.setNote(e.target.value)}
            placeholder="답을 먼저 적어 보세요 (저장하지 않습니다)"
            rows={5}
            className="mt-4 hidden w-full resize-y card-flat bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent lg:block"
          />

          {!s.flipped && (
            <button
              type="button"
              onClick={s.flip}
              className="mt-4 w-full btn btn-primary"
            >
              답 보기 <span className="opacity-70">(Space)</span>
            </button>
          )}
        </section>

        <section className="mt-4 lg:mt-0">
          {s.flipped ? (
            <div className="card p-5">
              <CardBack question={s.card} />
            </div>
          ) : (
            <div className="hidden h-full items-center justify-center rounded-xl border border-dashed border-border p-5 text-sm text-muted lg:flex">
              Space 를 누르면 모범답안이 나온다
            </div>
          )}
        </section>
      </div>

      {s.flipped && (
        <div className="mt-4">
          <GradeBar intervals={s.intervals} onGrade={s.grade} />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
        <span>Space 뒤집기 · 1~4 평가 · U 되돌리기 · E 편집</span>
        <button
          type="button"
          onClick={s.undo}
          disabled={!s.canUndo}
          className="rounded px-2 py-1 enabled:hover:bg-surface-2 enabled:hover:text-foreground disabled:opacity-40"
        >
          되돌리기
        </button>
      </div>
    </div>
  );
}
