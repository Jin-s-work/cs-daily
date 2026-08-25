import Link from 'next/link';
import { QuestionDraftForm } from '@/components/QuestionDraftForm';
import { getAllQuestions } from '@/lib/questions';

export const dynamic = 'force-dynamic';

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; url?: string; summary?: string }>;
}) {
  const { title, url, summary } = await searchParams;
  const existingIds = getAllQuestions().map((q) => q.id);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/briefing" className="text-xs text-muted hover:text-foreground">
        ← 브리핑
      </Link>
      <h1 className="mt-2 text-xl font-semibold md:text-2xl">문제 초안</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        이 폼은 저장하지 않는다. 만들어진 JSON 을 문제은행 파일에 붙여넣어야 반영된다.
      </p>
      <QuestionDraftForm
        existingIds={existingIds}
        initial={{ title: title ?? '', url: url ?? '', summary: summary ?? '' }}
      />
    </div>
  );
}
