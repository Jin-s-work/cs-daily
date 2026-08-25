/**
 * 뉴스 수집기. `npm run ingest` 로 돌고 GitHub Actions 가 매일 아침 부른다.
 *
 * 설계 원칙 하나: **어느 단계가 실패해도 프로세스는 성공으로 끝난다.**
 * 피드 하나가 죽었다고, 요약 모델이 막혔다고 그날 브리핑 전체를 잃으면 안 된다.
 * 실패는 경고로 남기고 할 수 있는 데까지 진행한다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { addDays, todayStr } from '../src/lib/date';
import {
  DAILY_NEWS_CAP,
  DEDUPE_WINDOW_DAYS,
  EXCERPT_MAX,
  NEWS_TAGS,
  SOURCE_CAPS,
  makeId,
  newsFileSchema,
  parseFeed,
  selectItems,
  toExcerpt,
  type NewsItem,
  type RawItem,
} from '../src/lib/news';

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');
const FETCH_TIMEOUT_MS = 15_000;

/** .env 가 있으면 읽는다. 없어도 정상이다 — CI 는 환경변수로 준다. */
function loadEnvFile(): void {
  try {
    if (existsSync('.env')) process.loadEnvFile('.env');
  } catch {
    // 형식이 깨졌어도 진행한다. 키가 없으면 요약만 건너뛴다.
  }
}

/**
 * 로그에 키가 새지 않게 지운다.
 *
 * OpenAI 는 인증 실패 메시지에 키를 부분 마스킹해서 담아 준다(`sk-abcd****wxyz`).
 * 그대로 두면 Actions 로그에 앞뒤 몇 글자가 남는다. 통째로 가린다.
 */
function redact(text: string): string {
  return text
    .replace(/\bsk-[A-Za-z0-9_*-]{8,}/g, '[키 가림]')
    .replace(/\b(OPENAI_API_KEY\s*=\s*)\S+/g, '$1[키 가림]');
}

function warn(where: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`  ⚠ ${where}: ${redact(message)}`);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'cs-daily-drill/0.1 (personal study tool)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

/** 원문 본문을 긁어올 때의 타임아웃. 요약 하나 때문에 수집 전체를 붙잡아 두지 않는다. */
const PAGE_TIMEOUT_MS = 8_000;

/**
 * 피드가 발췌를 안 준 기사의 본문을 원문에서 가져온다.
 *
 * Hacker News 의 링크 글이 대표적이다 — Algolia 는 제목과 점수만 주므로 발췌가 없고,
 * 제목만으로 요약을 시키면 세 줄이 같은 말을 되풀이한다.
 *
 * 가져온 본문은 **저장하지 않는다.** 요약 모델에 넣고 버린다.
 * 실패(봇 차단·타임아웃·비HTML)는 흔한 일이라 조용히 빈 문자열을 돌려준다.
 */
async function fetchExcerpt(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { 'user-agent': 'cs-daily-drill/0.1 (personal study tool)' },
    });
    if (!res.ok) return '';
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('text/html') && !type.includes('text/plain')) return '';
    return toExcerpt(await res.text());
  } catch {
    return '';
  }
}

/** 발췌가 있으면 그대로, 없으면 원문에서 한 번 시도한다. */
async function ensureExcerpt(item: SummarizeInput): Promise<string> {
  const existing = item.excerpt?.trim();
  if (existing) return existing;
  return fetchExcerpt(item.url);
}

// ─── 소스 어댑터 ───
// 각 어댑터는 자기 실패를 자기가 삼킨다. 호출부는 빈 배열을 받을 뿐이다.

async function fromGeekNews(): Promise<RawItem[]> {
  try {
    const xml = await fetchText('https://news.hada.io/rss/news');
    const items = parseFeed(xml, 'geeknews');
    console.log(`  GeekNews: ${items.length}건`);
    return items;
  } catch (e) {
    warn('GeekNews', e);
    return [];
  }
}

const HN_MIN_POINTS = 150;

async function fromHackerNews(): Promise<RawItem[]> {
  try {
    const raw = await fetchText('https://hn.algolia.com/api/v1/search?tags=front_page');
    const parsed: unknown = JSON.parse(raw);

    const hitSchema = z.object({
      title: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
      points: z.number().nullable().optional(),
      created_at: z.string().nullable().optional(),
      objectID: z.string(),
      story_text: z.string().nullable().optional(),
    });
    const body = z.object({ hits: z.array(hitSchema) }).safeParse(parsed);
    if (!body.success) throw new Error('예상과 다른 응답 형식');

    const items: RawItem[] = [];
    for (const hit of body.data.hits) {
      if ((hit.points ?? 0) < HN_MIN_POINTS) continue;
      if (!hit.title) continue;
      // Ask HN 처럼 외부 URL 이 없는 글은 HN 토론 페이지를 원문으로 삼는다.
      const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
      const at = hit.created_at ? new Date(hit.created_at) : null;
      items.push({
        title: hit.title,
        url,
        source: 'hackernews',
        publishedAt:
          at && !Number.isNaN(at.getTime()) ? at.toISOString() : new Date().toISOString(),
        excerpt: toExcerpt(hit.story_text),
      });
    }
    console.log(`  Hacker News: ${items.length}건 (${HN_MIN_POINTS}점 이상)`);
    return items;
  } catch (e) {
    warn('Hacker News', e);
    return [];
  }
}

const ARXIV_FEEDS = [
  'https://rss.arxiv.org/rss/cs.AI',
  'https://rss.arxiv.org/rss/cs.LG',
  'https://rss.arxiv.org/rss/cs.CL',
];

async function fromArxiv(): Promise<RawItem[]> {
  const items: RawItem[] = [];
  // 피드마다 따로 감싼다. cs.CL 이 죽어도 cs.AI 는 살린다.
  for (const feed of ARXIV_FEEDS) {
    try {
      const xml = await fetchText(feed);
      const parsed = parseFeed(xml, 'arxiv');
      // 논문이 안 올라오는 날이 있다. 빈 응답은 오류가 아니다.
      items.push(...parsed);
      console.log(`  arXiv ${feed.split('/').pop()}: ${parsed.length}건`);
    } catch (e) {
      warn(`arXiv ${feed}`, e);
    }
  }
  return items;
}

// ─── 중복 제거 ───

/** 하루치 파일을 읽는다. 없거나 깨졌으면 빈 배열. */
function readDay(day: string): NewsItem[] {
  const file = path.join(NEWS_DIR, `${day}.json`);
  if (!existsSync(file)) return [];
  try {
    const parsed = newsFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf-8')));
    return parsed.success ? parsed.data : [];
  } catch (e) {
    warn(`${day}.json 읽기`, e);
    return [];
  }
}

/** 최근 며칠치 파일에서 이미 담은 id 를 모은다. 파일이 깨져 있으면 그 날은 건너뛴다. */
function recentIds(today: string, days: number = DEDUPE_WINDOW_DAYS): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < days; i++) {
    for (const item of readDay(addDays(today, -i))) seen.add(item.id);
  }
  return seen;
}

// ─── 요약 ───

/** 요약에 쓸 모델. 값이 없으면 가장 싼 모델을 쓴다. */
const MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-luna';

/**
 * 모델에 넘기는 스키마.
 *
 * 개수 제약(length/min/max)을 일부러 넣지 않았다. Structured Outputs 의 strict 모드는
 * JSON Schema 부분집합만 받아서 minItems/maxItems 가 거절될 수 있다. 개수는 프롬프트로
 * 요구하고, 실제 강제는 받아온 뒤 자르기 + 저장 직전의 newsItemSchema 검증이 한다.
 */
const summarySchema = z.object({
  summary: z.array(z.string()),
  whyItMatters: z.string(),
  tags: z.array(z.enum(NEWS_TAGS)),
});

/** 요약 한 줄의 길이 범위. 프롬프트로 요구하고, 어기면 한 번 더 시킨다. */
const MIN_LINE = 40;
const MAX_LINE = 70;

const SUMMARY_SYSTEM = `너는 개발자용 기술 뉴스 briefing 편집자다. 주어진 기사 하나를 한국어로 요약한다.

규칙
- summary 는 정확히 3줄.
- **각 줄은 공백 포함 ${MIN_LINE}자 이상 ${MAX_LINE}자 이하다. ${MIN_LINE - 1}자 이하나 ${MAX_LINE + 1}자 이상은 규칙 위반이다.**
  짧으면 맥락을 한 마디 더 붙여 늘리고, 길면 군더더기를 덜어낸다. 쓰기 전에 글자 수를 센다.
- 원문에 있는 사실만 쓴다. 원문에 없는 수치나 주장을 만들지 않는다.
- 원문이 불확실하게 말하면 "~로 보인다" 로 표시한다.
- 영어 원문이어도 출력은 한국어. 고유명사와 기술 용어는 원문 표기를 유지한다.
- whyItMatters 는 개발자 관점에서 왜 중요한지 한 문장.
- tags 는 다음 6개 중 1~2개만: ${NEWS_TAGS.join(' · ')}
- 발췌가 비어 있거나 제목뿐이면, 제목에서 확실히 알 수 있는 것만 쓰고 나머지는 추측하지 않는다.`;

interface SummarizeInput {
  title: string;
  url: string;
  source: string;
  excerpt?: string;
}

/** 3줄이고 각 줄이 길이 범위 안인지. */
function linesOk(summary: readonly string[]): boolean {
  return (
    summary.length === 3 &&
    summary.every((line) => line.length >= MIN_LINE && line.length <= MAX_LINE)
  );
}

async function askOnce(
  client: OpenAI,
  item: SummarizeInput,
  hint?: string,
): Promise<{ summary: string[]; whyItMatters: string; tags: NewsItem['tags'] }> {
  const response = await client.responses.parse({
    model: MODEL,
    instructions: hint ? `${SUMMARY_SYSTEM}\n\n${hint}` : SUMMARY_SYSTEM,
    input: JSON.stringify({
      title: item.title,
      url: item.url,
      source: item.source,
      excerpt: (item.excerpt ?? '').slice(0, EXCERPT_MAX),
    }),
    text: { format: zodTextFormat(summarySchema, 'news_summary') },
  });

  const parsed = response.output_parsed;
  if (!parsed) throw new Error('구조화 출력 파싱 실패');

  // 개수와 중복은 여기서 맞춘다. 스키마에 개수 제약을 못 넣었기 때문이다.
  return {
    summary: [...new Set(parsed.summary.map((line) => line.trim()).filter(Boolean))].slice(0, 3),
    whyItMatters: parsed.whyItMatters.trim(),
    tags: [...new Set(parsed.tags)].slice(0, 2),
  };
}

async function summarize(client: OpenAI, item: SummarizeInput): Promise<Partial<NewsItem>> {
  const first = await askOnce(client, item);
  if (linesOk(first.summary)) return first;

  // 길이 규칙은 스키마로 못 박을 수 없어서(strict 모드가 minLength 를 안 받는다)
  // 어긴 줄을 그대로 돌려주며 한 번만 다시 시킨다.
  const offenders = first.summary
    .map((line, i) => `${i + 1}번째 줄 ${line.length}자: ${line}`)
    .filter((_, i) => {
      const len = first.summary[i].length;
      return len < MIN_LINE || len > MAX_LINE;
    });

  const second = await askOnce(
    client,
    item,
    `직전 시도가 길이 규칙을 어겼다. 아래 줄을 ${MIN_LINE}~${MAX_LINE}자로 고쳐 다시 써라.\n${offenders.join('\n')}`,
  );

  // 두 번째도 어기면 더 나은 쪽을 쓴다. 요약이 아예 없는 것보다는 낫다.
  return linesOk(second.summary) || second.summary.length === 3 ? second : first;
}

/** 요약이 비어 있는 기존 기사를 며칠치까지 거슬러 올라가 채울지. */
const REFILL_DAYS = 3;

/**
 * 이미 저장됐지만 요약이 비어 있는 기사를 채운다.
 *
 * 키가 없던 날 수집한 기사는 제목·링크만 남는데, 그 뒤 키가 생겨도 중복 걸러내기에 막혀
 * 다시 수집되지 않는다. 그러면 그 날 기사는 영영 요약 없이 남는다. 이 단계가 그걸 메운다.
 *
 * 발췌는 남아 있지 않다(본문을 저장하지 않으므로). 제목만 보고 요약하게 되며,
 * 프롬프트가 "제목에서 확실히 알 수 있는 것만 쓰라"고 지시한다.
 */
async function refillSummaries(
  client: OpenAI,
  today: string,
  excerpts: Map<string, string>,
): Promise<number> {
  let filled = 0;
  let skipped = 0;

  for (let i = 0; i < REFILL_DAYS; i++) {
    const day = addDays(today, -i);
    const items = readDay(day);
    if (items.length === 0) continue;

    const blanks = items.filter((item) => item.summary.length === 0);
    if (blanks.length === 0) continue;

    let changed = false;
    for (const item of blanks) {
      // 발췌 없이 제목만으로 요약하면 세 줄이 같은 말을 되풀이한다.
      // 그런 요약은 없는 것만 못하므로, 발췌를 못 구하면 건너뛰고 빈 채로 둔다.
      const excerpt = await ensureExcerpt({ ...item, excerpt: excerpts.get(item.id) });
      if (!excerpt) {
        skipped++;
        continue;
      }
      try {
        Object.assign(item, await summarize(client, { ...item, excerpt }));
        filled++;
        changed = true;
      } catch (e) {
        warn(`요약 채우기 실패 "${item.title.slice(0, 30)}"`, e);
      }
    }

    if (!changed) continue;
    const validated = newsFileSchema.safeParse(items);
    if (!validated.success) {
      warn(`${day}.json 채우기 결과 검증 실패`, new Error(validated.error.issues[0].message));
      continue;
    }
    writeFileSync(
      path.join(NEWS_DIR, `${day}.json`),
      `${JSON.stringify(validated.data, null, 2)}\n`,
      'utf-8',
    );
    console.log(`  ${day}.json — 빈 요약 ${blanks.length}건 중 ${filled}건 채움`);
  }

  if (skipped > 0) {
    console.log(`  발췌를 못 구해 건너뛴 기사 ${skipped}건 (피드에서 내려간 글이다)`);
  }
  return filled;
}

// ─── 본체 ───

async function main(): Promise<void> {
  loadEnvFile();
  const today = todayStr();
  console.log(`\n[수집] ${today}`);

  const collected = (
    await Promise.all([fromGeekNews(), fromHackerNews(), fromArxiv()])
  ).flat();
  console.log(`  합계 ${collected.length}건`);

  if (collected.length === 0) {
    console.log('\n가져온 기사가 없다. 파일을 쓰지 않고 끝낸다.');
    return;
  }

  // 같은 실행 안에서의 중복과 과거 14일치 중복을 함께 걸러낸다.
  const seen = recentIds(today);
  const deduped: RawItem[] = [];
  for (const item of collected) {
    const id = makeId(item.url);
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(item);
  }
  console.log(`[중복 제거] ${collected.length} → ${deduped.length}건`);

  // 키가 없으면 요약 없이 저장한다. 제목·링크만 있어도 브리핑은 성립한다.
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const client = hasKey ? new OpenAI() : null;
  if (!client) {
    console.warn('  ⚠ OPENAI_API_KEY 가 비어 있다. 요약 없이 저장한다.');
  } else {
    console.log(`  요약 모델: ${MODEL}`);
  }

  // 지난 실행에서 요약을 못 채운 기사를 먼저 메운다. 오늘 파일을 갱신할 수 있으므로
  // 아래 existing 읽기보다 앞에 와야 한다.
  if (client) {
    // 이번에 읽은 피드의 발췌를 id 로 색인해 둔다. 저장된 기사에는 발췌가 없기 때문이다.
    const excerpts = new Map<string, string>();
    for (const item of collected) {
      const excerpt = item.excerpt?.trim();
      if (excerpt) excerpts.set(makeId(item.url), excerpt);
    }
    const filled = await refillSummaries(client, today, excerpts);
    if (filled > 0) console.log(`[요약 채우기] ${filled}건`);
  }

  // 오늘 파일이 이미 있으면 갈아엎지 않고 남은 자리만 채운다.
  // 하루에 두 번 돌려도 두 번째 실행이 헛돌지 않게 하려는 것이다.
  const existing = readDay(today);
  const roomLeft = Math.max(0, DAILY_NEWS_CAP - existing.length);
  const capsLeft = { ...SOURCE_CAPS };
  for (const item of existing) capsLeft[item.source] = Math.max(0, capsLeft[item.source] - 1);

  const picked = roomLeft === 0 ? [] : selectItems(deduped, capsLeft, roomLeft);
  console.log(
    `[선별] ${picked.length}건 (오늘 파일에 이미 ${existing.length}건, 남은 자리 ${roomLeft})`,
  );
  if (picked.length === 0) {
    console.log('\n새로 담을 기사가 없다. 파일을 그대로 둔다.');
    return;
  }

  const items: NewsItem[] = [];
  for (const raw of picked) {
    const base: NewsItem = {
      id: makeId(raw.url),
      title: raw.title,
      url: raw.url,
      source: raw.source,
      publishedAt: raw.publishedAt,
      summary: [],
      whyItMatters: '',
      tags: [],
    };

    if (client) {
      const excerpt = await ensureExcerpt(raw);
      if (excerpt) {
        try {
          Object.assign(base, await summarize(client, { ...raw, excerpt }));
        } catch (e) {
          // 요약 실패는 그 기사 하나만 비워 두고 넘어간다.
          warn(`요약 실패 "${raw.title.slice(0, 30)}"`, e);
        }
      } else {
        console.log(`  발췌를 못 구해 요약 생략: ${raw.title.slice(0, 40)}`);
      }
    }
    items.push(base);
  }

  // 저장 전에 우리 스키마로 다시 검증한다. 모델이 이상한 걸 채웠으면 여기서 걸린다.
  const validated = newsFileSchema.safeParse([...existing, ...items]);
  if (!validated.success) {
    console.error('\n✗ 만들어진 데이터가 스키마를 통과하지 못했다:');
    for (const issue of validated.error.issues.slice(0, 5)) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  mkdirSync(NEWS_DIR, { recursive: true });
  const outFile = path.join(NEWS_DIR, `${today}.json`);
  writeFileSync(outFile, `${JSON.stringify(validated.data, null, 2)}\n`, 'utf-8');

  const summarized = validated.data.filter((i) => i.summary.length > 0).length;
  console.log(`\n✓ ${path.relative(process.cwd(), outFile)} — ${validated.data.length}건 (요약 ${summarized}건)`);
}

// 어떤 예외가 여기까지 올라와도 프로세스는 성공으로 끝낸다.
main().catch((e) => {
  warn('수집 전체', e);
  console.log('\n실패했지만 정상 종료한다 — 내일 다시 시도한다.');
});
