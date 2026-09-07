import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  MapPin, 
  Phone, 
  CheckCircle, 
  AlertTriangle, 
  DollarSign, 
  XCircle, 
  Navigation,
  Sparkles,
  Search,
  Check
} from 'lucide-react';
import { localDb, ParadaHojaRuta } from '../db/pwa-db';
import { syncEngine } from '../sync/sync-engine';
import { KeypadModal } from './KeypadModal';
import { NoPagoModal } from './NoPagoModal';
import { isSupabaseConfigured, supabase } from '../../renderer/src/lib/supabase';

export const CobradorPWA: React.FC = () => {
  const [paradas, setParadas] = useState<ParadaHojaRuta[]>([]);
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [soloPendientes, setSoloPendientes] = useState<boolean>(false);

  // Estado de conectividad y sincronización
  const [syncStatus, setSyncStatus] = useState({
    isOnline: true,
    pendientesCount: 0,
    sincronizando: false,
    ultimoSync: 'Recién',
  });

  // Modales
  const [modalKeypadOp, setModalKeypadOp] = useState<ParadaHojaRuta | null>(null);
  const [modalNoPagoOp, setModalNoPagoOp] = useState<ParadaHojaRuta | null>(null);
  const [origenRuta, setOrigenRuta] = useState<'SUPABASE' | 'DEMO' | 'LOCAL'>('LOCAL');

  // Datos semilla de la hoja de ruta para el cobrador Ariel en la calle
  const semillaInicial: ParadaHojaRuta[] = [
    {
      nro_op: 450,
      orden_recorrido: 1,
      id_cobrador: 1,
      cliente: 'PÉREZ JUAN CARLOS',
      telefono: '385-4123456',
      domicilio: 'AV. BELGRANO 1420 - B° CENTRO',
      tipo: 'EFECTIVO',
      cuota_diaria: 5000,
      saldo_restante: 65000,
      cuotas_vencidas: 0,
      deuda_vencida: 0,
      estado_visita: 'PENDIENTE',
    },
    {
      nro_op: 452,
      orden_recorrido: 2,
      id_cobrador: 1,
      cliente: 'COMERCIAL EL AMIGO - SILVIA',
      telefono: '385-5987654',
      domicilio: 'LIBERTAD 840 - B° HUAICO HONDO',
      tipo: 'PRODUCTO',
      producto: 'FREEZER GAFA 280L',
      cuota_diaria: 4000,
      saldo_restante: 128000,
      cuotas_vencidas: 0,
      deuda_vencida: 0,
      estado_visita: 'PENDIENTE',
    },
    {
      nro_op: 458,
      orden_recorrido: 3,
      id_cobrador: 1,
      cliente: 'GÓMEZ MARÍA LAURA',
      telefono: '385-6112233',
      domicilio: 'ROCA SUR 245 - B° CABILDO',
      tipo: 'EFECTIVO',
      cuota_diaria: 2500,
      saldo_restante: 32500,
      cuotas_vencidas: 2,
      deuda_vencida: 5000,
      estado_visita: 'PENDIENTE',
    },
    {
      nro_op: 461,
      orden_recorrido: 4,
      id_cobrador: 1,
      cliente: 'TALLER MECÁNICO RODRÍGUEZ',
      telefono: '385-4889900',
      domicilio: 'AV. COLÓN SUR 3100',
      tipo: 'PRODUCTO',
      producto: 'AIRE ACOND. BGH 3000F',
      cuota_diaria: 8000,
      saldo_restante: 240000,
      cuotas_vencidas: 0,
      deuda_vencida: 0,
      estado_visita: 'PENDIENTE',
    },
    {
      nro_op: 469,
      orden_recorrido: 5,
      id_cobrador: 1,
      cliente: 'CORVALÁN RAMÓN E.',
      telefono: '385-5334455',
      domicilio: 'PASAJE 12 CASA 44 - B° AUTONOMÍA',
      tipo: 'EFECTIVO',
      cuota_diaria: 15000,
      saldo_restante: 90000,
      cuotas_vencidas: 3,
      deuda_vencida: 45000,
      estado_visita: 'PENDIENTE',
    },
    {
      nro_op: 472,
      orden_recorrido: 6,
      id_cobrador: 1,
      cliente: 'FARMACIA SAN ROQUE',
      telefono: '385-4221199',
      domicilio: 'MITRE 620 - CENTRO',
      tipo: 'PRODUCTO',
      producto: 'SMART TV 43 PULGADAS',
      cuota_diaria: 6000,
      saldo_restante: 180000,
      cuotas_vencidas: 0,
      deuda_vencida: 0,
      estado_visita: 'PENDIENTE',
    },
  ];

  // Carga inicial desde IndexedDB
  useEffect(() => {
    async function loadData() {
      await localDb.init();
      const stored = await localDb.obtenerHojaDeRuta();
      const cobradorId = Number(import.meta.env.VITE_COBRADOR_ID || 1);

      if (isSupabaseConfigured && supabase) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data, error } = await supabase
            .from('vw_hoja_de_ruta')
            .select('nro_op, orden_recorrido, id_cobrador, cliente, telefono, domicilio, tipo, producto, importe_cuota, saldo_restante, monto_exigible_hoy, cuotas_vencidas, deuda_vencida')
            .eq('id_cobrador', cobradorId)
            .order('orden_recorrido');

          if (!error) {
            const rutaRemota: ParadaHojaRuta[] = (data || []).map((item) => ({
              nro_op: Number(item.nro_op),
              orden_recorrido: Number(item.orden_recorrido || 0),
              id_cobrador: Number(item.id_cobrador),
              cliente: item.cliente,
              telefono: item.telefono || undefined,
              domicilio: item.domicilio || '',
              tipo: item.tipo,
              producto: item.producto || undefined,
              cuota_diaria: Number(item.monto_exigible_hoy || item.importe_cuota),
              saldo_restante: Number(item.saldo_restante),
              cuotas_vencidas: Number(item.cuotas_vencidas || 0),
              deuda_vencida: Number(item.deuda_vencida || 0),
              estado_visita: 'PENDIENTE',
            }));
            await localDb.guardarHojaDeRuta(rutaRemota);
            setParadas(rutaRemota);
            setOrigenRuta('SUPABASE');
            return;
          }
          console.warn('[PWA] No se pudo descargar la hoja de ruta:', error.message);
        }
      }

      if (stored.length === 0) {
        await localDb.guardarHojaDeRuta(semillaInicial);
        setParadas(semillaInicial);
        setOrigenRuta('DEMO');
      } else {
        setParadas(stored);
        setOrigenRuta('LOCAL');
      }
    }
    loadData();

    // Suscribir al motor de sincronización
    const unsub = syncEngine.suscribir(setSyncStatus);
    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session) loadData();
    }).data.subscription;

    return () => {
      unsub();
      authSubscription?.unsubscribe();
    };
  }, []);

  // Métricas del día
  const metricas = useMemo(() => {
    const totalCobrado = paradas
      .filter((p) => p.estado_visita === 'COBRADO')
      .reduce((sum, p) => sum + (p.monto_cobrado_hoy || 0), 0);

    const visitados = paradas.filter((p) => p.estado_visita !== 'PENDIENTE').length;
    const totalLocales = paradas.length;
    const porcentajeProgreso = totalLocales > 0 ? (visitados / totalLocales) * 100 : 0;

    return { totalCobrado, visitados, totalLocales, porcentajeProgreso };
  }, [paradas]);

  // Manejo de acciones táctiles rápidas
  const handleCobroCompleto = async (parada: ParadaHojaRuta) => {
    await syncEngine.registrarCobroEnRuta(parada.nro_op, parada.id_cobrador, parada.cuota_diaria);
    const updated = await localDb.obtenerHojaDeRuta();
    setParadas(updated);
  };

  const handleConfirmarOtroMonto = async (monto: number) => {
    if (!modalKeypadOp) return;
    await syncEngine.registrarCobroEnRuta(modalKeypadOp.nro_op, modalKeypadOp.id_cobrador, monto);
    const updated = await localDb.obtenerHojaDeRuta();
    setParadas(updated);
  };

  const handleConfirmarNoPago = async (motivo: string, notas?: string) => {
    if (!modalNoPagoOp) return;
    await syncEngine.registrarNoPagoEnRuta(modalNoPagoOp.nro_op, modalNoPagoOp.id_cobrador, motivo, notas);
    const updated = await localDb.obtenerHojaDeRuta();
    setParadas(updated);
  };

  const paradasFiltradas = useMemo(() => {
    return paradas.filter((p) => {
      const matchTexto =
        p.cliente.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.domicilio.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        String(p.nro_op).includes(filtroTexto);

      if (soloPendientes) {
        return matchTexto && p.estado_visita === 'PENDIENTE';
      }
      return matchTexto;
    });
  }, [paradas, filtroTexto, soloPendientes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* ===================================================================== */}
      {/* HEADER FIJO TIPO TERMINAL (ALTO CONTRASTE BAJO EL SOL) */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-slate-900 border-b-2 border-slate-800 shadow-xl p-3.5 space-y-2.5">
        {/* Fila 1: Logo + Indicador de Conexión + Botón Sincronizar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-sky-600 flex items-center justify-center font-black text-white text-sm">
              CO
            </span>
            <div>
              <div className="font-extrabold text-sm tracking-wide text-white leading-tight">
                CREDIT-ON CALLE
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Cobrador: Ariel</div>
              {origenRuta !== 'SUPABASE' && (
                <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wide">
                  {origenRuta === 'DEMO' ? 'Datos de demostración' : 'Copia local sin actualizar'}
                </div>
              )}
            </div>
          </div>

          {/* Badge de Conectividad */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                syncStatus.isOnline
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50'
                  : 'bg-amber-950 text-amber-300 border border-amber-500/50'
              }`}
            >
              {syncStatus.isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ONLINE</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>

            {/* Botón Sync */}
            <button
              onClick={() => syncEngine.sincronizarPendientes()}
              disabled={syncStatus.sincronizando || !syncStatus.isOnline}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 relative disabled:opacity-50"
              title="Sincronizar ahora con Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus.sincronizando ? 'animate-spin text-sky-400' : ''}`} />
              {syncStatus.pendientesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-black rounded-full flex items-center justify-center">
                  {syncStatus.pendientesCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Fila 2: Resumen del Día: "$145.000 cobrados / 18 de 34 locales" */}
        <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Cobrado Hoy</div>
            <div className="text-xl font-extrabold font-mono text-emerald-400">
              ${metricas.totalCobrado.toLocaleString('es-AR')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Locales Visitados</div>
            <div className="text-sm font-bold text-white font-mono">
              {metricas.visitados} de {metricas.totalLocales} ({Math.round(metricas.porcentajeProgreso)}%)
            </div>
          </div>
        </div>

        {/* Barra de Progreso de la Hoja */}
        <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${metricas.porcentajeProgreso}%` }}
          />
        </div>
      </header>

      {/* ===================================================================== */}
      {/* BARRA DE BÚSQUEDA RÁPIDA Y FILTROS */}
      {/* ===================================================================== */}
      <div className="p-3.5 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, calle o N° OP..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSoloPendientes(false)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              !soloPendientes ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Todos ({paradas.length})
          </button>
          <button
            onClick={() => setSoloPendientes(true)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
              soloPendientes ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Solo Pendientes ({paradas.filter((p) => p.estado_visita === 'PENDIENTE').length})
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* LISTADO DE TARJETAS EN RUTA (OPTIMIZADO PARA MANEJO CON UNA MANO) */}
      {/* ===================================================================== */}
      <main className="p-3.5 space-y-3 flex-1">
        {paradasFiltradas.map((item) => {
          const isCobrado = item.estado_visita === 'COBRADO';
          const isNoPago = item.estado_visita === 'NO_PAGO';

          return (
            <div
              key={item.nro_op}
              className={`rounded-2xl border transition-all relative overflow-hidden ${
                isCobrado
                  ? 'bg-emerald-950/20 border-emerald-800/40 opacity-80'
                  : isNoPago
                  ? 'bg-slate-900/60 border-slate-800 opacity-75'
                  : 'bg-slate-900 border-slate-800 shadow-md'
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Cabecera Tarjeta: Orden + Nombre + Badge Tipo */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-slate-800 text-sky-400 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0">
                      #{item.orden_recorrido}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-base text-white leading-snug">
                        {item.cliente}
                      </h3>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate max-w-[220px]">{item.domicilio}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badge Tipo: EFECTIVO (Verde) o PRODUCTO (Azul) */}
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      item.tipo === 'EFECTIVO'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40'
                        : 'bg-sky-950 text-sky-400 border border-sky-600/40'
                    }`}
                  >
                    {item.tipo}
                  </span>
                </div>

                {/* Importe y Alerta de Atraso */}
                <div className="flex items-end justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Cuota del Día
                    </span>
                    <div className="text-2xl font-mono font-black text-white">
                      ${item.cuota_diaria.toLocaleString('es-AR')}
                    </div>
                  </div>

                  {/* Alerta de Atraso si corresponde */}
                  {item.cuotas_vencidas > 0 ? (
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-rose-400 flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Atraso: {item.cuotas_vencidas} cuota(s)
                      </span>
                      <div className="text-xs font-mono font-bold text-rose-300">
                        Debe ${item.deuda_vencida.toLocaleString('es-AR')}
                      </div>
                    </div>
                  ) : (
                    <div className="text-right">
                      <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Al Día
                      </span>
                      <div className="text-xs text-slate-400 font-mono">
                        Saldo: ${item.saldo_restante.toLocaleString('es-AR')}
                      </div>
                    </div>
                  )}
                </div>

                {/* ESTADO SI YA FUE VISITADO */}
                {isCobrado && (
                  <div className="py-2.5 px-3 bg-emerald-950/40 border border-emerald-600/40 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Cobrado: ${item.monto_cobrado_hoy?.toLocaleString('es-AR')}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {item.hora_visita} hs
                    </span>
                  </div>
                )}

                {isNoPago && (
                  <div className="py-2.5 px-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-amber-500" />
                      No pagó: {item.motivo_no_pago}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {item.hora_visita} hs
                    </span>
                  </div>
                )}

                {/* BOTONES DE ACCIÓN RÁPIDA (SOLO SI PENDIENTE) */}
                {!isCobrado && !isNoPago && (
                  <div className="space-y-2 pt-1">
                    {/* Botón Gigante de 1 Toque: Cobro Completo */}
                    <button
                      onClick={() => handleCobroCompleto(item)}
                      className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-extrabold text-base rounded-xl transition shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-5 h-5" />
                      <span>Cobro Completo: ${item.cuota_diaria.toLocaleString('es-AR')}</span>
                    </button>

                    {/* Fila con Otro Monto y No Pagó */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setModalKeypadOp(item)}
                        className="h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition"
                      >
                        Otro Monto...
                      </button>

                      <button
                        onClick={() => setModalNoPagoOp(item)}
                        className="h-11 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 font-bold text-xs rounded-xl border border-rose-800/40 transition"
                      >
                        No Pagó
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Modales */}
      {modalKeypadOp && (
        <KeypadModal
          isOpen={!!modalKeypadOp}
          onClose={() => setModalKeypadOp(null)}
          onConfirm={handleConfirmarOtroMonto}
          clienteNombre={modalKeypadOp.cliente}
          cuotaDiaria={modalKeypadOp.cuota_diaria}
        />
      )}

      {modalNoPagoOp && (
        <NoPagoModal
          isOpen={!!modalNoPagoOp}
          onClose={() => setModalNoPagoOp(null)}
          onConfirm={handleConfirmarNoPago}
          clienteNombre={modalNoPagoOp.cliente}
        />
      )}
    </div>
  );
};
