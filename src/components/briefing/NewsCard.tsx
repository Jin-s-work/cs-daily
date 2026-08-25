'use client';

import Link from 'next/link';
import { SOURCE_LABELS, type NewsItem, type NewsSource } from '@/lib/news';

/**
 * 기사 카드.
 *
 * 위계를 세 층으로 잡았다 — 메타(작게) · 제목(크게) · 요약(읽기 편하게).
 * 예전에는 태그·출처·시각이 제목과 비슷한 무게라 눈이 어디를 봐야 할지 몰랐다.
 */

/** 출처마다 색 점을 둔다. 색만으로 구분하지 않도록 이름도 함께 적는다. */
const SOURCE_DOT: Record<NewsSource, string> = {
  geeknews: 'bg-emerald-500',
  hackernews: 'bg-orange-500',
  arxiv: 'bg-violet-500',
};

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
    <article className="card group p-5 transition-shadow hover:shadow-md">
      <div className="mb-2.5 flex items-start gap-3">
        <div className="t-caption flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 shrink-0 rounded-full ${SOURCE_DOT[item.source]}`} aria-hidden />
            {SOURCE_LABELS[item.source]}
          </span>
          <span aria-hidden className="text-faint">·</span>
          <time dateTime={item.publishedAt}>{relativeTime(item.publishedAt, now)}</time>
        </div>

        {/* 저장은 자주 쓰지 않는다. 액션 줄을 차지하는 대신 모서리에 둔다. */}
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-pressed={bookmarked}
          aria-label={bookmarked ? '저장 취소' : '저장'}
          title={bookmarked ? '저장 취소' : '저장'}
          className={`-mt-1 -mr-1 shrink-0 rounded-lg px-2 py-1 text-base leading-none transition-transform duration-100 active:scale-90 ${
            bookmarked ? 'text-accent' : 'text-faint hover:text-muted'
          }`}
        >
          {bookmarked ? '★' : '☆'}
        </button>
      </div>

      <h3 className="t-title">
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-accent"
        >
          {item.title}
        </a>
      </h3>

      {item.summary.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {item.summary.map((line, i) => (
            <li key={`${i}-${line}`} className="t-body flex gap-2.5 text-muted">
              <span aria-hidden className="mt-[0.62em] size-1 shrink-0 rounded-full bg-border-strong" />
              <span className="min-w-0">{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="t-caption mt-3">
          요약이 없다. 수집할 때 본문을 못 구했다는 뜻이니 원문을 열어야 한다.
        </p>
      )}

      {item.whyItMatters && (
        // 옅은 배경만으로는 카드 안에서 묻힌다. 왼쪽 바가 있어야 '다른 종류의 문장'으로 읽힌다.
        <div className="mt-4 flex gap-3 rounded-r-xl border-l-[3px] border-accent bg-accent-soft py-2.5 pr-3.5 pl-3">
          <p className="t-body text-[0.875rem] leading-relaxed">{item.whyItMatters}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="t-caption flex min-w-0 flex-1 flex-wrap gap-1.5">
          {item.tags.map((tag, i) => (
            <span key={`${i}-${tag}`} className="rounded-full bg-surface-2 px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href={draftHref(item)} className="btn btn-ghost !px-2.5 !py-1.5 !text-xs">
            문제로
          </Link>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary !px-2.5 !py-1.5 !text-xs"
          >
            원문 ↗
          </a>
        </div>
      </div>
    </article>
  );
}
