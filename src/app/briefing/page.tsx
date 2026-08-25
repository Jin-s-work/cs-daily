import { BriefingClient } from '@/components/briefing/BriefingClient';

export default function BriefingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold md:text-2xl">브리핑</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        아침에 훑는 IT·AI 소식. 원문 본문은 저장하지 않는다 — 링크로 확인한다.
      </p>
      <BriefingClient />
    </div>
  );
}
