import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronAPI {
  confirmarRendicionCaja: (payload: {
    id_cobrador: number;
    fecha: string;
    monto_rendido: number;
    notas?: string;
  }) => Promise<{
    exito: boolean;
    timestamp: string;
    id_cobrador: number;
    fecha: string;
    monto_rendido: number;
    mensaje: string;
  }>;
  imprimirHojaDeRuta: () => Promise<{ exito: boolean }>;
}

const api: ElectronAPI = {
  confirmarRendicionCaja: (payload) => ipcRenderer.invoke('cierre-caja:confirmar-rendicion', payload),
  imprimirHojaDeRuta: () => ipcRenderer.invoke('hoja-de-ruta:imprimir')
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api);
  } catch (error) {
    console.error('Error al exponer electronAPI:', error);
  }
} else {
  // @ts-ignore (define in window)
  window.electronAPI = api;
}
