import React, { useState, useEffect } from 'react';
import { CobradorPWA } from './components/CobradorPWA';
import { Download, Smartphone } from 'lucide-react';

export const AppPWA: React.FC = () => {
  const [promptInstalacion, setPromptInstalacion] = useState<any>(null);
  const [mostrarBotonInstalar, setMostrarBotonInstalar] = useState<boolean>(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPromptInstalacion(e);
      setMostrarBotonInstalar(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setMostrarBotonInstalar(false);
      setPromptInstalacion(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstalar = async () => {
    if (!promptInstalacion) return;
    promptInstalacion.prompt();
    const { outcome } = await promptInstalacion.userChoice;
    if (outcome === 'accepted') {
      setMostrarBotonInstalar(false);
    }
    setPromptInstalacion(null);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Banner de instalación PWA opcional para móviles */}
      {mostrarBotonInstalar && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-3 py-2 flex items-center justify-between text-xs shadow-md z-50">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-200 animate-pulse" />
            <span className="font-semibold text-[11px] sm:text-xs">
              Instala CREDIT-ON en tu celular para acceder sin navegador
            </span>
          </div>
          <button
            onClick={handleInstalar}
            className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Instalar App</span>
          </button>
        </div>
      )}

      {/* Terminal de Cobranzas Móvil Standalone */}
      <main className="flex-1 flex flex-col w-full">
        <CobradorPWA modoStandalone={true} />
      </main>
    </div>
  );
};
