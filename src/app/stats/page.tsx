import { StatsClient } from '@/components/stats/StatsClient';
import { todayStr } from '@/lib/date';
import { getAllQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default function StatsPage() {
  return <StatsClient questions={getAllQuestions()} today={todayStr()} />;
}
