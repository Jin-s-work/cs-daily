'use client';

/**
 * 5초 동안 떠 있는 되돌리기 토스트.
 *
 * 복습 리셋과 정지는 되돌릴 수 없는 것처럼 보이지만 실제로는 되돌릴 수 있다.
 * 확인 대화상자로 손을 붙잡는 대신, 일단 실행하고 무를 기회를 준다.
 */

import { useEffect, useRef, useState } from 'react';

export const UNDO_WINDOW_MS = 5000;

export interface ToastState {
  /** 같은 동작을 연달아 해도 타이머가 새로 도는 데 쓴다. */
  key: number;
  message: string;
  onUndo: () => void | Promise<void>;
}

export function UndoToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(UNDO_WINDOW_MS);
  const undone = useRef(false);

  // 이 컴포넌트는 부모가 toast.key 로 리마운트한다. 그래서 남은 시간을 여기서
  // 초기화할 필요가 없다 — 새 토스트는 곧 새 인스턴스다.
  useEffect(() => {
    if (!toast) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const left = UNDO_WINDOW_MS - (Date.now() - startedAt);
      if (left <= 0) {
        clearInterval(timer);
        onDismiss();
      } else {
        setRemaining(left);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-20 z-20 mx-auto flex max-w-md items-center gap-3 card px-4 py-3 shadow-lg md:bottom-6"
    >
      <span className="min-w-0 flex-1 text-sm">{toast.message}</span>
      <span className="text-xs text-muted tabular-nums">{Math.ceil(remaining / 1000)}초</span>
      <button
        type="button"
        onClick={() => {
          if (undone.current) return;
          undone.current = true;
          void toast.onUndo();
          onDismiss();
        }}
        className="shrink-0 btn btn-primary !py-1.5 !text-xs"
      >
        되돌리기
      </button>
    </div>
  );
}
