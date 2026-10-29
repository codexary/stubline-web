import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './server';
import { cleanup } from '@testing-library/react';
import { resetDemoData } from '../src/demo/handlers';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDemoData();
  sessionStorage.clear();
  history.replaceState({}, '', '/');
});
afterAll(() => server.close());
