import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadConfig } from './config';
import './style.css';
async function start() {
  let authProvider;
  if (import.meta.env.VITE_DEMO === '1') {
    const [{ startDemoWorker }, { DemoAuthProvider }] = await Promise.all([
      import('./demo/browser'),
      import('./demo/auth'),
    ]);
    await startDemoWorker();
    authProvider = new DemoAuthProvider();
  }
  const config = await loadConfig();
  return { config, authProvider };
}
start()
  .then(({ config, authProvider }) =>
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App config={config} authProvider={authProvider} demo={import.meta.env.VITE_DEMO === '1'} />
      </React.StrictMode>,
    ),
  )
  .catch((error) => {
    document.getElementById('root')!.textContent = error instanceof Error ? error.message : 'Could not start site.';
  });
