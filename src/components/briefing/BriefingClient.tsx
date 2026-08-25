'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getBookmarkIds, toggleBookmark } from '@/lib/db';
import { NEWS_TAGS, type NewsTag } from '@/lib/news';
import type { NewsDay } from '@/lib/news-files';
import { NewsCard } from './NewsCard';

/**
 * 첫 페이지도 서버 prop 이 아니라 /api/news 로 가져온다.
 *
 * 서버에서 내려준 배열을 useState 초기값으로 쓰면, 서버 컴포넌트가 다시 렌더될 때
 * 이 컴포넌트가 재마운트되면서 스크롤로 쌓아 둔 지난 날짜가 통째로 날아간다.
 * 초기 로드와 추가 로드를 한 경로로 합치면 그 리셋이 사라지고 코드도 하나로 준다.
 */
export function BriefingClient() {
  const [days, setDays] = useState<NewsDay[]>([]);
  const [tag, setTag] = useState<NewsTag | 'all'>('all');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinel = useRef<HTMLDivElement | null>(null);
  /** 같은 페이지를 두 번 요청하지 않도록 진행 중 여부를 렌더와 무관하게 들고 있는다. */
  const inFlight = useRef(false);
  /** loadMore 가 days 에 의존하지 않도록 최신 값을 여기로 흘려 둔다. */
  const daysRef = useRef<NewsDay[]>([]);

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  useEffect(() => {
    getBookmarkIds()
      .then(setBookmarks)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore) return;
    inFlight.current = true;
    setLoading(true);
    try {
      // 커서는 현재 상태의 마지막 날짜다. 없으면 첫 페이지를 부른다.
      const last = daysRef.current[daysRef.current.length - 1]?.day;
      const query = last ? `?before=${encodeURIComponent(last)}` : '';
      const res = await fetch(`/api/news${query}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: { days: NewsDay[]; hasMore: boolean } = await res.json();
      setDays((prev) => [...prev, ...body.days]);
      setHasMore(body.hasMore && body.days.length > 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHasMore(false); // 계속 실패하는 요청을 무한히 재시도하지 않는다
    } finally {
      inFlight.current = false;
      setLoading(false);
      setReady(true);
    }
  }, [hasMore]);

  // 첫 페이지. loadMore 는 커서를 ref 에서 읽으므로 마운트 때 한 번만 부르면 된다.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void loadMore();
  }, [loadMore]);

  /** 바닥에서 이만큼 안쪽에 들어오면 다음 장을 미리 부른다. */
  const NEAR_BOTTOM_PX = 400;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: `${NEAR_BOTTOM_PX}px` },
    );
    observer.observe(node);

    // 스크롤 폴백. IntersectionObserver 가 뜨지 않는 환경(일부 웹뷰·자동화 브라우저)이
    // 있어서, 관찰자만 믿으면 그런 곳에서는 다음 장이 영영 안 붙는다.
    // 둘 다 걸어도 inFlight 가드가 중복 요청을 막는다.
    const onScroll = () => {
      const remaining =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining <= NEAR_BOTTOM_PX) void loadMore();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // 첫 화면이 뷰포트보다 짧으면 스크롤이 아예 안 생긴다. 한 번은 직접 확인한다.
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // ready 가 의존성에 있어야 한다. 첫 로드 중에는 sentinel 이 렌더되지 않아
    // node 가 null 이고, 로드가 끝나 sentinel 이 나타나도 loadMore·hasMore 가
    // 그대로면 이 effect 가 다시 돌지 않아 관찰자와 리스너가 영영 안 붙는다.
  }, [loadMore, hasMore, ready]);

  const onToggle = useCallback(async (newsId: string, day: string) => {
    // 낙관적으로 먼저 칠하고, 실패하면 되돌린다.
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(newsId)) next.delete(newsId);
      else next.add(newsId);
      return next;
    });
    try {
      await toggleBookmark(newsId, day);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (next.has(newsId)) next.delete(newsId);
        else next.add(newsId);
        return next;
      });
    }
  }, []);


  const visible = useMemo(
    () =>
      days
        .map((d) => ({
          ...d,
          items: tag === 'all' ? d.items : d.items.filter((i) => i.tags.includes(tag)),
        }))
        .filter((d) => d.items.length > 0),
    [days, tag],
  );

  /** 카드가 렌더될 때마다 Date.now() 를 부르면 값이 흔들린다. 한 번만 잡는다. */
  const [now] = useState(() => Date.now());

  if (!ready) {
    return <p className="py-16 text-center text-sm text-muted">불러오는 중…</p>;
  }

  if (days.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted">
        {error
          ? `뉴스를 못 읽었다: ${error}`
          : '아직 수집된 뉴스가 없다. npm run ingest 를 돌리면 채워진다.'}
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(['all', ...NEWS_TAGS] as const).map((t) => {
          const active = tag === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={active}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                active
                  ? 'bg-accent text-accent-fg font-medium'
                  : 'bg-surface-muted text-muted hover:text-foreground'
              }`}
            >
              {t === 'all' ? '전체' : t}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">이 태그의 기사가 없다.</p>
      ) : (
        visible.map((d) => (
          <section key={d.day} className="mt-8">
            <h2 className="mb-3 text-xs font-medium text-muted tabular-nums">{d.day}</h2>
            <div className="space-y-3">
              {d.items.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  now={now}
                  bookmarked={bookmarks.has(item.id)}
                  onToggleBookmark={() => void onToggle(item.id, d.day)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <div ref={sentinel} className="py-8 text-center text-xs text-muted">
        {loading ? '더 불러오는 중…' : hasMore ? '' : '여기까지가 전부다.'}
      </div>
    </div>
  );
}
