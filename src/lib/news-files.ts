/**
 * content/news/*.json 을 읽는다. 서버 전용이다.
 *
 * 문제은행(questions.ts)과 달리 검증 실패에도 던지지 않는다. 브리핑은 어제 것이 깨졌다고
 * 오늘 것까지 못 보여줄 이유가 없다 — 깨진 날은 건너뛰고 경고만 남긴다.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { newsFileSchema, type NewsItem } from './news';

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');

/** 파일명이 날짜인지. 'YYYY-MM-DD.json' 만 받는다. */
const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})\.json$/;

/** 뉴스가 있는 날짜를 최신순으로. 파일이 없으면 빈 배열. */
export function listNewsDays(): string[] {
  if (!existsSync(NEWS_DIR)) return [];
  return readdirSync(NEWS_DIR)
    .map((f) => FILE_PATTERN.exec(f)?.[1])
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse();
}

/** 하루치 기사. 파일이 없거나 깨졌으면 빈 배열. */
export function readNewsDay(day: string): NewsItem[] {
  if (!FILE_PATTERN.test(`${day}.json`)) return [];
  const file = path.join(NEWS_DIR, `${day}.json`);
  if (!existsSync(file)) return [];
  try {
    const parsed = newsFileSchema.safeParse(JSON.parse(readFileSync(file, 'utf-8')));
    if (!parsed.success) {
      console.warn(`[news] ${day}.json 이 스키마를 통과하지 못했다 — 건너뛴다`);
      return [];
    }
    return parsed.data;
  } catch (e) {
    console.warn(`[news] ${day}.json 읽기 실패 — 건너뛴다:`, e);
    return [];
  }
}

/** 화면에 넘길 하루 묶음. */
export interface NewsDay {
  day: string;
  items: NewsItem[];
}

/**
 * 최신 날짜부터 count 일치를 읽는다. before 를 주면 그 날짜보다 이전 것만.
 * 무한 스크롤이 이 함수를 페이지 단위로 부른다.
 */
export function readNewsPage(count: number, before?: string): NewsDay[] {
  const days = listNewsDays().filter((d) => (before ? d < before : true));
  const out: NewsDay[] = [];
  for (const day of days.slice(0, count)) {
    const items = readNewsDay(day);
    // 빈 날은 굳이 카드 없는 헤더만 보여줄 이유가 없다.
    if (items.length > 0) out.push({ day, items });
  }
  return out;
}
