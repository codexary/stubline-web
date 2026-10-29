import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  publicDir: process.env.VITE_DEMO === '1' ? 'demo-public' : 'public',
  cacheDir: './node_modules/.vite',
  plugins: [react()],
  test: {
    fsModuleCachePath: './node_modules/.vitest-cache',
    include: ['tests/*.test.ts', 'tests/*.test.tsx'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});
