'use client';

/**
 * 반응형 셸. 모바일은 하단 탭바, md 이상은 좌측 레일로 바뀐다.
 * 현재 경로를 알아야 활성 탭을 칠할 수 있어서 클라이언트 컴포넌트다.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PRIMARY_NAV, SECONDARY_NAV, type NavItem } from '@/lib/nav';
import { NavIcon } from './NavIcon';

function isActive(pathname: string, href: string): boolean {
  // '/' 는 완전 일치일 때만 활성. 안 그러면 모든 경로에서 켜진다.
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-accent text-accent-fg font-medium'
          : 'text-muted hover:bg-surface-muted hover:text-foreground'
      }`}
    >
      <NavIcon d={item.icon} className="size-5 shrink-0" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      {/* 데스크톱 좌측 레일 */}
      <nav
        aria-label="주요 메뉴"
        className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:p-4"
      >
        <div className="mb-4 px-3 py-2">
          <div className="text-base font-semibold">CS Daily Drill</div>
          <div className="text-xs text-muted">매일 조금씩</div>
        </div>
        {PRIMARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="my-3 border-t border-border" />
        {SECONDARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      {/* 본문. 모바일에서는 하단 탭바 높이만큼 아래 여백을 준다. */}
      <main className="min-w-0 flex-1 px-4 pt-5 pb-24 md:px-8 md:py-8">{children}</main>

      {/* 모바일 하단 탭바 */}
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center gap-1 py-2 text-[11px] ${
                    active ? 'text-accent font-medium' : 'text-muted'
                  }`}
                >
                  <NavIcon d={item.icon} className="size-6" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
