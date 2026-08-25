/**
 * 뉴스 브리핑의 스키마와 순수 유틸.
 *
 * 네트워크·파일·LLM 은 여기 없다 — scripts/ingest-news.ts 가 한다.
 * 그래야 URL 정규화나 선별 규칙을 테스트로 고정할 수 있다.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';

/** 태그는 고정 집합이다. 모델이 새 태그를 지어내면 스키마에서 걸러진다. */
export const NEWS_TAGS = ['AI/LLM', '인프라', '웹', '언어/런타임', '보안', '업계'] as const;
export const newsTagSchema = z.enum(NEWS_TAGS);
export type NewsTag = z.infer<typeof newsTagSchema>;

export const NEWS_SOURCES = ['geeknews', 'hackernews', 'arxiv'] as const;
export const newsSourceSchema = z.enum(NEWS_SOURCES);
export type NewsSource = z.infer<typeof newsSourceSchema>;

/** 출처 코드 → 화면에 쓸 이름. */
export const SOURCE_LABELS: Record<NewsSource, string> = {
  geeknews: 'GeekNews',
  hackernews: 'Hacker News',
  arxiv: 'arXiv',
};

/** 소스별 하루 상한. 한 소스가 브리핑을 독점하지 않게 한다. */
export const SOURCE_CAPS: Record<NewsSource, number> = {
  geeknews: 4,
  hackernews: 3,
  arxiv: 2,
};

/** 하루 총 상한. 아침에 훑는 게 목적이라 8건을 넘기지 않는다. */
export const DAILY_NEWS_CAP = 8;

/** 중복 검사에 쓸 과거 일수. */
export const DEDUPE_WINDOW_DAYS = 14;

/**
 * 저장되는 기사 한 건.
 *
 * 원문 본문은 담지 않는다. 제목·URL·출처·자체 생성 요약만 저장하고 원문 링크를 항상 노출한다.
 */
/** 같은 값이 두 번 들어간 배열을 막는다. 요약 줄이나 태그가 겹치면 화면에서 key 가 충돌한다. */
function noDuplicates(label: string) {
  return (items: string[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    items.forEach((item, i) => {
      if (seen.has(item)) {
        ctx.addIssue({ code: 'custom', path: [i], message: `${label}에 같은 값이 두 번 있다` });
      }
      seen.add(item);
    });
  };
}

export const newsItemSchema = z.object({
  /** 정규화한 URL 의 sha1. 같은 기사가 다른 추적 파라미터로 와도 같은 id 가 된다. */
  id: z.string().regex(/^[0-9a-f]{40}$/, 'id 는 sha1 40자리여야 한다'),
  title: z.string().min(1),
  url: z.string().url(),
  source: newsSourceSchema,
  /** ISO 8601. 원본이 준 발행 시각. */
  publishedAt: z.string().datetime({ offset: true }),
  /** 3줄 요약. 요약에 실패하면 빈 배열이다 — 화면은 이 경우를 처리해야 한다. */
  summary: z.array(z.string().min(1)).max(3).superRefine(noDuplicates('summary')),
  whyItMatters: z.string(),
  tags: z.array(newsTagSchema).max(2).superRefine(noDuplicates('tags')),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

export const newsFileSchema = z.array(newsItemSchema);

/** 정규화 전 단계. 어댑터가 돌려주는 형태. */
export interface RawItem {
  title: string;
  url: string;
  source: NewsSource;
  publishedAt: string;
  /**
   * 요약 모델에 넘길 발췌. 피드가 준 description·초록을 쓴다.
   * **저장하지 않는다** — 기사 본문 전문을 보관하지 않기 위해서다.
   */
  excerpt?: string;
}

/** 요약 모델에 넘기는 발췌 길이 상한. */
export const EXCERPT_MAX = 2000;

/** HTML 태그를 걷어내고 공백을 정리해 상한까지 자른다. */
export function toExcerpt(html: string | null | undefined, max: number = EXCERPT_MAX): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * 추적 파라미터를 떼고 소문자로 눕힌다. 같은 글이 여러 경로로 들어와도 한 건으로 묶기 위해서다.
 *
 * 접두사 검사도 하는 이유: utm_ 계열은 utm_source·utm_campaign 처럼 끝없이 늘어난다.
 */
const TRACKING_EXACT = new Set([
  'ref', 'ref_src', 'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid',
  'source', 'spm', 'yclid', 'msclkid', '_hsenc', '_hsmi',
]);
const TRACKING_PREFIXES = ['utm_'];

export function normalizeUrl(input: string): string {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    // URL 로 못 읽으면 최소한 소문자·공백 정리만 해서 돌려준다. 버리지는 않는다.
    return input.trim().toLowerCase();
  }

  for (const key of [...parsed.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_EXACT.has(lower) || TRACKING_PREFIXES.some((p) => lower.startsWith(p))) {
      parsed.searchParams.delete(key);
    }
  }

  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.protocol = parsed.protocol.toLowerCase();

  // 끝의 슬래시 하나 차이로 다른 기사가 되지 않게 한다(루트 경로는 제외).
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  return parsed.toString().toLowerCase();
}

/** 정규화한 URL 의 sha1. 기사 id 다. */
export function makeId(url: string): string {
  return createHash('sha1').update(normalizeUrl(url)).digest('hex');
}

/**
 * 소스별 상한을 지키면서 하루 총 상한까지 고른다.
 *
 * 소스별로 먼저 자른 뒤 라운드로빈으로 합친다. 총 상한이 소스 상한 합보다 작아도
 * (4+3+2=9 > 8) 한 소스가 통째로 밀려나지 않는다.
 */
export function selectItems(
  items: readonly RawItem[],
  caps: Record<NewsSource, number> = SOURCE_CAPS,
  total: number = DAILY_NEWS_CAP,
): RawItem[] {
  const buckets = new Map<NewsSource, RawItem[]>();
  for (const source of NEWS_SOURCES) buckets.set(source, []);

  // 최신 글을 먼저 남긴다.
  const sorted = [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  for (const item of sorted) {
    const bucket = buckets.get(item.source);
    if (bucket && bucket.length < caps[item.source]) bucket.push(item);
  }

  const picked: RawItem[] = [];
  for (let round = 0; picked.length < total; round++) {
    let tookAny = false;
    for (const source of NEWS_SOURCES) {
      const bucket = buckets.get(source);
      if (!bucket || round >= bucket.length) continue;
      picked.push(bucket[round]);
      tookAny = true;
      if (picked.length === total) return picked;
    }
    if (!tookAny) break;
  }
  return picked;
}

// ─── 아주 작은 RSS/Atom 리더 ───
// 의존성을 늘리지 않으려고 직접 썼다. 우리가 뽑는 건 제목·링크·발행시각 세 개뿐이다.
// 임의의 XML 을 다루지 않으므로 이 정도로 충분하다.

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&')
    .trim();
}

function firstTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? decodeEntities(match[1]) : null;
}

function findLink(block: string): string | null {
  // Atom: <link href="..."/> — rel="alternate" 이거나 rel 이 없는 것을 고른다.
  // 속성 따옴표는 " 와 ' 를 모두 받는다. GeekNews 는 작은따옴표를 쓴다.
  const atom = [...block.matchAll(/<link\b([^>]*?)\/?>/gi)];
  for (const [, attrs] of atom) {
    if (/rel\s*=\s*["'](self|edit|replies)["']/i.test(attrs)) continue;
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i);
    if (href) return decodeEntities(href[1]);
  }
  // RSS: <link>URL</link>
  return firstTag(block, 'link');
}

/**
 * RSS 2.0 과 Atom 을 모두 읽는다. 파싱 못 한 항목은 조용히 건너뛴다 —
 * 피드 하나의 항목 하나가 깨졌다고 그날 브리핑 전체를 버릴 이유는 없다.
 */
export function parseFeed(xml: string, source: NewsSource): RawItem[] {
  const blocks = [
    ...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi),
  ].map((m) => m[0]);

  const out: RawItem[] = [];
  for (const block of blocks) {
    const title = firstTag(block, 'title');
    const url = findLink(block);
    if (!title || !url) continue;

    const rawDate =
      firstTag(block, 'pubDate') ??
      firstTag(block, 'published') ??
      firstTag(block, 'updated') ??
      firstTag(block, 'dc:date');

    const parsed = rawDate ? new Date(rawDate) : null;
    const publishedAt =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();

    const description =
      firstTag(block, 'description') ??
      firstTag(block, 'summary') ??
      firstTag(block, 'content');

    out.push({ title, url, source, publishedAt, excerpt: toExcerpt(description) });
  }
  return out;
}
