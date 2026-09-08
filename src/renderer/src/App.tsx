import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { CierreCajaArqueo } from './views/CierreCajaArqueo';
import { DashboardPatrimonio } from './views/DashboardPatrimonio';
import { Clientes } from './views/Clientes';
import { Cobradores } from './views/Cobradores';
import { AltaOperacion } from './views/AltaOperacion';
import { GestionStock } from './views/GestionStock';
import { HojaDeRutaImprimible } from './views/HojaDeRutaImprimible';
import { CobradorPWA } from '../../pwa/components/CobradorPWA';
import { SupabaseSessionControl } from './components/SupabaseSessionControl';
import { AdminAccessGate } from './components/AdminAccessGate';
import { GuiaSimulacionModal } from './components/GuiaSimulacionModal';
import {
  LayoutDashboard,
  Users,
  BadgePercent,
  Boxes,
  FilePlus2,
  Coins,
  Printer,
  Smartphone,
  HelpCircle,
  LogIn,
  LogOut,
  Wifi,
} from 'lucide-react';
import { CREDIT_ON_BUILD_VERSION } from '@core/version';
import logoCreditOn from './assets/logo-credit-on.jpg';

const Backoffice: React.FC = () => {
  // Validación de versión de compilación para invalidación de cachés residuales
  if (typeof window !== 'undefined') {
    const versionGuardada = localStorage.getItem('credit_on_build_version');
    if (versionGuardada !== CREDIT_ON_BUILD_VERSION) {
      console.log(`[App] Nueva versión detectada: ${CREDIT_ON_BUILD_VERSION}. Purgando datos residuales...`);
      localStorage.setItem('credit_on_build_version', CREDIT_ON_BUILD_VERSION);
      localStorage.removeItem('credit_on_cartera_operaciones');
      localStorage.removeItem('credit_on_cobradores');
      localStorage.removeItem('credit_on_historial_cobros');
      localStorage.removeItem('credit_on_pwa_sesion_activa');
      localStorage.removeItem('credit_on_pwa_usuario_cobrador');
    }
  }

  const [vistaActual, setVistaActual] = useState<
    'patrimonio' | 'clientes' | 'cobradores' | 'stock' | 'alta' | 'cierre' | 'hoja' | 'pwa'
  >('patrimonio');

  const [modalGuiaAbierto, setModalGuiaAbierto] = useState(false);
  const [pwaSesionActiva, setPwaSesionActiva] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('credit_on_pwa_sesion_activa') === 'true';
    }
    return false;
  });
  const [pwaCobradorId, setPwaCobradorId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('credit_on_pwa_usuario_cobrador');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) return Number(parsed.id);
        }
      } catch {}
    }
    return 1;
  });
  const [cobradoresNombres] = useState<Record<number, string>>({
    1: 'Ariel Gómez',
    2: 'Carlos Mendilaharzu',
    3: 'Álvaro Morales',
    4: 'Mauro Sánchez',
    5: 'Antonela Rossi',
  });

  const [usuario, setUsuario] = useState<{
    nombre: string;
    rol: string;
    iniciales: string;
  }>({
    nombre: 'Administrador',
    rol: 'Admin / Dueño',
    iniciales: 'AD'
  });

  useEffect(() => {
    if (!supabase) return;

    const actualizarUsuario = (session: any) => {
      if (!session?.user) {
        setUsuario({
          nombre: 'Administrador',
          rol: 'Admin / Dueño',
          iniciales: 'AD'
        });
        return;
      }
      const u = session.user;
      const nombreCompleto =
        u.user_metadata?.nombre ||
        u.user_metadata?.full_name ||
        (u.email ? u.email.split('@')[0] : 'Administrador');

      const rolRaw = u.app_metadata?.credit_on_role || 'admin';
      const rolDisplay =
        rolRaw === 'admin'
          ? 'Admin / Dueño'
          : rolRaw.charAt(0).toUpperCase() + rolRaw.slice(1);

      const partes = nombreCompleto.trim().split(/\s+/);
      const iniciales =
        partes.length >= 2
          ? (partes[0][0] + partes[1][0]).toUpperCase()
          : nombreCompleto.slice(0, 2).toUpperCase();

      setUsuario({
        nombre: nombreCompleto,
        rol: rolDisplay,
        iniciales: iniciales || 'AD'
      });
    };

    supabase.auth.getSession().then(({ data }) => actualizarUsuario(data.session));

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      actualizarUsuario(session);
    });

    const handleBeforeUnload = () => {
      try {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        });
      } catch {}
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      authSub.subscription.unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // ─── MÉTRICAS DINÁMICAS DEL SUB-HEADER / TICKER OPERACIONAL ─────────────
  interface TickerMetricas {
    cajaDelDia: number;
    cobradoresActivos: number;
    eficienciaCobro: number;
    fechaTexto: string;
  }

  const formatFechaHoy = (): string => {
    const ahora = new Date();
    const diaSemana = ahora.toLocaleDateString('es-AR', { weekday: 'long' });
    const diaSemanaCap = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
    const dia = String(ahora.getDate()).padStart(2, '0');
    const mes = ahora.toLocaleDateString('es-AR', { month: 'long' });
    const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
    const anio = ahora.getFullYear();
    return `${diaSemanaCap}, ${dia} de ${mesCap} ${anio}`;
  };

  const calcularMetricasLocales = (): TickerMetricas => {
    const hoyIso = new Date().toISOString().split('T')[0];
    const fechaTexto = formatFechaHoy();

    // 1. Cobradores activos desde storage
    let cobradoresActivos = 4;
    try {
      const rawCob = localStorage.getItem('credit_on_cobradores');
      if (rawCob) {
        const cobradoresList = JSON.parse(rawCob);
        if (Array.isArray(cobradoresList) && cobradoresList.length > 0) {
          cobradoresActivos = cobradoresList.filter((c: any) => c.activo !== false).length;
        }
      }
    } catch {}

    // 2. Cobros registrados hoy e historial o arqueos de caja
    let cobrosHoy = 0;
    try {
      const rawHist = localStorage.getItem('credit_on_historial_cobros');
      if (rawHist) {
        const hist = JSON.parse(rawHist);
        if (Array.isArray(hist)) {
          cobrosHoy = hist
            .filter((h: any) => h.fecha_hora && h.fecha_hora.startsWith(hoyIso))
            .reduce((acc: number, h: any) => acc + (Number(h.monto_cobrado) || 0), 0);
        }
      }
    } catch {}

    let cierresHoy = 0;
    try {
      const rawCierres = localStorage.getItem('credit_on_cierres_caja');
      if (rawCierres) {
        const cierresList = JSON.parse(rawCierres);
        if (Array.isArray(cierresList)) {
          cierresHoy = cierresList
            .filter((c: any) => c.fecha && c.fecha.startsWith(hoyIso))
            .reduce((acc: number, c: any) => acc + (Number(c.fisico) || Number(c.neto) || Number(c.monto_rendido) || 0), 0);
        }
      }
    } catch {}

    const cajaDelDia = cobrosHoy > 0 ? cobrosHoy : cierresHoy;

    // 3. Eficiencia de cobro (% exigible vs cobrado en cartera activa)
    let totalCobrado = 0;
    let totalExigible = 0;
    try {
      const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
      if (rawOps) {
        const ops = JSON.parse(rawOps);
        if (Array.isArray(ops) && ops.length > 0) {
          for (const op of ops) {
            if (Array.isArray(op.cuotas) && op.cuotas.length > 0) {
              for (const c of op.cuotas) {
                const esExigible = c.estado === 'PAGADA' || (c.fecha_vencimiento && c.fecha_vencimiento <= hoyIso);
                if (esExigible) {
                  totalExigible += Number(c.monto_esperado) || Number(op.importe_cuota) || 0;
                  totalCobrado += Number(c.monto_pagado) || (c.estado === 'PAGADA' ? (Number(c.monto_esperado) || Number(op.importe_cuota) || 0) : 0);
                }
              }
            } else {
              const pagadas = Number(op.cuotas_pagadas) || 0;
              const vencidas = Number(op.mora?.cuotas_vencidas_impagas ?? op.mora?.cuotas_vencidas ?? 0);
              const cuotaImporte = Number(op.importe_cuota) || 0;
              totalExigible += (pagadas + vencidas) * cuotaImporte;
              totalCobrado += pagadas * cuotaImporte;
            }
          }
        }
      }
    } catch {}

    const eficienciaCobro = totalExigible > 0 ? Math.round((totalCobrado / totalExigible) * 1000) / 10 : (totalCobrado > 0 ? 100 : 0);

    return {
      cajaDelDia,
      cobradoresActivos,
      eficienciaCobro,
      fechaTexto
    };
  };

  const [tickerMetricas, setTickerMetricas] = useState<TickerMetricas>(calcularMetricasLocales);

  useEffect(() => {
    const recalcular = async () => {
      const base = calcularMetricasLocales();

      if (supabase) {
        try {
          const hoyIso = new Date().toISOString().split('T')[0];

          // Cobradores activos desde Supabase si existen
          const { data: cobrs } = await supabase
            .from('cobradores')
            .select('id_cobrador')
            .eq('activo', true);
          if (cobrs && cobrs.length > 0) {
            base.cobradoresActivos = cobrs.length;
          }

          // Rendimiento de cobradores desde Supabase si existe
          const { data: rend } = await supabase
            .from('vw_rendimiento_cobrador')
            .select('total_exigible, total_cobrado')
            .eq('fecha', hoyIso);
          if (rend && rend.length > 0) {
            const sumExigible = rend.reduce((s: number, r: any) => s + (Number(r.total_exigible) || 0), 0);
            const sumCobrado = rend.reduce((s: number, r: any) => s + (Number(r.total_cobrado) || 0), 0);
            if (sumExigible > 0) {
              base.eficienciaCobro = Math.round((sumCobrado / sumExigible) * 1000) / 10;
            }
            if (sumCobrado > 0) {
              base.cajaDelDia = sumCobrado;
            }
          }
        } catch {}
      }

      setTickerMetricas(base);
    };

    recalcular();

    window.addEventListener('credit_on_storage_update', recalcular);
    window.addEventListener('storage', recalcular);
    window.addEventListener('focus', recalcular);
    const interval = setInterval(recalcular, 3000);

    return () => {
      window.removeEventListener('credit_on_storage_update', recalcular);
      window.removeEventListener('storage', recalcular);
      window.removeEventListener('focus', recalcular);
      clearInterval(interval);
    };
  }, [vistaActual]);

  const titulosVistas: Record<string, { titulo: string; subtitulo: string; icon: string }> = {
    patrimonio: {
      titulo: 'Dashboard de Patrimonio y Valuación',
      subtitulo: 'Control patrimonial consolidado de cartera, stock físico y liquidez en tiempo real',
      icon: 'query_stats'
    },
    clientes: {
      titulo: 'Monitoreo de Clientes y Cartera',
      subtitulo: 'Estado de cuotas, mora en tiempo real y cobranzas de campo',
      icon: 'people'
    },
    cobradores: {
      titulo: 'Rendimiento de Cobradores',
      subtitulo: 'Efectividad diaria, carteras asignadas y cumplimiento de objetivos',
      icon: 'badge'
    },
    stock: {
      titulo: 'Gestión de Stock y Recuperación de Bienes',
      subtitulo: 'Control de inventario en depósito vs. mercadería financiada en calle',
      icon: 'inventory_2'
    },
    alta: {
      titulo: 'Alta de Operaciones y Cronograma',
      subtitulo: 'Originación de préstamos y ventas con cronograma lunes a sábado',
      icon: 'add_card'
    },
    cierre: {
      titulo: 'Cierre de Caja y Arqueo Diario',
      subtitulo: 'Rendición de cobranzas de calle, comisiones y conciliación física',
      icon: 'point_of_sale'
    },
    hoja: {
      titulo: 'Hojas de Ruta Imprimibles (A4)',
      subtitulo: 'Planilla física de contingencia para contingencias de corte de energía o señal',
      icon: 'print'
    },
    pwa: {
      titulo: 'Terminal Móvil de Campo (PWA Cobrador)',
      subtitulo: 'Simulador táctil y terminal offline para cobradores en calle (Ariel, Álvaro, Antonela, Carlos, etc.)',
      icon: 'smartphone'
    }
  };

  const actual = titulosVistas[vistaActual];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans select-none print:h-auto print:w-auto print:overflow-visible">
      {/* ===================================================================== */}
      {/* SIDEBAR LIMPIO, AIREADO Y MODERNO — GRIS EJECUTIVO SUAVE (OPCIÓN 2)   */}
      {/* ===================================================================== */}
      <aside className="no-print w-72 bg-slate-100/90 text-slate-700 flex flex-col justify-between flex-shrink-0 z-20 border-r border-slate-200/90 select-none">
        <div className="p-6 space-y-7">
          {/* Logo Empresa */}
          <div className="flex items-center gap-3 px-1">
            <img
              src={logoCreditOn}
              alt="CREDIT-ON"
              className="w-10 h-10 rounded-xl object-contain shadow-md shadow-slate-900/10 border border-slate-200/80 flex-shrink-0"
            />
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 leading-tight">
                CREDIT-ON
              </div>
              <div className="text-xs text-slate-500 font-medium tracking-wide">
                Santiago del Estero
              </div>
            </div>
          </div>

          {/* Menú de Navegación Espacioso */}
          <nav className="space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Monitoreo y Operaciones
            </div>

            {/* Dashboard */}
            <button
              onClick={() => setVistaActual('patrimonio')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'patrimonio'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LayoutDashboard size={19} strokeWidth={1.75} className={vistaActual === 'patrimonio' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Dashboard</span>
            </button>

            {/* Clientes */}
            <button
              onClick={() => setVistaActual('clientes')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'clientes'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users size={19} strokeWidth={1.75} className={vistaActual === 'clientes' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Clientes</span>
            </button>

            {/* Cobradores */}
            <button
              onClick={() => setVistaActual('cobradores')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'cobradores'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BadgePercent size={19} strokeWidth={1.75} className={vistaActual === 'cobradores' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Cobradores</span>
            </button>

            {/* Stock */}
            <button
              onClick={() => setVistaActual('stock')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'stock'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Boxes size={19} strokeWidth={1.75} className={vistaActual === 'stock' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Stock y Recuperación</span>
            </button>

            {/* Alta Operaciones */}
            <button
              onClick={() => setVistaActual('alta')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'alta'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <FilePlus2 size={19} strokeWidth={1.75} className={vistaActual === 'alta' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Alta de Operaciones</span>
            </button>

            {/* Cierre de Caja */}
            <button
              onClick={() => setVistaActual('cierre')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'cierre'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Coins size={19} strokeWidth={1.75} className={vistaActual === 'cierre' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Cierre de Caja y Arqueo</span>
            </button>

            <div className="pt-4 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3">
              Campo &amp; Contingencia
            </div>

            {/* Hojas de Ruta Imprimibles */}
            <button
              onClick={() => setVistaActual('hoja')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'hoja'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Printer size={19} strokeWidth={1.75} className={vistaActual === 'hoja' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Hojas de Ruta (A4)</span>
            </button>

            {/* Terminal Móvil PWA */}
            <button
              onClick={() => setVistaActual('pwa')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                vistaActual === 'pwa'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/90'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Smartphone size={19} strokeWidth={1.75} className={vistaActual === 'pwa' ? 'text-emerald-600' : 'text-slate-500'} />
              <span>Terminal Cobrador PWA</span>
            </button>
          </nav>
        </div>

        {/* Footer del Sidebar: Limpio y Discreto */}
        <div className="p-6 border-t border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-2 text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              En línea (Supabase)
            </span>
            <span className="text-[11px] font-mono text-slate-400">v1.2</span>
          </div>
          <div className="text-xs text-slate-500 leading-tight">
            Sucursal Central • Santiago del Estero
          </div>
        </div>
      </aside>

      {/* ===================================================================== */}
      {/* CONTENIDO PRINCIPAL: HEADER ÚNICO + VISTA CON ESPACIO */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden print:h-auto print:overflow-visible">
        {/* HEADER ÚNICO, ELEGANTE Y LIVIANO (64px) */}
        <header className="no-print h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between flex-shrink-0 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModalGuiaAbierto(true)}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              title="Abrir guía interactiva paso a paso para probar todo el sistema"
            >
              <HelpCircle size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">Guía de Prueba &amp; Simulación</span>
            </button>

            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100/80 px-3 py-1.5 rounded-lg">
              <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
              <span>{tickerMetricas.fechaTexto}</span>
            </div>

            <SupabaseSessionControl />

            {/* Avatar Usuario Dinámico */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                {usuario.iniciales}
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">{usuario.nombre}</div>
                <div className="text-[11px] text-slate-500 leading-tight">{usuario.rol}</div>
              </div>
            </div>
          </div>
        </header>

        {/* SUB-HEADER: TICKER OPERACIONAL EN VIVO */}
        <div className="no-print h-10 bg-slate-100/90 border-b border-slate-200/80 px-8 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Caja del Día:</span>
              <span className="font-mono font-bold text-emerald-600">
                ARS ${tickerMetricas.cajaDelDia.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Cobradores en Calle:</span>
              <span className="font-bold text-slate-800">
                {tickerMetricas.cobradoresActivos} {tickerMetricas.cobradoresActivos === 1 ? 'activo' : 'activos'}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Eficiencia de Cobro:</span>
              <span className={`font-bold ${tickerMetricas.eficienciaCobro >= 90 ? 'text-emerald-600' : tickerMetricas.eficienciaCobro >= 75 ? 'text-blue-600' : 'text-amber-600'}`}>
                {tickerMetricas.eficienciaCobro.toFixed(1)}%
              </span>
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
        <main className="flex-1 overflow-y-auto p-8 lg:p-10 bg-slate-50 print:p-0 print:overflow-visible print:bg-white">
          <div className="max-w-7xl mx-auto space-y-8">
            {vistaActual === 'patrimonio' && <DashboardPatrimonio onNavigate={(v) => setVistaActual(v as any)} />}
            {vistaActual === 'clientes' && <Clientes />}
            {vistaActual === 'cobradores' && <Cobradores />}
            {vistaActual === 'stock' && <GestionStock />}
            {vistaActual === 'alta' && <AltaOperacion />}
            {vistaActual === 'cierre' && <CierreCajaArqueo />}
            {vistaActual === 'hoja' && <HojaDeRutaImprimible />}
            {vistaActual === 'pwa' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Columna Izquierda: Información Operativa y Monitoreo de Campo */}
                <div className="lg:col-span-7 space-y-5">
                  {/* Tarjeta Ejecutiva Principal */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                        <Smartphone size={22} className="text-emerald-600" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900 leading-tight">
                          Terminal Móvil de Cobranzas en Calle (PWA)
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Herramienta de campo para celulares, tablets y simulación en tiempo real.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Arquitectura</span>
                        <span className="text-xs font-bold text-slate-800 block">PWA Offline-First</span>
                        <p className="text-[11px] text-slate-500 leading-tight">Opera sin conexión 4G con IndexedDB local en el teléfono.</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Imputación</span>
                        <span className="text-xs font-bold text-emerald-700 block">Cascada en Vivo</span>
                        <p className="text-[11px] text-slate-500 leading-tight">Cancela cuotas atrasadas e impacta en la caja del día.</p>
                      </div>
                      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Despliegue</span>
                        <span className="text-xs font-bold text-blue-700 block">Instalable Móvil</span>
                        <p className="text-[11px] text-slate-500 leading-tight">Sin pasar por Play Store; se agrega a la pantalla de inicio.</p>
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta de Guía Rápida para el Supervisor */}
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Instrucciones de Uso y Supervisión</span>
                    </h3>
                    <ul className="space-y-2.5 text-xs text-slate-600">
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                        <span><strong className="text-slate-900">Probar con cualquier cobrador:</strong> En la barra superior del teléfono interactivo a la derecha podés cambiar entre Ariel, Álvaro, Antonela o Carlos para ver la hoja de ruta asignada a cada uno.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                        <span><strong className="text-slate-900">Cobro rápido o parcial:</strong> Pulsá el botón verde <strong className="text-emerald-700">"Cobrar"</strong> para asentar la cuota del día en 1 clic, o <strong className="text-slate-800">"Otro…"</strong> para ingresar un importe personalizado con el teclado numérico.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                        <span><strong className="text-slate-900">Visitas sin cobro:</strong> Si un local está cerrado o el titular no se encuentra, pulsá <strong className="text-rose-600">"No Pagó"</strong> para registrar el motivo con fines de auditoría sin generar saldo negativo artificial.</span>
                      </li>
                      <li className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">4</span>
                        <span><strong className="text-slate-900">Reflejo inmediato en el sistema:</strong> Toda acción asentada en la terminal actualiza automáticamente la vista de <em>Clientes</em> y el <em>Cierre de Caja y Arqueo</em>.</span>
                      </li>
                    </ul>
                  </div>

                  {/* Tarjeta de Acceso Móvil para el Cobrador */}
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Acceso en Celulares de Calle</span>
                      <h4 className="text-sm font-bold text-white">¿Cómo ingresa el cobrador desde su smartphone?</h4>
                      <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                        Inicia sesión con su cuenta asignada de cobrador desde Chrome en Android o Safari en iPhone para ver únicamente su hoja de ruta diaria en pantalla completa.
                      </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-center justify-center bg-white/10 px-4 py-3 rounded-xl border border-white/10 shrink-0">
                      <Smartphone size={28} className="text-emerald-400" />
                      <span className="text-[10px] font-bold text-slate-200 mt-1">PWA Lista</span>
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Nav de la App Web + Mockup Interactivo del Teléfono con Marco Realista */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  {/* NAV SUPERIOR DE LA APP WEB */}
                  <div className="w-full max-w-[400px] bg-white border border-slate-200/90 rounded-2xl p-3 shadow-sm flex items-center justify-between gap-3 mb-3.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={logoCreditOn}
                        alt="Logo App Web"
                        className="w-9 h-9 rounded-xl object-contain shadow-sm border border-slate-200/80 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-extrabold text-xs text-slate-900 tracking-tight">CREDIT-ON CALLE</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full uppercase">PWA</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium truncate mt-1 flex items-center gap-1">
                          {pwaSesionActiva ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                              <span className="text-slate-700 font-semibold truncate">
                                Sesión: <span className="text-emerald-700 font-bold">{cobradoresNombres[pwaCobradorId] || 'Ariel'}</span> (Cobrador)
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                              <span className="text-slate-500">Sesión cerrada (Pantalla Login)</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Botón de Iniciar / Cerrar Sesión en la App Web */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {pwaSesionActiva ? (
                        <button
                          type="button"
                          onClick={() => setPwaSesionActiva(false)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          title="Cerrar sesión en la App Web para ver la pantalla de login"
                        >
                          <LogOut size={13} />
                          <span>Cerrar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setPwaSesionActiva(true)}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm shadow-emerald-600/20"
                          title="Iniciar sesión en la App Web"
                        >
                          <LogIn size={13} />
                          <span>Entrar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* MARCO EXTERIOR DEL CELULAR (CHASIS CON BORDES Y ESPACIO REALISTA) */}
                  <div className="w-full max-w-[400px] bg-slate-900 rounded-[52px] p-3.5 shadow-2xl shadow-slate-900/40 border-[4px] border-slate-700/80 ring-1 ring-slate-950 relative">
                    {/* Botones físicos laterales (simulación de chasis) */}
                    <div className="absolute -left-[6px] top-24 w-[4px] h-10 bg-slate-700 rounded-l-md"></div>
                    <div className="absolute -left-[6px] top-38 w-[4px] h-10 bg-slate-700 rounded-l-md"></div>
                    <div className="absolute -right-[6px] top-28 w-[4px] h-14 bg-slate-700 rounded-r-md"></div>

                    {/* PANTALLA INTERIOR DEL SMARTPHONE CON BORDES Y ESPACIO */}
                    <div className="w-full rounded-[40px] overflow-hidden bg-slate-50 border border-slate-800 flex flex-col relative h-[750px] shadow-inner">
                      {/* Notch / Dynamic Island Superior */}
                      <div className="bg-slate-900 px-6 pt-2 pb-1.5 flex items-center justify-between z-50 select-none">
                        <span className="text-[11px] font-bold font-mono text-white">09:41</span>
                        {/* Píldora / Cámara */}
                        <div className="w-20 h-4 bg-black rounded-full flex items-center justify-center gap-1.5 px-2">
                          <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse"></div>
                        </div>
                        {/* Iconos de Estado (WiFi + Batería) */}
                        <div className="flex items-center gap-1.5 text-white">
                          <Wifi size={11} />
                          <span className="text-[10px] font-mono font-bold">100%</span>
                        </div>
                      </div>

                      {/* Componente PWA */}
                      <div className="flex-1 overflow-hidden relative">
                        <CobradorPWA
                          cobradorIdInicial={pwaCobradorId}
                          sesionIniciadaExterna={pwaSesionActiva}
                          onCambiarSesionExterna={(activa, id) => {
                            setPwaSesionActiva(activa);
                            if (id) setPwaCobradorId(id);
                          }}
                        />
                      </div>

                      {/* Barra Inferior de Navegación del Celular (Home Bar) */}
                      <div className="bg-slate-50 py-1.5 flex justify-center items-center border-t border-slate-100 z-50">
                        <div className="w-28 h-1 bg-slate-300 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Guía Interactiva de Simulación y Pruebas */}
      <GuiaSimulacionModal
        isOpen={modalGuiaAbierto}
        onClose={() => setModalGuiaAbierto(false)}
        onNavegar={(vista) => setVistaActual(vista as any)}
      />
    </div>
  );
};

export const App: React.FC = () => (
  <AdminAccessGate>
    <Backoffice />
  </AdminAccessGate>
);
