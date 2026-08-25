import { LearnClient } from '@/components/learn/LearnClient';
import { todayStr } from '@/lib/date';
import { getAllQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default function LearnPage() {
  return <LearnClient questions={getAllQuestions()} today={todayStr()} />;
}
