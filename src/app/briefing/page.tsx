import { BriefingClient } from '@/components/briefing/BriefingClient';

export default function BriefingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="t-display">브리핑</h1>
        <p className="t-caption mt-1">
          아침에 훑는 IT·AI 소식. 원문 본문은 저장하지 않는다 — 링크로 확인한다.
        </p>
      </header>
      <BriefingClient />
    </div>
  );
}
