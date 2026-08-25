import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 개발 인디케이터가 기본 위치(왼쪽 아래)에서 모바일 하단 탭바의 첫 탭을 가린다.
  devIndicators: { position: 'top-left' },
};

export default nextConfig;
