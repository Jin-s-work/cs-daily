import { describe, expect, it } from 'vitest';
import {
  DAILY_NEWS_CAP,
  makeId,
  newsItemSchema,
  normalizeUrl,
  parseFeed,
  selectItems,
  type RawItem,
} from './news';

describe('normalizeUrl', () => {
  it('추적 파라미터를 뗀다', () => {
    expect(normalizeUrl('https://example.com/post?utm_source=x&utm_campaign=y&id=7'))
      .toBe('https://example.com/post?id=7');
    expect(normalizeUrl('https://example.com/a?ref=hn')).toBe('https://example.com/a');
    expect(normalizeUrl('https://example.com/a?fbclid=abc')).toBe('https://example.com/a');
    expect(normalizeUrl('https://example.com/a?gclid=1&msclkid=2')).toBe('https://example.com/a');
  });

  it('진짜 쿼리는 남긴다', () => {
    expect(normalizeUrl('https://example.com/s?q=rust&page=2')).toBe('https://example.com/s?q=rust&page=2');
  });

  it('해시·대문자·끝 슬래시를 정리한다', () => {
    expect(normalizeUrl('https://Example.COM/Post/#section')).toBe('https://example.com/post');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('URL 이 아니면 버리지 않고 소문자로만 눕힌다', () => {
    expect(normalizeUrl('  Not A URL  ')).toBe('not a url');
  });
});

describe('makeId', () => {
  it('sha1 40자리를 준다', () => {
    expect(makeId('https://example.com/a')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('추적 파라미터만 다른 URL 은 같은 id 가 된다', () => {
    expect(makeId('https://example.com/a?utm_source=x')).toBe(makeId('https://example.com/a'));
    expect(makeId('https://example.com/a#top')).toBe(makeId('https://example.com/a'));
  });

  it('다른 글은 다른 id 가 된다', () => {
    expect(makeId('https://example.com/a')).not.toBe(makeId('https://example.com/b'));
  });
});

describe('selectItems', () => {
  function make(source: RawItem['source'], n: number, dayOffset = 0): RawItem[] {
    return Array.from({ length: n }, (_, i) => ({
      title: `${source} ${i}`,
      url: `https://example.com/${source}/${i}`,
      source,
      publishedAt: new Date(Date.UTC(2026, 7, 25 - dayOffset, 12, 0, n - i)).toISOString(),
    }));
  }

  it('하루 총 상한 8건을 넘지 않는다', () => {
    const items = [...make('geeknews', 20), ...make('hackernews', 20), ...make('arxiv', 20)];
    expect(selectItems(items).length).toBe(DAILY_NEWS_CAP);
  });

  it('소스별 상한을 지킨다', () => {
    const items = [...make('geeknews', 20), ...make('hackernews', 20), ...make('arxiv', 20)];
    const picked = selectItems(items);
    const count = (s: string) => picked.filter((p) => p.source === s).length;
    expect(count('geeknews')).toBeLessThanOrEqual(4);
    expect(count('hackernews')).toBeLessThanOrEqual(3);
    expect(count('arxiv')).toBeLessThanOrEqual(2);
  });

  it('총 상한이 소스 상한 합보다 작아도 한 소스가 통째로 밀려나지 않는다', () => {
    const items = [...make('geeknews', 20), ...make('hackernews', 20), ...make('arxiv', 20)];
    const picked = selectItems(items);
    for (const s of ['geeknews', 'hackernews', 'arxiv']) {
      expect(picked.some((p) => p.source === s)).toBe(true);
    }
  });

  it('한 소스만 있으면 그 소스 상한까지만 고른다', () => {
    expect(selectItems(make('geeknews', 20)).length).toBe(4);
  });

  it('빈 입력이면 빈 결과', () => {
    expect(selectItems([])).toEqual([]);
  });

  it('최신 글을 먼저 고른다', () => {
    const old = make('arxiv', 2, 5);
    const fresh = make('arxiv', 2, 0);
    const picked = selectItems([...old, ...fresh]);
    expect(picked.every((p) => fresh.some((f) => f.url === p.url))).toBe(true);
  });
});

describe('parseFeed', () => {
  it('RSS 2.0 을 읽는다', () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
      <item><title>첫 글</title><link>https://a.com/1</link>
        <pubDate>Mon, 24 Aug 2026 09:00:00 +0900</pubDate></item>
      <item><title><![CDATA[둘째 & 글]]></title><link>https://a.com/2</link>
        <pubDate>Mon, 24 Aug 2026 10:00:00 +0900</pubDate></item>
    </channel></rss>`;
    const items = parseFeed(xml, 'geeknews');
    expect(items.length).toBe(2);
    expect(items[0].title).toBe('첫 글');
    expect(items[1].title).toBe('둘째 & 글');
    expect(items[0].url).toBe('https://a.com/1');
    expect(items[0].publishedAt).toBe('2026-08-24T00:00:00.000Z');
  });

  it('Atom 을 읽고 rel="self" 링크는 건너뛴다', () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <link rel="self" href="https://feed.com/atom"/>
      <entry><title>Atom 글</title>
        <link rel="self" href="https://a.com/self"/>
        <link href="https://a.com/real"/>
        <published>2026-08-24T09:00:00Z</published></entry>
    </feed>`;
    const items = parseFeed(xml, 'arxiv');
    expect(items.length).toBe(1);
    expect(items[0].url).toBe('https://a.com/real');
    expect(items[0].title).toBe('Atom 글');
  });

  it("속성이 작은따옴표인 Atom 도 읽는다 — GeekNews 가 이 형식이다", () => {
    const xml = `<feed xmlns='http://www.w3.org/2005/Atom'>
      <link rel='self' type='application/atom+xml' href='https://news.hada.io/rss/news' />
      <entry><title>긱뉴스 글</title>
        <link rel='alternate' type='text/html' href='https://news.hada.io/topic?id=1' />
        <updated>2026-08-24T09:00:00Z</updated></entry>
    </feed>`;
    const items = parseFeed(xml, 'geeknews');
    expect(items.length).toBe(1);
    expect(items[0].url).toBe('https://news.hada.io/topic?id=1');
  });

  it('빈 피드는 빈 배열을 준다 — arXiv 는 글 없는 날이 있다', () => {
    expect(parseFeed('<rss><channel><title>비어 있음</title></channel></rss>', 'arxiv')).toEqual([]);
    expect(parseFeed('', 'arxiv')).toEqual([]);
  });

  it('제목이나 링크가 없는 항목은 건너뛴다', () => {
    const xml = `<rss><channel>
      <item><title>링크 없음</title></item>
      <item><link>https://a.com/2</link></item>
      <item><title>정상</title><link>https://a.com/3</link></item>
    </channel></rss>`;
    expect(parseFeed(xml, 'geeknews').map((i) => i.title)).toEqual(['정상']);
  });

  it('날짜가 없거나 깨졌으면 현재 시각으로 채운다', () => {
    const xml = `<rss><channel><item><title>t</title><link>https://a.com/1</link>
      <pubDate>날짜아님</pubDate></item></channel></rss>`;
    const items = parseFeed(xml, 'geeknews');
    expect(Number.isNaN(new Date(items[0].publishedAt).getTime())).toBe(false);
  });

  it('HTML 엔티티를 푼다', () => {
    const xml = `<rss><channel><item><title>a &lt;b&gt; &quot;c&quot; &amp; d</title>
      <link>https://a.com/1</link></item></channel></rss>`;
    expect(parseFeed(xml, 'geeknews')[0].title).toBe('a <b> "c" & d');
  });

  it('이중 인코딩은 한 단계만 푼다', () => {
    // &amp;lt; 는 원문이 문자 그대로 '&lt;' 라는 뜻이다. 두 번 풀면 원문이 훼손된다.
    const xml = `<rss><channel><item><title>&amp;lt;b&amp;gt;</title>
      <link>https://a.com/1</link></item></channel></rss>`;
    expect(parseFeed(xml, 'geeknews')[0].title).toBe('&lt;b&gt;');
  });
});

describe('newsItemSchema', () => {
  const valid = {
    id: 'a'.repeat(40),
    title: '제목',
    url: 'https://example.com/a',
    source: 'geeknews',
    publishedAt: '2026-08-25T00:00:00.000Z',
    summary: ['한 줄', '두 줄', '세 줄'],
    whyItMatters: '중요한 이유',
    tags: ['AI/LLM'],
  };

  it('정상 항목을 통과시킨다', () => {
    expect(newsItemSchema.safeParse(valid).success).toBe(true);
  });

  it('요약 실패 상태(빈 배열·빈 문자열)도 유효하다', () => {
    const r = newsItemSchema.safeParse({ ...valid, summary: [], whyItMatters: '', tags: [] });
    expect(r.success).toBe(true);
  });

  it('요약 4줄, 태그 3개는 거부한다', () => {
    expect(newsItemSchema.safeParse({ ...valid, summary: ['1', '2', '3', '4'] }).success).toBe(false);
    expect(newsItemSchema.safeParse({ ...valid, tags: ['AI/LLM', '웹', '보안'] }).success).toBe(false);
  });

  it('고정 집합 밖의 태그를 거부한다', () => {
    expect(newsItemSchema.safeParse({ ...valid, tags: ['블록체인'] }).success).toBe(false);
  });

  it('summary·tags 에 같은 값이 두 번 오면 거부한다', () => {
    expect(
      newsItemSchema.safeParse({ ...valid, summary: ['같은 줄', '같은 줄', '다른 줄'] }).success,
    ).toBe(false);
    expect(newsItemSchema.safeParse({ ...valid, tags: ['웹', '웹'] }).success).toBe(false);
    expect(newsItemSchema.safeParse({ ...valid, tags: ['웹', '보안'] }).success).toBe(true);
  });

  it('sha1 이 아닌 id 를 거부한다', () => {
    expect(newsItemSchema.safeParse({ ...valid, id: 'short' }).success).toBe(false);
  });
});
