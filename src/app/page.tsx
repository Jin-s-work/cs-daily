import { HomeClient } from '@/components/HomeClient';
import { todayStr } from '@/lib/date';
import { readNewsPage } from '@/lib/news-files';
import { getAllQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default function TodayPage() {
  const [latest] = readNewsPage(1);

  return (
    <HomeClient
      questions={getAllQuestions()}
      today={todayStr()}
      briefing={latest ? { day: latest.day, items: latest.items.slice(0, 3) } : null}
    />
  );
}
