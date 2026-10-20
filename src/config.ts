export interface RuntimeConfig {
  apiBaseUrl: string;
  tokenIssuerUrl: string;
}
export async function loadConfig(): Promise<RuntimeConfig> {
  const response = await fetch('/config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load site configuration.');
  const value: unknown = await response.json();
  if (
    typeof value !== 'object' ||
    value === null ||
    !('apiBaseUrl' in value) ||
    !('tokenIssuerUrl' in value) ||
    typeof value.apiBaseUrl !== 'string' ||
    typeof value.tokenIssuerUrl !== 'string'
  )
    throw new Error('Site configuration is invalid.');
  for (const url of [value.apiBaseUrl, value.tokenIssuerUrl])
    if (new URL(url).protocol !== 'https:') throw new Error('Configured services must use HTTPS.');
  return { apiBaseUrl: value.apiBaseUrl, tokenIssuerUrl: value.tokenIssuerUrl };
}
