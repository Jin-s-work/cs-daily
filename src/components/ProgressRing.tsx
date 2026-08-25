/** 남은 양을 한눈에. 값이 0이면 링이 가득 찬다. */
export function ProgressRing({
  done,
  total,
  label,
  sub,
}: {
  done: number;
  total: number;
  label: string;
  sub: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 1 : Math.min(1, done / total);

  return (
    <div className="relative size-32 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke="var(--surface-2)" strokeWidth="10"
        />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums">{label}</span>
        <span className="text-[11px] text-muted">{sub}</span>
      </div>
    </div>
  );
}
