'use client';

import { useState } from 'react';

/** 기본은 접혀 있다. 뒷면에서 답을 먼저 읽게 하고 심화는 원할 때만 펴도록. */
export function Collapsible({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-medium"
      >
        {title}
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && <div className="border-t border-border px-3.5 py-3 text-sm leading-relaxed">{children}</div>}
    </div>
  );
}
