import React, { useState, useMemo } from 'react';
import { cerrarCajaEnSupabase } from '../lib/supabase';

interface CobradorItem {
  id: number;
  nombre: string;
  inicial: string;
  porcentaje_comision: number;
  zona: string;
  cobrado: number;
  supervisor?: string;
  contrato: string;
  tarifa: string;
}

interface CobroAuditado {
  hora: string;
  nro_op: string;
  cliente: string;
  dni: string;
  barrio: string;
  linea: string;
  esProducto: boolean;
  cuotasEq: string;
  detalleCuota: string;
  monto: number;
  estado: 'Rendido' | 'Pendiente';
}

export const CierreCajaArqueo: React.FC = () => {
  const cobradores: CobradorItem[] = [
    { id: 1, nombre: 'Ariel', inicial: 'A', porcentaje_comision: 10.0, zona: 'Zona Centro', cobrado: 158400, contrato: 'Contrato #C-04', tarifa: 'Cobrador Senior' },
    { id: 2, nombre: 'Álvaro', inicial: 'Á', porcentaje_comision: 10.0, zona: 'Zona Sur', cobrado: 112200, contrato: 'Contrato #C-02', tarifa: 'Cobrador Senior' },
    { id: 3, nombre: 'Antonela', inicial: 'An', porcentaje_comision: 10.0, zona: 'Zona La Banda', cobrado: 94800, contrato: 'Contrato #C-03', tarifa: 'Cobrador Senior' },
    { id: 4, nombre: 'Oriana', inicial: 'O', porcentaje_comision: 10.0, zona: 'Zona Norte', cobrado: 86500, contrato: 'Contrato #C-05', tarifa: 'Cobrador Senior' },
    { id: 5, nombre: 'Emanuel', inicial: 'E', porcentaje_comision: 8.0, zona: 'Sub-circuito', cobrado: 42300, supervisor: 'Walter', contrato: 'Contrato #C-08', tarifa: 'Sub-cobrador' },
    { id: 6, nombre: 'Walter', inicial: 'W', porcentaje_comision: 8.0, zona: 'Supervisor General', cobrado: 0, contrato: 'Contrato #S-01', tarifa: 'Supervisor General' },
  ];

  const [selectedCobradorId, setSelectedCobradorId] = useState<number>(1);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('2026-09-04');
  const [dineroFisicoContado, setDineroFisicoContado] = useState<string>('140060');
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>(
    'Rendición completa sin incidentes en recorrido callejero. Todos los cupones físicos concordantes con el registro móvil.'
  );
  const [cierreConfirmado, setCierreConfirmado] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  const cobradorActual = useMemo(() => {
    return cobradores.find((c) => c.id === selectedCobradorId) || cobradores[0];
  }, [selectedCobradorId]);

  const [cobros, setCobros] = useState<CobroAuditado[]>([
    {
      hora: '09:14',
      nro_op: '#CR-84920',
      cliente: 'Guillermo Herrera',
      dni: 'DNI 28.491.203',
      barrio: 'B° Centenario',
      linea: 'Efectivo 26d',
      esProducto: false,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 14/26',
      monto: 5500,
      estado: 'Rendido',
    },
    {
      hora: '09:42',
      nro_op: '#PR-10294',
      cliente: 'Mirta Rosa Santillán',
      dni: 'DNI 19.822.401',
      barrio: 'B° Jorge Newbery',
      linea: 'Prod: Heladera Gafa 84d',
      esProducto: true,
      cuotasEq: '2.0 cuotas',
      detalleCuota: 'Adelanto 31-32',
      monto: 12000,
      estado: 'Rendido',
    },
    {
      hora: '10:15',
      nro_op: '#CR-85112',
      cliente: 'Walter Esteban Lugones',
      dni: 'DNI 32.190.540',
      barrio: 'Av. Belgrano Sur',
      linea: 'Efectivo 35d',
      esProducto: false,
      cuotasEq: '0.5 cuota',
      detalleCuota: 'Pago parcial',
      monto: 4000,
      estado: 'Rendido',
    },
    {
      hora: '10:55',
      nro_op: '#PR-09844',
      cliente: 'Silvia Noemí Carabajal',
      dni: 'DNI 24.512.981',
      barrio: 'B° Huaico Hondo',
      linea: 'Prod: Sommier 2 Plazas',
      esProducto: true,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 19/60',
      monto: 8500,
      estado: 'Rendido',
    },
    {
      hora: '11:30',
      nro_op: '#CR-85291',
      cliente: 'Roberto Darío Paz',
      dni: 'DNI 35.801.442',
      barrio: 'B° Cabildo',
      linea: 'Efectivo 26d',
      esProducto: false,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 26/26 CANCELA',
      monto: 6000,
      estado: 'Rendido',
    },
    {
      hora: '12:05',
      nro_op: '#CR-85330',
      cliente: 'Florencia Juárez',
      dni: 'DNI 40.231.009',
      barrio: 'B° San Martín',
      linea: 'Efectivo 35d',
      esProducto: false,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 08/35',
      monto: 7200,
      estado: 'Rendido',
    },
    {
      hora: '12:44',
      nro_op: '#PR-10331',
      cliente: 'Gonzalo Almaraz',
      dni: 'DNI 26.904.312',
      barrio: 'B° Primera Junta',
      linea: 'Prod: Smart TV 43" Noblex',
      esProducto: true,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 44/84',
      monto: 9500,
      estado: 'Rendido',
    },
    {
      hora: '13:10',
      nro_op: '#CR-85402',
      cliente: 'Marta Beatriz Orellana',
      dni: 'DNI 22.771.889',
      barrio: 'B° Autonomía',
      linea: 'Efectivo 26d',
      esProducto: false,
      cuotasEq: '1.0 cuota',
      detalleCuota: 'Cuota 03/26',
      monto: 4700,
      estado: 'Rendido',
    },
  ]);

  // Cálculos consolidados del lote
  const resumen = useMemo(() => {
    // Valores reales según especificación Stitch
    const totalGeneral = cobradorActual.cobrado || 158400;
    const totalEfectivo = Math.round(totalGeneral * 0.621);
    const totalProductos = totalGeneral - totalEfectivo;
    const comisionCobrador = totalGeneral * (cobradorActual.porcentaje_comision / 100);
    const viaticos = 2500;
    const adelantos = 0;
    const netoARendir = totalGeneral - comisionCobrador - viaticos - adelantos;

    const fisicoNum = parseFloat(dineroFisicoContado) || 0;
    const diferencia = fisicoNum - netoARendir;

    return {
      totalEfectivo,
      totalProductos,
      totalGeneral,
      comisionCobrador,
      viaticos,
      adelantos,
      netoARendir,
      fisicoNum,
      diferencia,
    };
  }, [cobradorActual, dineroFisicoContado]);

  const cobrosFiltrados = useMemo(() => {
    if (!filtroTexto.trim()) return cobros;
    const q = filtroTexto.toLowerCase();
    return cobros.filter(
      (c) =>
        c.cliente.toLowerCase().includes(q) ||
        c.dni.toLowerCase().includes(q) ||
        c.nro_op.toLowerCase().includes(q) ||
        c.barrio.toLowerCase().includes(q)
    );
  }, [cobros, filtroTexto]);

  const handleConfirmarCierre = async () => {
    if (resumen.fisicoNum <= 0) {
      alert('Por favor ingrese el dinero físico antes de cerrar.');
      return;
    }

    const conf = window.confirm(
      `¿Confirmar el cierre definitivo de caja para ${cobradorActual.nombre}?\n\n` +
      `Recaudación Bruta: $${resumen.totalGeneral.toLocaleString('es-AR')}\n` +
      `Comisión: -$${resumen.comisionCobrador.toLocaleString('es-AR')}\n` +
      `Viáticos Combustible: -$${resumen.viaticos.toLocaleString('es-AR')}\n` +
      `Neto Teórico a Rendir: $${resumen.netoARendir.toLocaleString('es-AR')}\n` +
      `Físico en Mano: $${resumen.fisicoNum.toLocaleString('es-AR')}\n` +
      (resumen.diferencia !== 0
        ? `Diferencia de Arqueo: $${resumen.diferencia.toLocaleString('es-AR')} (${resumen.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'})`
        : 'Estado: ARQUEO EXACTO CONCILIADO')
    );

    if (!conf) return;

    setCargando(true);
    try {
      await cerrarCajaEnSupabase({
        id_cobrador: cobradorActual.id,
        fecha: fechaSeleccionada,
      });
      setCierreConfirmado(true);
      setNotificacion('¡Caja cerrada y conciliada con éxito! Acta digital firmada.');
      setTimeout(() => setNotificacion(null), 5000);
    } catch (error: any) {
      setNotificacion(`No se pudo cerrar la caja en Supabase: ${error.message || 'error desconocido'}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-8 pb-28">
      {/* Toast de Notificación */}
      {notificacion && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">verified</span>
            <span className="font-bold text-sm">{notificacion}</span>
          </div>
          <button
            onClick={() => setNotificacion(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-3 py-1 bg-emerald-100/60 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. BARRA SUPERIOR DE CONTEXTO OPERATIVO Y SELECTOR DE COBRADOR */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
        {/* Fila 1: Selector de Fecha, Estado y Acciones Rápidas */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-sm font-semibold">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">calendar_today</span>
              <span>{fechaSeleccionada === '2026-09-04' ? 'Viernes, 04 de Septiembre 2026 - Turno Tarde' : fechaSeleccionada}</span>
            </div>

            <button
              onClick={() => setFechaSeleccionada('2026-09-04')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                fechaSeleccionada === '2026-09-04'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFechaSeleccionada('2026-09-03')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                fechaSeleccionada === '2026-09-03'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Jornada anterior (03 Sep)
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
              cierreConfirmado
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${cierreConfirmado ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              <span className="uppercase tracking-wide">
                {cierreConfirmado ? 'Caja Rendida y Bóveda Cerrada' : 'Pendiente de Arqueo Físico'}
              </span>
            </div>
            <div className="text-xs text-slate-400 hidden md:block">
              Cierre N° <strong className="font-mono text-slate-700">ARQ-2026-0904-Z01</strong>
            </div>
          </div>
        </div>

        {/* Fila 2: Carrusel de Chips de Cobradores con Montos */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Seleccionar Cobrador para Arqueo Individual:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cobradores.map((cob) => {
              const isSelected = cob.id === selectedCobradorId;
              return (
                <button
                  key={cob.id}
                  onClick={() => {
                    setSelectedCobradorId(cob.id);
                    setCierreConfirmado(false);
                  }}
                  className={`p-4 rounded-xl text-left transition-all border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {cob.inicial}
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                        check_circle
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-bold text-sm text-slate-900 leading-tight">
                      {cob.nombre}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {cob.zona}
                    </div>
                    {cob.supervisor && (
                      <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        Sup: {cob.supervisor}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60">
                    <div className="text-xs font-bold font-mono text-emerald-700">
                      ${cob.cobrado.toLocaleString('es-AR')} cobrado
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. LAS 3 TARJETAS DE RESUMEN FINANCIERO (KPIS COMPLETOS) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tarjeta 1: Préstamos Efectivo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Línea Préstamos Diarios
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">Recaudado en Efectivo</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">payments</span>
            </div>
          </div>

          <div>
            <div className="text-3xl font-black font-mono text-slate-900 tracking-tight">
              ARS ${resumen.totalEfectivo.toLocaleString('es-AR')}
              <span className="text-sm font-normal text-slate-400">,00</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>18 cobros (planes 26 y 35 días)</span>
              <span className="font-bold text-emerald-600">62.1% del total</span>
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Productos Electro/Muebles */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Línea Bienes &amp; Electro
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1">Recaudado en Productos</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">kitchen</span>
            </div>
          </div>

          <div>
            <div className="text-3xl font-black font-mono text-slate-900 tracking-tight">
              ARS ${resumen.totalProductos.toLocaleString('es-AR')}
              <span className="text-sm font-normal text-slate-400">,00</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>12 cobros (muebles y electro)</span>
              <span className="font-bold text-emerald-600">37.9% del total</span>
            </div>
          </div>
        </div>

        {/* Tarjeta 3: Total General Bruto Consolidado */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-2xl p-6 shadow-md shadow-emerald-600/10 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Recaudación Bruta Consolidada
              </span>
              <h3 className="text-base font-bold text-white mt-1">Total General Cobrado</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </div>
          </div>

          <div>
            <div className="text-3xl font-black font-mono tracking-tight text-white">
              ARS ${resumen.totalGeneral.toLocaleString('es-AR')}
              <span className="text-sm font-normal text-emerald-200">,00</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-emerald-100 pt-2 border-t border-emerald-500/40">
              <span>30 transacciones completas</span>
              <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                100% cobrado
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3 & 4. DOS COLUMNAS: PANEL DE LIQUIDACIÓN Y MÓDULO DE ARQUEO FÍSICO */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna Izquierda (5 cols): Panel de Liquidación de Comisión */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">receipt_long</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Liquidación de Rendición</h3>
                  <p className="text-xs text-slate-500">Cálculo de retenciones de {cobradorActual.nombre}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                {cobradorActual.tarifa}
              </span>
            </div>

            {/* Desglose Financiero Monospace */}
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-sans">Recaudación Bruta Total:</span>
                <span className="font-bold text-slate-900">
                  ARS ${resumen.totalGeneral.toLocaleString('es-AR')},00
                </span>
              </div>

              <div className="flex items-center justify-between py-2.5 px-3.5 bg-rose-50/60 rounded-xl text-rose-700 border border-rose-100">
                <div className="flex items-center gap-2 font-sans">
                  <span>(-) Comisión Cobrador ({cobradorActual.porcentaje_comision}%):</span>
                  <span className="bg-white text-slate-600 text-[10px] px-2 py-0.5 rounded border border-rose-200">
                    {cobradorActual.contrato}
                  </span>
                </div>
                <span className="font-bold">-${resumen.comisionCobrador.toLocaleString('es-AR')},00</span>
              </div>

              <div className="flex items-center justify-between py-2.5 px-3.5 bg-rose-50/60 rounded-xl text-rose-700 border border-rose-100">
                <div className="flex items-center gap-1.5 font-sans">
                  <span className="material-symbols-outlined text-[16px]">local_gas_station</span>
                  <span>(-) Retención Combustible / Viático:</span>
                </div>
                <span className="font-bold">-${resumen.viaticos.toLocaleString('es-AR')},00</span>
              </div>

              <div className="flex items-center justify-between py-2 px-3.5 text-slate-500 font-sans">
                <span>Adelantos solicitados en turno:</span>
                <span className="font-mono font-bold">$0,00</span>
              </div>
            </div>
          </div>

          {/* Total Neto Teórico enmarcado */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-bold uppercase tracking-wider">
              <span>Neto Teórico a Rendir en Mano</span>
              <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified_user</span>
            </div>

            <div className="text-3xl lg:text-4xl font-black font-mono text-emerald-700 tracking-tight">
              ARS ${resumen.netoARendir.toLocaleString('es-AR')},00
            </div>

            <p className="text-xs text-emerald-700/80">
              Monto obligatorio que debe ingresar al cofre físico de caja.
            </p>
          </div>
        </div>

        {/* Columna Derecha (7 cols): Módulo de Arqueo Físico en Tiempo Real */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">currency_exchange</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Conteo Físico &amp; Conciliación en Mano</h3>
                  <p className="text-xs text-slate-500">Ingreso de dinero en tesorería y validación de billetes</p>
                </div>
              </div>

              {/* Botones Presets Rápidos */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setDineroFisicoContado(String(resumen.netoARendir))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  Match Exacto
                </button>
                <button
                  onClick={() => setDineroFisicoContado(String(resumen.netoARendir - 2000))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                >
                  -$2.000
                </button>
                <button
                  onClick={() => setDineroFisicoContado(String(resumen.netoARendir + 1500))}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  +$1.500
                </button>
              </div>
            </div>

            {/* Input de Conteo Físico Prominente */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Ingresar Dinero Físico Contado ($ ARS):
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xl text-slate-400">
                  ARS $
                </span>
                <input
                  type="number"
                  value={dineroFisicoContado}
                  onChange={(e) => setDineroFisicoContado(e.target.value)}
                  disabled={cierreConfirmado}
                  className="w-full bg-white border border-slate-300 focus:border-emerald-500 rounded-xl pl-20 pr-4 py-3.5 text-3xl font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                />
              </div>
            </div>

            {/* Indicador Dinámico de Estado (Exacto / Faltante / Sobrante) */}
            <div
              className={`p-5 rounded-2xl border flex items-center justify-between transition-all ${
                resumen.diferencia === 0
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : resumen.diferencia > 0
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${
                    resumen.diferencia === 0
                      ? 'bg-emerald-600 text-white'
                      : resumen.diferencia > 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[28px]">
                    {resumen.diferencia === 0 ? 'check_circle' : resumen.diferencia > 0 ? 'trending_up' : 'error'}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-wider">
                    {resumen.diferencia === 0
                      ? 'ARQUEO EXACTO: CONCILIADO'
                      : resumen.diferencia > 0
                      ? 'SOBRANTE DE CAJA EN ARQUEO'
                      : 'FALTANTE DE CAJA EN ARQUEO'}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {resumen.diferencia === 0
                      ? 'Coincidencia perfecta al centavo con el Neto Teórico. Sin desvíos.'
                      : resumen.diferencia > 0
                      ? 'El dinero físico ingresado supera el neto exigible según el lote.'
                      : 'El dinero físico en mano es menor al monto teórico liquidado.'}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Diferencia</span>
                <span className="text-xl font-mono font-black">
                  {resumen.diferencia === 0
                    ? '$0,00'
                    : `${resumen.diferencia > 0 ? '+' : ''}$${resumen.diferencia.toLocaleString('es-AR')},00`}
                </span>
              </div>
            </div>

            {/* Desglose Rápido de Billetaje Sugerido (Auditado por Tesorería) */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Desglose de Billetaje Sugerido (Auditado por Tesorería):
                </span>
                <span className="font-mono text-emerald-600 font-bold">Validación Automática</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex justify-between">
                  <span className="text-slate-500">10x $10.000</span>
                  <span className="font-bold text-slate-800">$100.000</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex justify-between">
                  <span className="text-slate-500">18x $2.000</span>
                  <span className="font-bold text-slate-800">$36.000</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex justify-between">
                  <span className="text-slate-500">4x $1.000</span>
                  <span className="font-bold text-slate-800">$4.000</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 flex justify-between">
                  <span className="text-slate-500">1x $50 / $10</span>
                  <span className="font-bold text-slate-800">$60</span>
                </div>
              </div>
            </div>

            {/* Observaciones del Arqueo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Observaciones de Rendición &amp; Incidentes de Calle:
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl p-3 text-xs text-slate-800 focus:outline-none transition resize-none"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. PLANILLA TRANSACCIONAL DE COBROS DEL DÍA (TABLA AUDITADA) */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden space-y-4 p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">table_rows</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Detalle de Cobros Registrados en Calle
              </h3>
              <p className="text-xs text-slate-500">
                Auditoría transaccional de 8 operaciones inmediatas del lote activo
              </p>
            </div>
          </div>

          {/* Barra de Filtro Rápido */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                placeholder="Filtrar cliente, DNI o N° OP..."
                className="bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-9 pr-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition w-64"
              />
            </div>
            <button
              onClick={() => setFiltroTexto('')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">filter_list</span>
              <span>Todos</span>
            </button>
          </div>
        </div>

        {/* Tabla Espaciosa con Altura Confortable */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Hora</th>
                <th className="py-3 px-4">N° OP / Crédito</th>
                <th className="py-3 px-4">Cliente / DNI</th>
                <th className="py-3 px-4">Línea &amp; Plazo</th>
                <th className="py-3 px-4">Cuotas Equivalentes</th>
                <th className="py-3 px-4 text-right">Monto Cobrado</th>
                <th className="py-3 px-4 text-center">Estado Auditoría</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {cobrosFiltrados.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 font-mono text-slate-500">{c.hora}</td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{c.nro_op}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">{c.cliente}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {c.dni} • {c.barrio}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        c.esProducto
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}
                    >
                      {c.linea}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900">{c.cuotasEq}</span>{' '}
                    <span className="text-slate-500 text-[11px]">({c.detalleCuota})</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ${c.monto.toLocaleString('es-AR')},00
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Rendido
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-slate-400">
                      <button
                        onClick={() => alert(`Comprobante digital para ${c.nro_op} verificado.`)}
                        className="p-1 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                        title="Ver Comprobante Digital"
                      >
                        <span className="material-symbols-outlined text-[18px]">receipt</span>
                      </button>
                      <button
                        onClick={() => alert(`Historial crediticio de ${c.cliente} cargado.`)}
                        className="p-1 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                        title="Historial del Crédito"
                      >
                        <span className="material-symbols-outlined text-[18px]">history</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginador / Resumen de lote */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {cobrosFiltrados.length} de 30 cobros auditados</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition font-medium">
              Anterior
            </button>
            <span className="font-bold text-slate-800">Página 1 de 4</span>
            <button className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition font-medium">
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. BARRA DE ACCIÓN PRINCIPAL Y CIERRE DE CAJA (STICKY BOTTOM) */}
      {/* ===================================================================== */}
      <section className="fixed bottom-0 left-72 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-8 py-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Resumen rápido de firmas biométricas y estado */}
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Firma Cobrador:</span>
              <span className="text-xs font-bold text-slate-800">{cobradorActual.nombre} (Biométrica OK)</span>
            </div>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">fingerprint</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Firma Admin / Dueño:</span>
              <span className="text-xs font-bold text-slate-800">C. Mendilaharzu (Autenticado)</span>
            </div>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">draw</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Efectivo Ingresante a Bóveda
            </span>
            <span className="text-xl font-black font-mono text-emerald-700">
              ARS ${resumen.fisicoNum.toLocaleString('es-AR')},00
            </span>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setNotificacion('Borrador de arqueo guardado localmente en sesión.');
              setTimeout(() => setNotificacion(null), 4000);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            <span>Guardar Borrador</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNotificacion('Generando Acta de Cierre en PDF (A4) con hash criptográfico...');
              setTimeout(() => setNotificacion(null), 4000);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Generar Acta PDF (A4)</span>
          </button>

          <button
            type="button"
            disabled={cargando || cierreConfirmado}
            onClick={handleConfirmarCierre}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 ${
              cierreConfirmado
                ? 'bg-emerald-100 text-emerald-800 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">lock</span>
            <span>
              {cargando
                ? 'Procesando Cierre...'
                : cierreConfirmado
                ? 'Caja Cerrada Definitivamente'
                : 'Confirmar y Cerrar Caja Definitivamente'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
