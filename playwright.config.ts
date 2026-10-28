import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { baseURL: process.env.WEB_URL ?? 'http://localhost:8088', ignoreHTTPSErrors: true },
  reporter: 'list',
});
