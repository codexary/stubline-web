export interface AuthResult {
  token: string;
  returnPath: string;
}

export interface AuthProvider {
  begin(): Promise<string | void>;
  complete(): Promise<AuthResult | null>;
}

const pendingKey = 'stubline.pkce.pending';
interface PendingAuth {
  verifier: string;
  state: string;
  returnPath: string;
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return base64Url(digest);
}

function randomUrlSafe(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export class DevelopmentAuthProvider implements AuthProvider {
  constructor(
    private readonly issuerUrl: string,
    private readonly clientId = 'stubline-web',
    private readonly redirectUri = `${window.location.origin}/callback`,
  ) {}

  async begin(): Promise<void> {
    const verifier = randomUrlSafe();
    const state = randomUrlSafe();
    const challenge = await pkceChallenge(verifier);
    const pending: PendingAuth = {
      verifier,
      state,
      returnPath: window.location.pathname + window.location.search,
    };
    sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    const url = new URL('/authorize', this.issuerUrl);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();
    window.location.assign(url.href);
  }

  async complete(): Promise<AuthResult | null> {
    if (window.location.pathname !== '/callback') return null;
    const params = new URLSearchParams(window.location.search);
    const raw = sessionStorage.getItem(pendingKey);
    sessionStorage.removeItem(pendingKey);
    const pending: PendingAuth | null = raw ? (JSON.parse(raw) as PendingAuth) : null;
    const returnPath =
      pending?.returnPath?.startsWith('/') && !pending.returnPath.startsWith('//') ? pending.returnPath : '/';
    window.history.replaceState({}, '', returnPath);
    if (params.has('error')) throw new Error('Sign in was declined. Please try again.');
    if (!pending || !params.get('code') || !params.get('state') || params.get('state') !== pending.state) {
      throw new Error('Sign in could not be verified. Please try again.');
    }
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.get('code')!,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      code_verifier: pending.verifier,
    });
    const response = await fetch(new URL('/token', this.issuerUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) throw new Error('Sign in expired or failed. Please try again.');
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== 'object' ||
      !('access_token' in data) ||
      typeof data.access_token !== 'string' ||
      !('token_type' in data) ||
      data.token_type !== 'Bearer'
    ) {
      throw new Error('The sign-in response was invalid.');
    }
    return { token: data.access_token, returnPath };
  }
}
