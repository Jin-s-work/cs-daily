import { ExamClient } from '@/components/exam/ExamClient';
import { todayStr } from '@/lib/date';
import { getAllQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default function ExamPage() {
  return <ExamClient questions={getAllQuestions()} today={todayStr()} />;
}
