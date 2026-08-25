import { DrillClient } from '@/components/drill/DrillClient';
import { todayStr } from '@/lib/date';
import { getAllQuestions } from '@/lib/questions';

/**
 * 문제은행은 서버에서 검증까지 마쳐 넘기고, 학습 상태는 클라이언트가 IndexedDB 에서 읽는다.
 * 오늘 날짜도 서버에서 정해 내려보낸다 — 배포 환경이 UTC 라도 KST 기준으로 맞춘다.
 */
export const dynamic = 'force-dynamic';

export default function DrillPage() {
  return <DrillClient questions={getAllQuestions()} today={todayStr()} />;
}
