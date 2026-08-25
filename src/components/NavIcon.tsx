/** 네비 아이콘. 외부 아이콘 패키지를 넣지 않으려고 경로만 받아 그린다. */
export function NavIcon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
