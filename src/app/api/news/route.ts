import { NextResponse } from 'next/server';
import { readNewsPage } from '@/lib/news-files';

/** 무한 스크롤이 한 번에 가져가는 날짜 수. */
const PAGE_DAYS = 3;

/**
 * GET /api/news?before=YYYY-MM-DD
 * before 보다 이전 날짜를 최신순으로 몇 일치 준다. before 가 없으면 최신부터.
 */
export async function GET(request: Request) {
  const before = new URL(request.url).searchParams.get('before') ?? undefined;

  if (before && !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    return NextResponse.json({ error: 'before 는 YYYY-MM-DD 형식이어야 한다' }, { status: 400 });
  }

  const days = readNewsPage(PAGE_DAYS, before);
  return NextResponse.json({
    days,
    // 더 읽을 게 있는지 클라이언트가 판단하지 않게 서버가 알려준다.
    hasMore: days.length === PAGE_DAYS,
  });
}
