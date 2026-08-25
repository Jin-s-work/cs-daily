'use client';

/**
 * 반응형 셸. 모바일은 떠 있는 하단 탭바, md 이상은 좌측 레일이다.
 *
 * 탭바는 불투명한 띠가 아니라 반투명 재료 층이다. 콘텐츠가 그 아래로 흘러가야
 * 화면이 잘려 보이지 않고, 지금 읽던 것이 어디로 갔는지 알 수 있다.
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
      className={`btn justify-start !px-3 ${active ? 'btn-primary' : 'btn-ghost'}`}
    >
      <NavIcon d={item.icon} className="size-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:flex">
      <nav
        aria-label="주요 메뉴"
        className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-1 md:border-r md:border-border md:px-4 md:py-5"
      >
        <div className="mb-5 px-3">
          <div className="t-title">CS Daily</div>
          <div className="t-caption">하루 한 걸음</div>
        </div>
        {PRIMARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="my-3 h-px bg-border" />
        {SECONDARY_NAV.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      {/* 모바일에서는 떠 있는 탭바 높이만큼 아래를 비워 둔다. */}
      <main className="min-w-0 flex-1 px-4 pt-6 pb-32 md:px-10 md:py-10">{children}</main>

      <nav
        aria-label="주요 메뉴"
        className="material fixed inset-x-0 bottom-0 z-20 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="flex flex-col items-center gap-1 py-2.5 transition-transform duration-100 active:scale-95"
                >
                  <NavIcon
                    d={item.icon}
                    className={`size-[22px] ${active ? 'text-accent' : 'text-muted'}`}
                  />
                  <span
                    className={`text-[10.5px] tracking-tight ${
                      active ? 'font-semibold text-accent' : 'text-muted'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
