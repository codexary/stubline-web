import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  cacheDir: './node_modules/.vite',
  plugins: [react()],
  test: {
    fsModuleCachePath: './node_modules/.vitest-cache',
    include: ['tests/*.test.ts', 'tests/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
