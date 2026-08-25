/** 네비게이션 항목. 하단 탭바와 좌측 레일이 같은 목록을 쓴다. */

export interface NavItem {
  href: string;
  label: string;
  /** 24×24 뷰박스 기준 stroke 아이콘 경로. */
  icon: string;
}

/**
 * 탭바에 놓는 다섯 개. 순서가 곧 하루의 흐름이다 —
 * 오늘 할 일을 보고, 새로 배우고, 익히고, 소식을 훑고, 쌓인 것을 확인한다.
 *
 * 이름은 담고 있는 것을 그대로 부른다. '학습' 같은 포괄어는 무엇이 있는지 알려주지 않는다.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: '오늘', icon: 'M4 11.5 12 4.5l8 7M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5' },
  { href: '/learn', label: '배우기', icon: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z' },
  { href: '/drill', label: '익히기', icon: 'M12 4v16M4 8.5h4M4 15.5h4M16 8.5h4M16 15.5h4' },
  { href: '/briefing', label: '브리핑', icon: 'M5 5h14v14H5zM8.5 9h7M8.5 12.5h7M8.5 16h4' },
  { href: '/stats', label: '통계', icon: 'M4 19V12M9.5 19V6M15 19v-9M20.5 19v-4' },
];

/** 탭바에는 없지만 자주 가는 곳. 레일과 홈에서 진입한다. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/exam', label: '점검 시험', icon: 'M9 4.5h6v2.5H9zM6.5 7h11v12.5h-11zM9.5 12h5M9.5 15.5h5' },
  { href: '/manage', label: '문제은행', icon: 'M4 6.5h16M4 12h16M4 17.5h16M8.5 3.5v17' },
];
