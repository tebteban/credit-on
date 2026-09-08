import React from 'react';
import { CobradorPWA } from './components/CobradorPWA';

export const AppPWA: React.FC = () => {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Terminal de Cobranzas Móvil Standalone */}
      <main className="flex-1 flex flex-col w-full">
        <CobradorPWA modoStandalone={true} />
      </main>
    </div>
  );
};
