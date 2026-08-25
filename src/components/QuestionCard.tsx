'use client';

import { useState } from 'react';
import { DIFFICULTY_LABELS, TYPE_LABELS } from '@/lib/config';
import type { Question } from '@/lib/schema';

export interface CardActions {
  onEdit: () => void;
  onReset: () => void;
  onToggleSuspend: () => void;
}

/** 접힌 상태에서는 질문만, 펼치면 답과 부가 정보를 보여준다. */
export function QuestionCard({
  question,
  suspended = false,
  hasHistory = false,
  overridden = false,
  actions,
  defaultOpen = false,
}: {
  question: Question;
  /** 보류된 카드인지. 배지로 표시한다. */
  suspended?: boolean;
  /** 복습 이력이 있는지. 없으면 '리셋' 이 의미가 없다. */
  hasHistory?: boolean;
  /** 로컬 오버레이로 덮인 문항인지. */
  overridden?: boolean;
  actions?: CardActions;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-relaxed font-medium">{question.question}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <code className="rounded bg-surface-2 px-1.5 py-0.5">{question.id}</code>
            <span className="rounded bg-surface-2 px-1.5 py-0.5">{question.subtopic}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5">
              {DIFFICULTY_LABELS[question.difficulty]}
            </span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5">
              {TYPE_LABELS[question.type] ?? question.type}
            </span>
            {overridden && (
              <span className="rounded bg-accent/20 px-1.5 py-0.5 text-accent">수정됨</span>
            )}
            {suspended && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-500">보류</span>
            )}
          </span>
        </span>
        <span className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 text-sm leading-relaxed">
          {question.choices && (
            <ol className="mb-3 space-y-1">
              {question.choices.map((choice, i) => (
                <li
                  key={`${i}-${choice}`}
                  className={i === question.correct ? 'font-medium text-accent' : 'text-muted'}
                >
                  {i + 1}. {choice}
                  {i === question.correct && ' ✓'}
                </li>
              ))}
            </ol>
          )}

          <p>{question.answerShort}</p>

          {question.answerDeep && (
            <p className="mt-3 border-l-2 border-border pl-3 text-muted">{question.answerDeep}</p>
          )}

          {question.followUps && question.followUps.length > 0 && (
            <div className="mt-3">
              <div className="text-xs font-medium text-muted">꼬리 질문</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                {question.followUps.map((f, i) => (
                  <li key={`${i}-${f}`}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {question.refs && question.refs.length > 0 && (
            <ul className="mt-3 space-y-0.5">
              {question.refs.map((ref) => (
                <li key={ref.url}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline underline-offset-2"
                  >
                    {ref.title}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {question.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {question.keywords.map((k, i) => (
                <span key={`${i}-${k}`} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {k}
                </span>
              ))}
            </div>
          )}

          {actions && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
              <button type="button" onClick={actions.onEdit}
                className="card-flat px-2.5 py-1.5 hover:bg-surface-2">
                편집
              </button>
              <button type="button" onClick={actions.onReset} disabled={!hasHistory}
                title={hasHistory ? undefined : '복습 이력이 없다'}
                className="card-flat px-2.5 py-1.5 enabled:hover:bg-surface-2 disabled:opacity-40">
                복습 리셋
              </button>
              <button type="button" onClick={actions.onToggleSuspend}
                className={`rounded-lg border px-2.5 py-1.5 ${
                  suspended ? 'border-amber-500 text-amber-500' : 'border-border hover:bg-surface-2'
                }`}>
                {suspended ? '정지 해제' : '정지'}
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
