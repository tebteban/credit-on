import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Configuración de Vite para pruebas y desarrollo del Sistema Administrativo Completo
 * (utilizado por Playwright para pruebas E2E de todas las pantallas de administración).
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  envDir: resolve(__dirname, '.'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@core': resolve(__dirname, 'src/core'),
      '@services': resolve(__dirname, 'src/services'),
      '@types': resolve(__dirname, 'src/types'),
      '@pwa': resolve(__dirname, 'src/pwa'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
