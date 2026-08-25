'use client';

/**
 * 문제 초안 폼. 브리핑에서 넘어온 제목·요약을 채워 둔 채로 연다.
 *
 * 브라우저는 content/questions/*.json 에 쓸 수 없다. 그래서 이 폼은 저장하지 않고
 * **붙여넣을 JSON 을 만들어 준다.** 실제 반영은 파일에 붙여넣고 `npm run validate` 다.
 */

import { useMemo, useState } from 'react';
import { TOPICS } from '@/lib/config';
import { ID_PATTERN, TOPIC_VALUES, questionSchema, type Topic } from '@/lib/schema';

interface Props {
  existingIds: string[];
  initial: { title: string; url: string; summary: string };
}

export function QuestionDraftForm({ existingIds, initial }: Props) {
  const [topic, setTopic] = useState<Topic>('ai');
  const [subtopic, setSubtopic] = useState('');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [question, setQuestion] = useState(initial.title);
  const [answerShort, setAnswerShort] = useState(initial.summary);
  const [keywords, setKeywords] = useState('');
  const [copied, setCopied] = useState(false);

  /** 같은 주제·소주제에서 안 쓴 가장 작은 번호를 제안한다. id 는 나중에 못 바꾸므로 충돌을 미리 막는다. */
  const suggestedId = useMemo(() => {
    const slug = subtopic.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!slug) return '';
    const prefix = `${topic}-${slug}-`;
    const used = new Set(
      existingIds.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)),
    );
    for (let n = 1; n < 1000; n++) {
      const num = String(n).padStart(3, '0');
      if (!used.has(num)) return `${prefix}${num}`;
    }
    return '';
  }, [topic, subtopic, existingIds]);

  const draft = useMemo(() => {
    const body: Record<string, unknown> = {
      id: suggestedId,
      topic,
      subtopic: subtopic.trim(),
      difficulty,
      type: 'concept',
      question: question.trim(),
      answerShort: answerShort.trim(),
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      source: 'news',
    };
    if (initial.url) body.refs = [{ title: '원문', url: initial.url }];
    return body;
  }, [suggestedId, topic, subtopic, difficulty, question, answerShort, keywords, initial.url]);

  const check = questionSchema.safeParse(draft);
  const json = JSON.stringify(draft, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const field = 'w-full card-flat bg-surface px-3 py-2 text-sm outline-none focus:border-accent';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">주제</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value as Topic)} className={field}>
            {TOPIC_VALUES.map((t) => (
              <option key={t} value={t}>{TOPICS[t]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">소주제 (영문 소문자)</span>
          <input
            value={subtopic}
            onChange={(e) => setSubtopic(e.target.value)}
            placeholder="rag"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          id — 자동 제안. 한 번 파일에 넣으면 바꾸지 않는다
        </span>
        <input
          readOnly
          value={suggestedId || '소주제를 입력하면 만들어진다'}
          className={`${field} font-mono text-xs ${suggestedId && ID_PATTERN.test(suggestedId) ? '' : 'text-muted'}`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">난이도</span>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                difficulty === d ? 'border-accent bg-accent text-accent-fg' : 'border-border'
              }`}
            >
              {['기초', '중급', '심화'][d - 1]}
            </button>
          ))}
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">질문</span>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">
          짧은 답 — 브리핑 요약이 채워져 있다. 그대로 두지 말고 질문의 답으로 고쳐 쓸 것
        </span>
        <textarea value={answerShort} onChange={(e) => setAnswerShort(e.target.value)} rows={5} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">키워드 (쉼표로 구분)</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={field} />
      </label>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium">
            {check.success ? '✓ 스키마 통과' : '✗ 아직 통과 못 함'}
          </span>
          <button
            type="button"
            onClick={copy}
            disabled={!check.success}
            className="btn btn-primary !py-1.5 !text-xs disabled:opacity-40"
          >
            {copied ? '복사됨' : 'JSON 복사'}
          </button>
        </div>

        {!check.success && (
          <ul className="mb-2 space-y-0.5 text-xs text-muted">
            {check.error.issues.slice(0, 4).map((i) => (
              <li key={`${i.path.join('.')}-${i.message}`}>
                {i.path.join('.') || '(전체)'}: {i.message}
              </li>
            ))}
          </ul>
        )}

        <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-[11px] leading-relaxed">
          {json}
        </pre>
        <p className="mt-2 text-xs text-muted">
          <code>content/questions/{topic}.json</code> 배열에 붙여넣고{' '}
          <code>npm run validate</code> 를 돌린다.
        </p>
      </div>
    </div>
  );
}
