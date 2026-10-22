import { createHash, webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './server';
import { DevelopmentAuthProvider, pkceChallenge } from '../src/auth';

describe('PKCE sign-in', () => {
  it('uses SHA-256 and unpadded base64url for the challenge', async () => {
    vi.stubGlobal('crypto', webcrypto);
    const verifier = 'a'.repeat(43);
    expect(await pkceChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
    vi.unstubAllGlobals();
  });
  it('rejects a mismatched state before exchanging the code', async () => {
    sessionStorage.setItem(
      'stubline.pkce.pending',
      JSON.stringify({ verifier: 'a'.repeat(43), state: 'expected', returnPath: '/' }),
    );
    history.replaceState({}, '', '/callback?code=one&state=wrong');
    const provider = new DevelopmentAuthProvider('https://issuer.test');
    await expect(provider.complete()).rejects.toThrow('could not be verified');
    expect(location.pathname).toBe('/');
    expect(sessionStorage.getItem('stubline.pkce.pending')).toBeNull();
  });
  it('exchanges a matching code and clears the callback URL', async () => {
    sessionStorage.setItem(
      'stubline.pkce.pending',
      JSON.stringify({
        verifier: 'a'.repeat(43),
        state: 'expected',
        returnPath: '/?order=order-1',
      }),
    );
    history.replaceState({}, '', '/callback?code=one&state=expected');
    server.use(
      http.post('https://issuer.test/token', async ({ request }) => {
        const body = new URLSearchParams(await request.text());
        expect(body.get('grant_type')).toBe('authorization_code');
        expect(body.get('code_verifier')).toBe('a'.repeat(43));
        expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
        return HttpResponse.json({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 300,
        });
      }),
    );
    const result = await new DevelopmentAuthProvider('https://issuer.test').complete();
    expect(result).toEqual({ token: 'test-token', returnPath: '/?order=order-1' });
    expect(location.search).toBe('?order=order-1');
    expect(sessionStorage.getItem('stubline.pkce.pending')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('test-token');
  });
});
