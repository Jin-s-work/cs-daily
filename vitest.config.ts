import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // UI 컴포넌트 테스트는 쓰지 않는다. src/lib 과 scripts 의 로직만 본다.
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
});
