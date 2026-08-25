'use client';

import { DIFFICULTY_LABELS, TOPICS, TYPE_LABELS } from '@/lib/config';
import { isAutoGraded, type SelfGrade } from '@/lib/exam';
import type { Question } from '@/lib/schema';

function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const SELF_GRADES: Array<{ key: SelfGrade; label: string; style: string }> = [
  { key: 'correct', label: '맞음', style: 'border-emerald-500/40 hover:bg-emerald-500/10' },
  { key: 'partial', label: '애매', style: 'border-amber-500/40 hover:bg-amber-500/10' },
  { key: 'wrong', label: '틀림', style: 'border-red-500/40 hover:bg-red-500/10' },
];

export function ExamRunner({
  question, index, total, grading, choice, setChoice, text, setText,
  remainingMs, onSubmit, onSelfGrade, onNext,
}: {
  question: Question;
  index: number;
  total: number;
  /** 답을 낸 뒤 채점 화면인지. */
  grading: boolean;
  choice: number | undefined;
  setChoice: (i: number) => void;
  text: string;
  setText: (v: string) => void;
  remainingMs: number | null;
  onSubmit: () => void;
  onSelfGrade: (g: SelfGrade) => void;
  onNext: () => void;
}) {
  const auto = isAutoGraded(question);
  const isCorrect = auto && choice !== undefined && choice === question.correct;
  const percent = (index / total) * 100;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
          <span className="tabular-nums">{index + 1} / {total}</span>
          {remainingMs !== null && (
            <span className={`tabular-nums ${remainingMs < 60_000 ? 'text-red-500' : ''}`}>
              {formatClock(remainingMs)}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] text-muted">
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{TOPICS[question.topic]}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{DIFFICULTY_LABELS[question.difficulty]}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5">{TYPE_LABELS[question.type] ?? question.type}</span>
        </div>
        <p className="text-lg leading-relaxed font-medium">{question.question}</p>

        {auto ? (
          <ul className="mt-4 space-y-2">
            {question.choices?.map((c, i) => {
              const picked = choice === i;
              const answer = i === question.correct;
              const tone = !grading
                ? picked ? 'border-accent bg-accent/10' : 'border-border hover:bg-surface-2'
                : answer ? 'border-emerald-500 bg-emerald-500/10'
                : picked ? 'border-red-500 bg-red-500/10' : 'border-border opacity-60';
              return (
                <li key={`${i}-${c}`}>
                  <button type="button" disabled={grading} onClick={() => setChoice(i)}
                    className={`w-full rounded-lg border px-3.5 py-2.5 text-left text-sm ${tone}`}>
                    {i + 1}. {c}
                    {grading && answer && ' ✓'}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={grading}
            rows={6}
            placeholder="아는 만큼 적어 보세요"
            className="mt-4 w-full resize-y card-flat bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-70"
          />
        )}
      </div>

      {grading && (
        <div className="mt-4 card p-5">
          {auto ? (
            <p className={`text-sm font-medium ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
              {isCorrect ? '맞았다' : '틀렸다'}
            </p>
          ) : (
            <div className="text-xs font-medium text-muted">모범답안</div>
          )}

          <p className="mt-2 text-sm leading-relaxed">{question.answerShort}</p>

          {question.answerDeep && (
            <p className="mt-3 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted">
              {question.answerDeep}
            </p>
          )}

          {!auto && question.keywords.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium text-muted">이 단어를 말했는가</div>
              <ul className="space-y-1.5">
                {question.keywords.map((k, i) => (
                  <li key={`${i}-${k}`}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-[var(--accent)]" />
                      <span>{k}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-4">
        {!grading ? (
          <button type="button" onClick={onSubmit}
            className="w-full btn btn-primary w-full">
            제출
          </button>
        ) : auto ? (
          <button type="button" onClick={onNext}
            className="w-full btn btn-primary w-full">
            {index + 1 === total ? '결과 보기' : '다음 문항'}
          </button>
        ) : (
          <div>
            <p className="mb-2 text-xs text-muted">스스로 채점하세요</p>
            <div className="grid grid-cols-3 gap-2">
              {SELF_GRADES.map((g) => (
                <button key={g.key} type="button" onClick={() => onSelfGrade(g.key)}
                  className={`rounded-lg border bg-surface px-3 py-3 text-sm transition-colors ${g.style}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
