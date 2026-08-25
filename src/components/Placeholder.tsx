/** 아직 구현 전인 라우트의 껍데기. 무엇이 없는지 숨기지 않고 그대로 적는다. */
export function Placeholder({
  title,
  phase,
  what,
}: {
  title: string;
  phase: string;
  what: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <div className="inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs text-muted">
          {phase}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">{what}</p>
      </div>
    </div>
  );
}
