'use client';

import Link from 'next/link';
import { SOURCE_LABELS, type NewsItem } from '@/lib/news';

/** 'n분 전' 같은 상대 시각. 하루가 넘으면 날짜를 그대로 보여준다. */
function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((now - then) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}일 전`;
  return iso.slice(0, 10);
}

/** 문제 초안 폼으로 넘길 쿼리. 제목과 요약을 그대로 실어 보낸다. */
function draftHref(item: NewsItem): string {
  const params = new URLSearchParams({ title: item.title, url: item.url });
  if (item.summary.length > 0) params.set('summary', item.summary.join('\n'));
  return `/manage/new?${params.toString()}`;
}

export function NewsCard({
  item,
  bookmarked,
  onToggleBookmark,
  now,
}: {
  item: NewsItem;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  now: number;
}) {
  return (
    <article className="card p-5">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        {item.tags.map((tag, i) => (
          <span key={`${i}-${tag}`} className="rounded-full bg-surface-2 px-2 py-0.5">
            {tag}
          </span>
        ))}
        <span>{SOURCE_LABELS[item.source]}</span>
        <span aria-hidden>·</span>
        <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt, now)}</time>
      </div>

      <h3 className="text-base leading-relaxed font-medium">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-accent hover:underline underline-offset-2"
        >
          {item.title}
        </a>
      </h3>

      {item.summary.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          {item.summary.map((line, i) => (
            <li key={`${i}-${line}`} className="flex gap-2">
              <span aria-hidden className="text-border">—</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">
          요약이 없다. 수집할 때 요약 모델을 못 불렀다는 뜻이다 — 원문을 직접 열어야 한다.
        </p>
      )}

      {item.whyItMatters && (
        <p className="mt-3 border-l-2 border-accent/40 pl-3 text-sm leading-relaxed">
          {item.whyItMatters}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="card-flat px-2.5 py-1.5 hover:bg-surface-2"
        >
          원문 ↗
        </a>
        <Link
          href={draftHref(item)}
          className="card-flat px-2.5 py-1.5 hover:bg-surface-2"
        >
          문제로 만들기
        </Link>
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-pressed={bookmarked}
          className={`ml-auto rounded-lg border px-2.5 py-1.5 ${
            bookmarked
              ? 'border-accent bg-accent text-accent-fg'
              : 'border-border hover:bg-surface-2'
          }`}
        >
          {bookmarked ? '★ 저장됨' : '☆ 저장'}
        </button>
      </div>
    </article>
  );
}
