import type { RuntimeConfig } from './config';
export function App({ config }: { config: RuntimeConfig }) {
  return (
    <main>
      <h1>Stubline tickets</h1>
      <p>Connecting to {config.apiBaseUrl}</p>
    </main>
  );
}
