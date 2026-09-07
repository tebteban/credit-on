import React, { useState } from 'react';
import { CierreCajaArqueo } from './views/CierreCajaArqueo';
import { DashboardPatrimonio } from './views/DashboardPatrimonio';
import { AltaOperacion } from './views/AltaOperacion';
import { GestionStock } from './views/GestionStock';
import { HojaDeRutaImprimible } from './views/HojaDeRutaImprimible';
import { CobradorPWA } from '../../pwa/components/CobradorPWA';
import { SupabaseSessionControl } from './components/SupabaseSessionControl';

export const App: React.FC = () => {
  const [vistaActual, setVistaActual] = useState<
    'cierre' | 'patrimonio' | 'alta' | 'stock' | 'hoja' | 'pwa'
  >('cierre');

  const titulosVistas: Record<string, { titulo: string; subtitulo: string; icon: string }> = {
    cierre: {
      titulo: 'Cierre de Caja y Arqueo Diario',
      subtitulo: 'Rendición de cobranzas de calle, comisiones y conciliación física',
      icon: 'point_of_sale'
    },
    patrimonio: {
      titulo: 'Dashboard de Patrimonio y Valuación',
      subtitulo: 'Control patrimonial consolidado de cartera, stock físico y liquidez en tiempo real',
      icon: 'query_stats'
    },
    alta: {
      titulo: 'Alta de Operaciones y Cronograma',
      subtitulo: 'Originación de préstamos y ventas con cronograma lunes a sábado',
      icon: 'add_card'
    },
    stock: {
      titulo: 'Gestión de Stock y Recuperación de Bienes',
      subtitulo: 'Control de inventario en depósito vs. mercadería financiada en calle',
      icon: 'inventory_2'
    },
    hoja: {
      titulo: 'Hojas de Ruta Imprimibles (A4)',
      subtitulo: 'Planilla física de contingencia para contingencias de corte de energía o señal',
      icon: 'print'
    },
    pwa: {
      titulo: 'Terminal Móvil de Campo (PWA Cobrador)',
      subtitulo: 'Simulador táctil de la aplicación móvil de cobranza offline de Ariel',
      icon: 'smartphone'
    }
  };

  const actual = titulosVistas[vistaActual];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans select-none">
      {/* ===================================================================== */}
      {/* SIDEBAR LIMPIO, AIREADO Y MODERNO */}
      {/* ===================================================================== */}
      <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col justify-between flex-shrink-0 z-20 border-r border-slate-800">
        <div className="p-6 space-y-8">
          {/* Logo Empresa */}
          <div className="flex items-center gap-3.5 px-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 font-black text-base flex items-center justify-center shadow-lg shadow-emerald-500/20">
              CO
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white leading-tight">
                CREDIT-ON
              </div>
              <div className="text-xs text-slate-400 font-medium tracking-wide">
                Santiago del Estero
              </div>
            </div>
          </div>

          {/* Menú de Navegación Espacioso */}
          <nav className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
              Operaciones de Caja
            </div>

            {/* Cierre de Caja */}
            <button
              onClick={() => setVistaActual('cierre')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'cierre'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
              <span>Cierre de Caja y Arqueo</span>
            </button>

            {/* Dashboard Patrimonio */}
            <button
              onClick={() => setVistaActual('patrimonio')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'patrimonio'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">query_stats</span>
              <span>Tablero de Patrimonio</span>
            </button>

            {/* Alta Operaciones */}
            <button
              onClick={() => setVistaActual('alta')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'alta'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">add_card</span>
              <span>Alta de Operaciones</span>
            </button>

            <div className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3">
              Administración &amp; Campo
            </div>

            {/* Stock y Depósito */}
            <button
              onClick={() => setVistaActual('stock')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'stock'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              <span>Stock y Recuperación</span>
            </button>

            {/* Hojas de Ruta Imprimibles */}
            <button
              onClick={() => setVistaActual('hoja')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'hoja'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">print</span>
              <span>Hojas de Ruta (A4)</span>
            </button>

            {/* Terminal Móvil PWA */}
            <button
              onClick={() => setVistaActual('pwa')}
              className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                vistaActual === 'pwa'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'text-emerald-400/90 hover:text-emerald-300 hover:bg-slate-800/60'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">smartphone</span>
              <span>Terminal Cobrador PWA</span>
            </button>
          </nav>
        </div>

        {/* Footer del Sidebar: Limpio y Discreto */}
        <div className="p-6 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              En línea (Supabase)
            </span>
            <span className="text-[11px] font-mono text-slate-500">v1.2</span>
          </div>
          <div className="text-xs text-slate-400 leading-tight">
            Sucursal Central • Santiago del Estero
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* CONTENIDO PRINCIPAL: HEADER ÚNICO + VISTA CON ESPACIO */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* HEADER ÚNICO, ELEGANTE Y LIVIANO (64px) */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">{actual.icon}</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                {actual.titulo}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-none">
                {actual.subtitulo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-lg">
              <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
              <span>Viernes, 04 de Septiembre 2026</span>
            </div>

            <SupabaseSessionControl />

            {/* Avatar Usuario */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                CM
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">Carlos Mendilaharzu</div>
                <div className="text-[11px] text-slate-500 leading-tight">Admin / Dueño</div>
              </div>
            </div>
          </div>
        </header>

        {/* SUB-HEADER: TICKER OPERACIONAL EN VIVO */}
        <div className="h-10 bg-slate-100/90 border-b border-slate-200/80 px-8 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Caja del Día:</span>
              <span className="font-mono font-bold text-emerald-600">ARS $486.200</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Cobradores en Calle:</span>
              <span className="font-bold text-slate-800">6 activos</span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Eficiencia de Cobro:</span>
              <span className="font-bold text-emerald-600">94.2%</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Auditoría Activa: Nivel 2
            </span>
          </div>
        </div>

        {/* ÁREA DE CONTENIDO CON PADDING CÓMODO Y SCROLL SUAVE */}
        <main className="flex-1 overflow-y-auto p-8 lg:p-10 bg-slate-50">
          <div className="max-w-7xl mx-auto space-y-8">
            {vistaActual === 'cierre' && <CierreCajaArqueo />}
            {vistaActual === 'patrimonio' && <DashboardPatrimonio />}
            {vistaActual === 'alta' && <AltaOperacion />}
            {vistaActual === 'stock' && <GestionStock />}
            {vistaActual === 'hoja' && <HojaDeRutaImprimible />}
            {vistaActual === 'pwa' && (
              <div className="max-w-md mx-auto bg-slate-950 rounded-3xl border-4 border-slate-700 shadow-2xl overflow-hidden my-4">
                <div className="bg-slate-900 text-white text-center py-2.5 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                  📱 Simulador de Terminal Móvil (Cobrador en Calle)
                </div>
                <CobradorPWA />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
