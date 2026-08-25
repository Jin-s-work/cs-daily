'use client';

/**
 * 문항 편집기. 저장은 IndexedDB 의 오버레이로 간다.
 *
 * 레포의 JSON 을 직접 고치지 않는다 — 브라우저는 파일에 쓸 수 없다.
 * 여기서 고친 것은 '내보내기' 로 뽑아 레포에 붙여넣어야 영구히 남는다.
 */

import { useState } from 'react';
import { DIFFICULTY_LABELS, TOPICS } from '@/lib/config';
import { saveOverride } from '@/lib/db';
import { questionSchema, TOPIC_VALUES, type Question, type QuestionType, type Topic } from '@/lib/schema';

const TYPES: QuestionType[] = ['concept', 'mcq', 'ox', 'code'];

/** 새 문항의 빈 서식. id 는 사용자가 채운다. */
export function emptyQuestion(): Question {
  return {
    id: '', topic: 'os', subtopic: '', difficulty: 2, type: 'concept',
    question: '', answerShort: '', keywords: [],
  } as Question;
}

const field =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

export function QuestionEditor({
  initial,
  existingIds,
  onSaved,
  onCancel,
}: {
  initial: Question;
  /** 새 문항일 때 id 중복을 막기 위해 받는다. */
  existingIds: readonly string[];
  onSaved: (question: Question) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Question>(initial);
  const [keywords, setKeywords] = useState(initial.keywords.join(', '));
  const [choices, setChoices] = useState((initial.choices ?? []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isNew = initial.id === '';

  const candidate: Question = {
    ...draft,
    keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    ...(draft.type === 'mcq' || draft.type === 'ox'
      ? { choices: choices.split('\n').map((c) => c.trim()).filter(Boolean) }
      : { choices: undefined, correct: undefined }),
  };

  const parsed = questionSchema.safeParse(candidate);
  const duplicateId = isNew && existingIds.includes(candidate.id);

  async function save() {
    if (!parsed.success || duplicateId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveOverride(parsed.data);
      onSaved(parsed.data);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Question>(key: K, value: Question[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">주제</span>
          <select value={draft.topic} onChange={(e) => set('topic', e.target.value as Topic)} className={field}>
            {TOPIC_VALUES.map((t) => <option key={t} value={t}>{TOPICS[t]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">소주제</span>
          <input value={draft.subtopic} onChange={(e) => set('subtopic', e.target.value)}
            placeholder="process" className={field} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          id {isNew ? '— 한 번 정하면 바꾸지 않는다' : '(수정 불가)'}
        </span>
        <input
          value={draft.id}
          onChange={(e) => isNew && set('id', e.target.value.trim())}
          readOnly={!isNew}
          placeholder="os-process-001"
          className={`${field} font-mono text-xs ${isNew ? '' : 'text-muted'}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="mb-1 block text-xs text-muted">난이도</span>
          <div className="flex gap-1.5">
            {([1, 2, 3] as const).map((d) => (
              <button key={d} type="button" onClick={() => set('difficulty', d)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs ${
                  draft.difficulty === d ? 'border-accent bg-accent text-accent-fg' : 'border-border'
                }`}>
                {DIFFICULTY_LABELS[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">유형</span>
          <select value={draft.type} onChange={(e) => set('type', e.target.value as QuestionType)} className={field}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">질문</span>
        <textarea value={draft.question} onChange={(e) => set('question', e.target.value)} rows={2} className={field} />
      </label>

      {(draft.type === 'mcq' || draft.type === 'ox') && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">보기 (한 줄에 하나)</span>
            <textarea value={choices} onChange={(e) => setChoices(e.target.value)} rows={3} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">정답 번호 (1부터)</span>
            <input
              type="number" min={1}
              value={draft.correct === undefined ? '' : draft.correct + 1}
              onChange={(e) => {
                const n = Number(e.target.value);
                set('correct', Number.isFinite(n) && n >= 1 ? n - 1 : undefined);
              }}
              className={field}
            />
          </label>
        </>
      )}

      <label className="block">
        <span className="mb-1 block text-xs text-muted">짧은 답</span>
        <textarea value={draft.answerShort} onChange={(e) => set('answerShort', e.target.value)} rows={4} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">깊은 답 (선택)</span>
        <textarea value={draft.answerDeep ?? ''}
          onChange={(e) => set('answerDeep', e.target.value.trim() ? e.target.value : undefined)}
          rows={3} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">키워드 (쉼표로 구분)</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={field} />
      </label>

      {(!parsed.success || duplicateId) && (
        <ul className="space-y-0.5 text-xs text-amber-500">
          {duplicateId && <li>이미 있는 id 다</li>}
          {!parsed.success &&
            parsed.error.issues.slice(0, 4).map((i) => (
              <li key={`${i.path.join('.')}-${i.message}`}>
                {i.path.join('.') || '(전체)'}: {i.message}
              </li>
            ))}
        </ul>
      )}
      {saveError && <p className="text-xs text-red-500">저장 실패: {saveError}</p>}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm">
          취소
        </button>
        <button type="button" onClick={() => void save()}
          disabled={!parsed.success || duplicateId || saving}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-40">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
