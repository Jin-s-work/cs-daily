'use client';

import { DIFFICULTY_LABELS, TOPICS, TYPE_LABELS } from '@/lib/config';
import type { Question } from '@/lib/schema';

/** 질문과 배지. 앞면과 데스크톱 2단의 왼쪽에서 같은 것을 쓴다. */
export function CardPrompt({ question }: { question: Question }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
          {TOPICS[question.topic]}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
          {DIFFICULTY_LABELS[question.difficulty]}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
          {TYPE_LABELS[question.type] ?? question.type}
        </span>
      </div>
      <p className="text-lg leading-relaxed font-medium md:text-xl">{question.question}</p>
    </div>
  );
}
