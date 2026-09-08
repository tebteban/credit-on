/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_COBRADOR_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  electronAPI?: {
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
  };
}
