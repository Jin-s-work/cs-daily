'use client';

import { useState } from 'react';
import { groupByTopic, toExportJson } from '@/lib/overrides';
import type { Question } from '@/lib/schema';

/**
 * 오버레이에 있는 문항만 내보낸다.
 *
 * 다운로드 링크 대신 붙여넣을 JSON 을 그대로 보여준다 — 이 앱을 아티팩트처럼
 * 샌드박스 안에서 열었을 때 브라우저가 스크립트발 다운로드를 막기 때문이다.
 */
export function ExportPanel({ overrides }: { overrides: Question[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (overrides.length === 0) return null;
  const groups = [...groupByTopic(overrides).entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));

  async function copy(topic: string, json: string) {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(topic);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-sm font-medium">
        <span>
          JSON 내보내기
          <span className="ml-2 text-xs font-normal text-muted">로컬 수정 {overrides.length}건</span>
        </span>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-muted">
            아래 내용을 <code>content/questions/&lt;주제&gt;.json</code> 에 반영하고{' '}
            <code>npm run validate</code> 를 돌린 뒤 커밋한다. 커밋해야 영구히 남는다.
          </p>
          {groups.map(([topic, items]) => {
            const json = toExportJson(items);
            return (
              <div key={topic}>
                <div className="mb-1.5 flex items-center justify-between">
                  <code className="text-xs">content/questions/{topic}.json — {items.length}건</code>
                  <button type="button" onClick={() => void copy(topic, json)}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg">
                    {copied === topic ? '복사됨' : '복사'}
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-surface-muted p-3 text-[11px] leading-relaxed">
                  {json}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
