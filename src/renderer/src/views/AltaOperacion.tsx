import React, { useState, useMemo } from 'react';
import { generarCronograma, calcularFechaFin, calcularDiasCorridos, toISODate } from '@core/calendar-engine';
import { crearOperacionEnSupabase } from '../lib/supabase';

export const AltaOperacion: React.FC = () => {
  const [modoComercial, setModoComercial] = useState<'cash' | 'goods'>('cash');
  const [clienteNombre, setClienteNombre] = useState<string>('Marcelo Alejandro Coronel');
  const [clienteDni, setClienteDni] = useState<string>('28.491.203');
  const [clienteCuit, setClienteCuit] = useState<string>('20-28491203-4');
  const [clienteDomicilio, setClienteDomicilio] = useState<string>('Calle 4 N° 824 - B° Siglo XXI');
  const [clienteReferencia, setClienteReferencia] = useState<string>('portón negro reja baja');
  const [clienteTelefono, setClienteTelefono] = useState<string>('+54 385 512-3490');
  const [cobradorSeleccionado, setCobradorSeleccionado] = useState<string>('Zona Sur - Álvaro');

  // Parámetros Efectivo
  const [capitalEfectivo, setCapitalEfectivo] = useState<number>(100000);
  const [planEfectivoDias, setPlanEfectivoDias] = useState<number>(26);

  // Parámetros Producto
  const [productoSeleccionado, setProductoSeleccionado] = useState<{
    nombre: string;
    stock: number;
    precioContado: number;
    cuotas: number;
    cuotaValor: number;
    total: number;
  }>({
    nombre: "Smart TV 43'' FHD",
    stock: 4,
    precioContado: 380000,
    cuotas: 84,
    cuotaValor: 8200,
    total: 688800,
  });

  const [fechaInicio, setFechaInicio] = useState<string>('2026-09-07');
  const [modalConfirmacion, setModalConfirmacion] = useState<boolean>(false);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const catalogoProductos = [
    {
      nombre: "Smart TV 43'' FHD",
      icono: 'tv',
      stock: 4,
      precioContado: 380000,
      cuotas: 84,
      cuotaValor: 8200,
      total: 688800,
    },
    {
      nombre: 'Heladera No Frost 310L',
      icono: 'kitchen',
      stock: 2,
      precioContado: 640000,
      cuotas: 135,
      cuotaValor: 9500,
      total: 1282500,
    },
    {
      nombre: 'Motovehículo 110cc Base',
      icono: 'two_wheeler',
      stock: 1,
      precioContado: 1450000,
      cuotas: 220,
      cuotaValor: 14800,
      total: 3256000,
    },
    {
      nombre: 'Freezer Gafa 280L',
      icono: 'ac_unit',
      stock: 6,
      precioContado: 420000,
      cuotas: 84,
      cuotaValor: 3800,
      total: 319200,
    },
  ];

  // Cálculos dinámicos con el Motor de Calendario
  const calculos = useMemo(() => {
    let cuotaDiaria = 0;
    let montoTotal = 0;
    let dias = 0;
    let interes = 0;

    if (modoComercial === 'cash') {
      dias = planEfectivoDias;
      const tasa = dias === 26 ? 30 : 40;
      interes = capitalEfectivo * (tasa / 100);
      montoTotal = capitalEfectivo + interes;
      cuotaDiaria = Math.round(montoTotal / dias);
    } else {
      dias = productoSeleccionado.cuotas;
      cuotaDiaria = productoSeleccionado.cuotaValor;
      montoTotal = productoSeleccionado.total;
      interes = montoTotal - productoSeleccionado.precioContado;
    }

    const fechaIniDate = new Date(`${fechaInicio}T12:00:00`);
    const cronogramaRaw = generarCronograma({
      fechaInicio: fechaIniDate,
      numeroCuotas: dias,
      importeCuota: cuotaDiaria,
    });

    let saldoAcumulado = montoTotal;
    const cronogramaConSaldo = cronogramaRaw.map((c) => {
      saldoAcumulado -= c.monto_esperado;
      return {
        ...c,
        saldoRestante: Math.max(saldoAcumulado, 0),
      };
    });

    const fechaFin = calcularFechaFin(fechaIniDate, dias);
    const diasCorridos = calcularDiasCorridos(fechaIniDate, dias);

    return {
      cuotaDiaria,
      montoTotal,
      interes,
      dias,
      cronograma: cronogramaConSaldo,
      fechaFin: toISODate(fechaFin),
      diasCorridos,
    };
  }, [modoComercial, capitalEfectivo, planEfectivoDias, productoSeleccionado, fechaInicio]);

  const handleConfirmar = async () => {
    try {
      const cobradorNombre = cobradorSeleccionado.split(' - ').at(-1)?.trim() || cobradorSeleccionado;
      const nroOperacion = await crearOperacionEnSupabase({
        cliente: {
          nombre: clienteNombre,
          dni: clienteDni,
          domicilio: clienteDomicilio,
          telefono: clienteTelefono,
          referencia: clienteReferencia,
        },
        tipo: modoComercial === 'cash' ? 'EFECTIVO' : 'PRODUCTO',
        fecha: fechaInicio,
        cobradorNombre,
        planDias: calculos.dias,
        montoCapital: modoComercial === 'cash' ? capitalEfectivo : productoSeleccionado.precioContado,
        montoTotal: calculos.montoTotal,
        importeCuota: calculos.cuotaDiaria,
        productoNombre: modoComercial === 'goods' ? productoSeleccionado.nombre : undefined,
      });
      setModalConfirmacion(false);
      setToastMensaje(`Operación #${nroOperacion} aprobada y asignada a ${cobradorSeleccionado}.`);
      setTimeout(() => setToastMensaje(null), 5000);
      return;
    } catch (error: any) {
      setToastMensaje(`No se pudo crear la operación en Supabase: ${error.message || 'error desconocido'}`);
      setTimeout(() => setToastMensaje(null), 7000);
      return;
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Toast Notificación */}
      {toastMensaje && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">verified</span>
            <span className="font-bold text-sm">{toastMensaje}</span>
          </div>
          <button
            onClick={() => setToastMensaje(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-3 py-1 bg-emerald-100/60 rounded-lg transition"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. TOP COMMAND CONTEXT BAR */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[26px]">contract_edit</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono uppercase font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                Módulo Originación v4.2
              </span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Validación en tiempo real (Lunes a Sábado)
              </span>
            </div>
            <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight mt-1">
              Alta de Nueva Operación Crediticia y Simulación de Cronograma
            </h2>
          </div>
        </div>

        {/* Switcher Operador & Sucursal */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200/80">
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">storefront</span>
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Sucursal</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">01 - Central SDE</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white rounded-xl shadow-sm border border-slate-200/60">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">badge</span>
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Operador</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">C. Mendilaharzu [ADM]</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. GRID PRINCIPAL (COLUMNA IZQUIERDA: CONFIGURADOR / COLUMNA DERECHA: SIMULACIÓN) */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* COLUMNA IZQUIERDA: SETUP PIPELINE (7 cols) */}
        <div className="xl:col-span-7 space-y-8">
          {/* Card 1: Ficha del Titular / Deudor */}
          <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">person_pin</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">1. Ficha del Titular / Deudor</h3>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg bg-white shadow-sm text-xs font-bold text-slate-800"
                >
                  Búsqueda Rápida
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Formulario Express (+)
                </button>
              </div>
            </div>

            {/* Input Buscador con Badge Verificado */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={`${clienteNombre} - DNI ${clienteDni}`}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-11 pr-32 py-3 rounded-xl text-sm font-medium text-slate-900 focus:outline-none transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                VERIFICADO
              </span>
            </div>

            {/* Ficha Verificada del Cliente */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/70 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm font-mono">
                    MC
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 block">{clienteNombre}</span>
                    <span className="text-xs font-mono text-slate-500">
                      DNI: {clienteDni} • CUIT: {clienteCuit}
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Score A: 2 Créditos Cancelados en Término</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">pin_drop</span> Domicilio de Cobranza Diaria
                  </span>
                  <div className="font-bold text-slate-800 pt-0.5">{clienteDomicilio}</div>
                  <div className="text-slate-400 font-mono">Santiago del Estero (Ref: {clienteReferencia})</div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">call</span> Contacto &amp; Zona Asignada
                  </span>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="font-bold text-slate-800">{clienteTelefono}</span>
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold font-mono">
                      {cobradorSeleccionado}
                    </span>
                  </div>
                  <div className="text-emerald-600 font-medium flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">chat</span> WhatsApp validado activo
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Configuración de Línea Comercial */}
          <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">tune</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">2. Configuración de Línea Comercial</h3>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Paso 2 de 3</span>
            </div>

            {/* Segmented Switcher (Cash vs Goods) */}
            <div className="grid grid-cols-2 gap-4 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setModoComercial('cash')}
                className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition ${
                  modoComercial === 'cash'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-emerald-600">payments</span>
                <div className="text-left">
                  <div className="font-bold text-sm leading-tight">Préstamo en Efectivo</div>
                  <div className="text-[11px] text-slate-400">Microcréditos diarios directos</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setModoComercial('goods')}
                className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition ${
                  modoComercial === 'goods'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[22px] text-teal-600">shelves</span>
                <div className="text-left">
                  <div className="font-bold text-sm leading-tight">Venta Electrodoméstico</div>
                  <div className="text-[11px] text-slate-400">Planes extendidos con stock</div>
                </div>
              </button>
            </div>

            {/* PANEL EFECTIVO */}
            {modoComercial === 'cash' ? (
              <div className="space-y-6">
                {/* Input Capital Desembolsado con Presets */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                    <span>Capital Neto Desembolsado (Efectivo Entregado)</span>
                    <span className="text-emerald-600 font-mono">Límite asignado: ARS $250.000</span>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-4 font-mono font-bold text-xl text-slate-400">ARS $</span>
                    <input
                      type="number"
                      value={capitalEfectivo}
                      step="5000"
                      onChange={(e) => setCapitalEfectivo(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-20 pr-36 py-3.5 rounded-xl font-mono font-black text-2xl text-slate-900 focus:outline-none transition"
                    />
                    <div className="absolute right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(50000)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold font-mono text-slate-700 transition"
                      >
                        50k
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(100000)}
                        className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-xs font-bold font-mono text-emerald-800 transition"
                      >
                        100k
                      </button>
                      <button
                        type="button"
                        onClick={() => setCapitalEfectivo(150000)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold font-mono text-slate-700 transition"
                      >
                        150k
                      </button>
                    </div>
                  </div>
                </div>

                {/* Planes de Amortización Diaria */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Seleccionar Plan de Amortización Diaria:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Plan 26 Días */}
                    <div
                      onClick={() => setPlanEfectivoDias(26)}
                      className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                        planEfectivoDias === 26
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-mono font-bold text-xs rounded-md">
                          PLAN 26 DÍAS
                        </span>
                        <span className="text-xs font-bold text-emerald-700">Tasa Fija 30%</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Cuota diaria fija:</span>
                        <div className="text-2xl font-black font-mono text-slate-900">
                          ${Math.round((capitalEfectivo * 1.3) / 26).toLocaleString('es-AR')}{' '}
                          <span className="text-xs font-normal text-slate-400">/ día</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-mono text-slate-600">
                        <span>Interés: ${Math.round(capitalEfectivo * 0.3).toLocaleString('es-AR')}</span>
                        <span className="font-bold text-slate-900">Total: ${Math.round(capitalEfectivo * 1.3).toLocaleString('es-AR')}</span>
                      </div>
                    </div>

                    {/* Plan 35 Días */}
                    <div
                      onClick={() => setPlanEfectivoDias(35)}
                      className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                        planEfectivoDias === 35
                          ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 bg-slate-700 text-white font-mono font-bold text-xs rounded-md">
                          PLAN 35 DÍAS
                        </span>
                        <span className="text-xs font-bold text-slate-700">Tasa Fija 40%</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block">Cuota diaria fija:</span>
                        <div className="text-2xl font-black font-mono text-slate-900">
                          ${Math.round((capitalEfectivo * 1.4) / 35).toLocaleString('es-AR')}{' '}
                          <span className="text-xs font-normal text-slate-400">/ día</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs font-mono text-slate-600">
                        <span>Interés: ${Math.round(capitalEfectivo * 0.4).toLocaleString('es-AR')}</span>
                        <span className="font-bold text-slate-900">Total: ${Math.round(capitalEfectivo * 1.4).toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner de Retorno Esperado de Inversión (ROI) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">analytics</span>
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">Retorno Esperado de Inversión (ROI)</div>
                      <div className="text-[11px] text-slate-500">
                        Cobranza regular de {planEfectivoDias} jornadas operativas continuas sin desvío
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Margen Bruto</span>
                      <span className="font-mono font-bold text-emerald-600">
                        +{planEfectivoDias === 26 ? '30.0%' : '40.0%'} s/Capital
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Utilidad Estimada</span>
                      <span className="font-mono font-bold text-slate-900">
                        ARS ${calculos.interes.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PANEL PRODUCTOS */
              <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-600 text-[22px]">inventory_2</span>
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        Catálogo Oficial de Artículos en Depósito Central
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Artículos homologados para entrega y cobranza domiciliaria
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold font-mono">
                    12 Artículos en Stock
                  </span>
                </div>

                {/* Grid de Artículos del Catálogo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {catalogoProductos.map((p) => {
                    const isSelected = productoSeleccionado.nombre === p.nombre;
                    return (
                      <div
                        key={p.nombre}
                        onClick={() => setProductoSeleccionado(p)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'bg-teal-50/70 border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                            : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="material-symbols-outlined text-teal-600 text-[22px]">{p.icono}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-200 font-mono text-[11px] font-bold text-slate-700">
                            Stock: {p.stock}
                          </span>
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{p.nombre}</div>
                          <div className="text-xs text-slate-500">Contado: ${p.precioContado.toLocaleString('es-AR')}</div>
                        </div>
                        <div className="pt-2 border-t border-slate-200/70">
                          <div className="font-bold font-mono text-teal-700 text-sm">
                            {p.cuotas} cuotas de ${p.cuotaValor.toLocaleString('es-AR')}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Total: ${p.total.toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selector de Fecha de Desembolso / Primer Cobro */}
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Fecha de Desembolso / Primer Cobro
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Cobrador y Zona Asignada
                </label>
                <select
                  value={cobradorSeleccionado}
                  onChange={(e) => setCobradorSeleccionado(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-3 py-2 rounded-xl text-xs font-medium text-slate-800 focus:outline-none transition"
                >
                  <option value="Zona Sur - Álvaro">Zona Sur - Álvaro</option>
                  <option value="Zona Centro - Ariel">Zona Centro - Ariel</option>
                  <option value="Zona La Banda - Antonela">Zona La Banda - Antonela</option>
                  <option value="Zona Norte - Oriana">Zona Norte - Oriana</option>
                </select>
              </div>
            </div>
          </section>

          {/* Operational Action Bar */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">verified_user</span>
              <span>Trazabilidad criptográfica vinculada a nodo Supabase</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => alert(`Imprimiendo pagaré oficial para ${clienteNombre}...`)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Imprimir Pagaré</span>
              </button>

              <button
                type="button"
                onClick={() => alert(`Enviando comprobante vía WhatsApp a ${clienteTelefono}...`)}
                className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-600">send_to_mobile</span>
                <span>Enviar WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => setModalConfirmacion(true)}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Confirmar y Dar de Alta</span>
              </button>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA: SIMULACIÓN DE CRONOGRAMA EN TIEMPO REAL (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600 text-[24px]">calendar_month</span>
                <h3 className="text-base font-bold text-slate-900">Simulación de Cronograma</h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold font-mono">
                {calculos.dias} Cuotas Hábiles
              </span>
            </div>

            {/* Regla de Negocio Alert */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-[20px] shrink-0 mt-0.5">event_busy</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-900 font-bold">Regla estricta de cobro:</strong> Los domingos quedan excluidos de la cobranza. Feriados nacionales postergan automáticamente la exigibilidad al próximo día hábil.
              </p>
            </div>

            {/* Key Milestones Bar */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/70">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fecha Inicio</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{fechaInicio}</span>
                <span className="text-[11px] text-emerald-600 font-medium">Primer cobro en calle</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vencimiento Final</span>
                <span className="text-sm font-bold text-slate-900 block mt-0.5">{calculos.fechaFin}</span>
                <span className="text-[11px] text-slate-500 font-mono">{calculos.diasCorridos} días corridos</span>
              </div>
            </div>

            {/* Metric KPI Pill */}
            <div className="flex items-center justify-between p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">assignment_turned_in</span>
                <span className="text-xs font-bold uppercase tracking-wider">Total Exigible al Cobrador:</span>
              </div>
              <span className="text-xl font-mono font-black text-emerald-700">
                ${calculos.cuotaDiaria.toLocaleString('es-AR')} / día
              </span>
            </div>

            {/* Tabla Scrollable de Cuotas */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="max-h-[380px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase font-bold tracking-wider z-10 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">N°</th>
                      <th className="py-2.5 px-3">Vencimiento</th>
                      <th className="py-2.5 px-3 text-right">Cuota</th>
                      <th className="py-2.5 px-3 text-right">Saldo Rest.</th>
                      <th className="py-2.5 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {calculos.cronograma.map((c) => (
                      <tr key={c.numero_cuota} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono font-bold">{String(c.numero_cuota).padStart(2, '0')}/{calculos.dias}</td>
                        <td className="py-2 px-3 font-mono text-slate-600">{toISODate(c.fecha_vencimiento)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          ${c.monto_esperado.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          ${c.saldoRestante.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Programado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>{calculos.dias} Cuotas Generadas</span>
                <span className="font-bold font-mono text-slate-900">
                  Total Liquidación: ARS ${calculos.montoTotal.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Route Verification Snippet Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">route</span>
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900">Hoja de Ruta #04 - Zona Sur</div>
                  <div className="text-[11px] text-slate-400">Posición sugerida de visita: Parada 14 (17:40 hs)</div>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 font-mono">Cobrador Álvaro</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMACIÓN DE ALTA */}
      {/* ===================================================================== */}
      {modalConfirmacion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 lg:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">verified</span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">Confirmar Emisión de Crédito</h4>
                  <span className="text-xs font-mono text-slate-400">Transacción Inmutable #CR-2026-0904</span>
                </div>
              </div>
              <button
                onClick={() => setModalConfirmacion(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Titular deudor:</span>
                <span className="font-bold text-slate-900">{clienteNombre} ({clienteDni})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Línea comercial:</span>
                <span className="font-bold text-slate-900">
                  {modoComercial === 'cash' ? 'Préstamo en Efectivo' : `Producto: ${productoSeleccionado.nombre}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Desembolso capital:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ARS ${modoComercial === 'cash' ? capitalEfectivo.toLocaleString('es-AR') : productoSeleccionado.precioContado.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plan de amortización:</span>
                <span className="font-mono font-bold text-slate-900">
                  {calculos.dias} cuotas diarias de ${calculos.cuotaDiaria.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto total a recuperar:</span>
                <span className="font-mono font-bold text-slate-900">
                  ARS ${calculos.montoTotal.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Circuito asignado:</span>
                <span className="font-bold text-slate-900">{cobradorSeleccionado}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-amber-600">info</span>
              <span>Al confirmar se descontará automáticamente el efectivo de la Caja Central Turno Tarde.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalConfirmacion(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmar}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Efectivizar y Asignar a Ruta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
