import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppPWA } from './AppPWA';
import './pwa.css';

// Registrar Service Worker para soporte Offline en navegadores móviles
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado con alcance:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Error registrando Service Worker:', error);
      });
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppPWA />
    </React.StrictMode>
  );
}
