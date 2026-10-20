import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { loadConfig } from './config';
import './style.css';
loadConfig()
  .then((config) =>
    createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <App config={config} />
      </React.StrictMode>,
    ),
  )
  .catch((error) => {
    document.getElementById('root')!.textContent = error instanceof Error ? error.message : 'Could not start site.';
  });
