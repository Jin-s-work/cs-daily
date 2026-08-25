/** 네비게이션 항목. 하단 탭바와 좌측 레일이 같은 목록을 쓴다. */

export interface NavItem {
  href: string;
  label: string;
  /** 24×24 뷰박스 기준 stroke 아이콘 경로. */
  icon: string;
}

/** 하단 탭바에 들어가는 다섯 개. 순서가 곧 탭 순서다. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: '오늘', icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5' },
  { href: '/drill', label: '드릴', icon: 'M4 6h16M4 12h16M4 18h10' },
  { href: '/briefing', label: '브리핑', icon: 'M4 5h16v14H4zM8 9h8M8 13h8M8 17h5' },
  { href: '/exam', label: '시험', icon: 'M9 4h6v3H9zM6 7h12v13H6zM9 12h6M9 16h6' },
  { href: '/stats', label: '통계', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

/** 탭바에는 안 넣지만 접근은 되어야 하는 것. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/manage', label: '문제은행', icon: 'M4 7h16M4 12h16M4 17h16M8 4v16' },
];
