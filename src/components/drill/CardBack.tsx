'use client';

import { Collapsible } from '@/components/Collapsible';
import type { Question } from '@/lib/schema';

/**
 * 뒷면. 읽는 순서를 고정한다 — 짧은 답 → 키워드 체크 → 심화 → 꼬리 질문.
 * 키워드를 체크박스로 둔 건 '알았다는 느낌'과 '실제로 말할 수 있는 것'을 가르기 위한 것이다.
 */
export function CardBack({ question }: { question: Question }) {
  return (
    <div className="space-y-4">
      {question.choices && (
        <ol className="space-y-1 text-sm">
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

      <p className="text-sm leading-relaxed">{question.answerShort}</p>

      {question.keywords.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted">이 단어를 말했는가</div>
          <ul className="space-y-1.5">
            {question.keywords.map((k, i) => (
              <li key={`${i}-${k}`}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  {/* 체크는 세션 한정이다. 저장하지 않는다. */}
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" />
                  <span>{k}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {question.answerDeep && (
        <Collapsible title="더 깊이">
          <p>{question.answerDeep}</p>
        </Collapsible>
      )}

      {question.followUps && question.followUps.length > 0 && (
        <Collapsible title={`꼬리 질문 ${question.followUps.length}개`}>
          <ul className="list-disc space-y-1 pl-5">
            {question.followUps.map((f, i) => (
              <li key={`${i}-${f}`}>{f}</li>
            ))}
          </ul>
        </Collapsible>
      )}

      {question.refs && question.refs.length > 0 && (
        <ul className="space-y-1 text-sm">
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
    </div>
  );
}
