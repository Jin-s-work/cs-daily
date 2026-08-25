import { QuestionBrowser } from '@/components/QuestionBrowser';
import { todayStr } from '@/lib/date';
import { getAllQuestions } from '@/lib/questions';

/**
 * 문제은행 전체 목록. 서버에서 JSON 을 읽고 Zod 검증까지 끝낸 뒤 넘긴다.
 * 검증에 실패하면 getAllQuestions 가 던지고 Next 의 에러 화면이 뜬다 — 조용히 비우지 않는다.
 */
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const questions = getAllQuestions();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold md:text-2xl">문제은행</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Git 문제은행 위에 로컬 수정을 얹어 보여준다. 레포에 남기려면 내보내기를 거쳐야 한다.
      </p>
      <QuestionBrowser questions={questions} initialQuery={q ?? ''} today={todayStr()} />
    </div>
  );
}
