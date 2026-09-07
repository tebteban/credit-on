import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const preloadPath = existsSync(join(__dirname, '../preload/index.mjs'))
    ? join(__dirname, '../preload/index.mjs')
    : join(__dirname, '../preload/index.js');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    show: true,
    autoHideMenuBar: false,
    title: 'CREDIT-ON — Sistema de Gestión y Cobranzas',
    backgroundColor: '#020617',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Permitir inspeccionar con F12
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Reenviar errores del renderer a la terminal
  mainWindow.webContents.on('console-message', (_event, _level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Error did-fail-load: ${errorCode} - ${errorDescription} (${validatedURL})`);
  });

  // HMR en desarrollo o carga de archivo local en producción
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

// -----------------------------------------------------------------------------
// IPC HANDLERS PARA BACKOFFICE
// -----------------------------------------------------------------------------

// 1. Confirmar rendición y cierre de caja
ipcMain.handle('cierre-caja:confirmar-rendicion', async (_event, payload: { id_cobrador: number; fecha: string; monto_rendido: number; notas?: string }) => {
  console.log('[IPC] Confirmando rendición de caja:', payload);
  // Simulación / llamada a Supabase fn_cerrar_caja
  return {
    exito: true,
    timestamp: new Date().toISOString(),
    id_cobrador: payload.id_cobrador,
    fecha: payload.fecha,
    monto_rendido: payload.monto_rendido,
    mensaje: 'Rendición de caja confirmada exitosamente. Registros marcados como rendido_en_caja = TRUE.'
  };
});

// 2. Impresión directa / PDF de hoja de ruta
ipcMain.handle('hoja-de-ruta:imprimir', async () => {
  if (!mainWindow) return { exito: false };
  mainWindow.webContents.print({
    silent: false,
    printBackground: true
  });
  return { exito: true };
});

// -----------------------------------------------------------------------------
// CICLO DE VIDA DE ELECTRON
// -----------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
