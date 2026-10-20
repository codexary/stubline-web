import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';

describe('runtime configuration', () => {
  it('rejects an insecure API origin', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ apiBaseUrl: 'http://api.test', tokenIssuerUrl: 'https://issuer.test' })),
    );
    try {
      await expect(loadConfig()).rejects.toThrow('HTTPS');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
