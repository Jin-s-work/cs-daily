'use client';

/**
 * 서버가 준 문제은행 위에 로컬 오버레이를 얹는다.
 *
 * 오버레이는 IndexedDB 에 있어 서버가 모른다. 그래서 병합은 브라우저에서만 할 수 있고,
 * 문항을 쓰는 화면은 전부 이 훅을 거쳐야 수정본이 반영된다.
 */

import { useEffect, useState } from 'react';
import { getOverrides } from '@/lib/db';
import { mergeQuestions } from '@/lib/overrides';
import type { Question } from '@/lib/schema';

export interface MergedQuestions {
  questions: Question[];
  /** 오버레이를 읽어 병합까지 끝났는지. false 면 아직 서버 것만 보고 있다. */
  ready: boolean;
  error: string | null;
  /** 오버레이를 다시 읽는다. 편집 후 호출한다. */
  refresh: () => void;
}

export function useMergedQuestions(base: Question[]): MergedQuestions {
  const [questions, setQuestions] = useState<Question[]>(base);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const overrides = await getOverrides();
        if (cancelled) return;
        setQuestions(mergeQuestions(base, overrides));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          // 오버레이를 못 읽어도 서버 문제은행으로는 공부할 수 있다.
          setQuestions(base);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base, tick]);

  return { questions, ready, error, refresh: () => setTick((n) => n + 1) };
}
