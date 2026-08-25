'use client';

/**
 * 문제은행 브라우저 겸 관리 화면.
 *
 * 문항은 서버가 준 Git 문제은행 + 로컬 오버레이를 병합해 보여준다.
 * 편집·리셋·정지는 전부 IndexedDB 에만 남는다 — 레포에 넣으려면 '내보내기' 를 거쳐야 한다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMergedQuestions } from '@/hooks/useMergedQuestions';
import { TOPICS } from '@/lib/config';
import { getAllStates, getOverrides, resetCard, restoreState, toggleSuspend } from '@/lib/db';
import type { Question, Topic } from '@/lib/schema';
import type { ReviewState } from '@/lib/srs';
import { ExportPanel } from './manage/ExportPanel';
import { emptyQuestion, QuestionEditor } from './QuestionEditor';
import { QuestionCard } from './QuestionCard';
import { UndoToast, type ToastState } from './UndoToast';

/** 검색 대상 필드를 한 문자열로 합쳐 둔다. 매 입력마다 다시 만들지 않도록 미리 계산한다. */
function haystack(q: Question): string {
  return [q.id, q.subtopic, q.question, q.answerShort, q.answerDeep ?? '', ...q.keywords]
    .join(' ')
    .toLowerCase();
}

export function QuestionBrowser({
  questions: base,
  initialQuery = '',
  today,
}: {
  questions: Question[];
  initialQuery?: string;
  today: string;
}) {
  const { questions, refresh } = useMergedQuestions(base);
  const [topic, setTopic] = useState<Topic | 'all'>('all');
  const [query, setQuery] = useState(initialQuery);
  const [states, setStates] = useState<Map<string, ReviewState>>(new Map());
  const [overrideIds, setOverrideIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Question | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 카드 상태와 오버레이 목록을 다시 읽는 신호. 편집·리셋·정지 뒤에 올린다.
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rows, overrides] = await Promise.all([getAllStates(), getOverrides()]);
        if (cancelled) return;
        setStates(new Map(rows.map((s) => [s.qid, s])));
        setOverrideIds(new Set(overrides.map((q) => q.id)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const indexed = useMemo(() => questions.map((q) => ({ q, text: haystack(q) })), [questions]);

  const topicCounts = useMemo(() => {
    const counts = new Map<Topic, number>();
    for (const q of questions) counts.set(q.topic, (counts.get(q.topic) ?? 0) + 1);
    return counts;
  }, [questions]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indexed
      .filter(({ q }) => topic === 'all' || q.topic === topic)
      .filter(({ text }) => needle === '' || text.includes(needle))
      .map(({ q }) => q);
  }, [indexed, topic, query]);

  const overrides = useMemo(
    () => questions.filter((q) => overrideIds.has(q.id)),
    [questions, overrideIds],
  );

  const handleReset = useCallback(
    async (q: Question) => {
      try {
        const removed = await resetCard(q.id);
        reload();
        if (!removed) return;
        setToast({
          key: Date.now(),
          message: `"${q.question.slice(0, 20)}…" 복습 이력을 지웠다`,
          onUndo: async () => {
            await restoreState(removed);
            reload();
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload],
  );

  const handleSuspend = useCallback(
    async (q: Question) => {
      try {
        const suspended = await toggleSuspend(q.id, today);
        reload();
        setToast({
          key: Date.now(),
          message: suspended ? '정지했다 — 큐에 나오지 않는다' : '정지를 풀었다',
          onUndo: async () => {
            await toggleSuspend(q.id, today);
            reload();
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [reload, today],
  );

  if (editing) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium">{editing.id === '' ? '새 문항' : '문항 편집'}</h2>
        <QuestionEditor
          initial={editing}
          existingIds={questions.map((q) => q.id)}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
            reload();
          }}
        />
      </div>
    );
  }

  const chips: Array<{ key: Topic | 'all'; label: string; count: number }> = [
    { key: 'all', label: '전체', count: questions.length },
    ...[...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, count]) => ({ key: t, label: TOPICS[t], count })),
  ];

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="질문·답·키워드·id 검색"
          aria-label="문제 검색"
          className="min-w-0 flex-1 card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button type="button" onClick={() => setEditing(emptyQuestion())}
          className="shrink-0 btn btn-primary">
          새 문항
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button key={chip.key} type="button" onClick={() => setTopic(chip.key)}
            aria-pressed={topic === chip.key}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              topic === chip.key
                ? 'bg-accent text-accent-fg font-medium'
                : 'bg-surface-2 text-muted hover:text-foreground'
            }`}>
            {chip.label} {chip.count}
          </button>
        ))}
      </div>

      <ExportPanel overrides={overrides} />

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">{error}</p>
      )}

      <p className="mt-4 text-xs text-muted" aria-live="polite">
        {visible.length}문항
        {(query.trim() !== '' || topic !== 'all') && ` (전체 ${questions.length})`}
      </p>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">조건에 맞는 문항이 없다.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visible.map((q) => {
            const state = states.get(q.id);
            return (
              <QuestionCard
                key={q.id}
                question={q}
                suspended={state?.suspended ?? false}
                hasHistory={state !== undefined}
                overridden={overrideIds.has(q.id)}
                defaultOpen={visible.length === 1 && initialQuery !== ''}
                actions={{
                  onEdit: () => setEditing(q),
                  onReset: () => void handleReset(q),
                  onToggleSuspend: () => void handleSuspend(q),
                }}
              />
            );
          })}
        </ul>
      )}

      {toast && <UndoToast key={toast.key} toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
