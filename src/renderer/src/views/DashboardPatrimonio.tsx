import React, { useState } from 'react';

export const DashboardPatrimonio: React.FC = () => {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ejercicio'>('mes');

  const kpis = {
    cajaLiquida: 5420000,
    capitalEnCalle: 18350000,
    mercaderiaFinanciada: 16800000,
    stockEnDeposito: 8150500,
  };

  const patrimonioTotal =
    kpis.cajaLiquida +
    kpis.capitalEnCalle +
    kpis.mercaderiaFinanciada +
    kpis.stockEnDeposito;

  const totalCalle = kpis.capitalEnCalle + kpis.mercaderiaFinanciada;
  const pctCaja = ((kpis.cajaLiquida / patrimonioTotal) * 100).toFixed(1);
  const pctPrestamos = ((kpis.capitalEnCalle / patrimonioTotal) * 100).toFixed(1);
  const pctMercaderia = ((kpis.mercaderiaFinanciada / patrimonioTotal) * 100).toFixed(1);
  const pctStock = ((kpis.stockEnDeposito / patrimonioTotal) * 100).toFixed(1);

  const efectividadCobradores = [
    { orden: 1, nombre: 'Ariel', zona: 'Zona Centro • Hoja R-01', exigible: 165000, cobrado: 158400, pct: 96.0, estado: 'Óptimo', color: 'emerald' },
    { orden: 2, nombre: 'Antonela', zona: 'Zona La Banda • Hoja R-03', exigible: 150000, cobrado: 138500, pct: 92.3, estado: 'Eficiente', color: 'emerald' },
    { orden: 3, nombre: 'Álvaro', zona: 'Zona Sur • Hoja R-02', exigible: 155000, cobrado: 142000, pct: 91.6, estado: 'Eficiente', color: 'emerald' },
    { orden: 4, nombre: 'Oriana', zona: 'Zona Norte • Hoja R-04', exigible: 140000, cobrado: 121000, pct: 86.4, estado: 'Atención', color: 'amber' },
    { orden: 5, nombre: 'Emanuel', zona: 'Ruta Auxiliar • Hoja R-05', exigible: 92000, cobrado: 78000, pct: 84.7, estado: 'Atención', color: 'amber' },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* ===================================================================== */}
      {/* 1. TOP SOCIETARY BAR (ESPACIOSO Y AIREADO) */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Auditoría Patrimonial en Firme
            </span>
            <span className="text-xs font-mono font-medium text-slate-400">SGO-FIN-2026-Q3</span>
          </div>

          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            Panel de Control Patrimonial &amp; Valuación de Activos
          </h2>

          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Socios Directores • Sede Central Santiago del Estero • Valuación consolidada en tiempo real de cartera, stock y liquidez
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">sync</span>
            <span className="text-xs text-slate-500">
              Sincronización: <strong className="text-slate-800">En vivo (Supabase)</strong>
            </span>
          </div>

          {/* Selector de Período */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <button
              onClick={() => setPeriodo('mes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'mes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mes Actual
            </button>
            <button
              onClick={() => setPeriodo('trimestre')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'trimestre'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Trimestre Q3
            </button>
            <button
              onClick={() => setPeriodo('ejercicio')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                periodo === 'ejercicio'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Ejercicio 2026
            </button>
          </div>

          {/* Exportar Balance */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
            Exportar Informe Contable
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. HERO CARD: PATRIMONIO NETO OPERATIVO VALUADO + FÓRMULA */}
      {/* ===================================================================== */}
      <section className="bg-slate-900 text-white rounded-3xl p-8 lg:p-10 shadow-lg border border-slate-800 space-y-8 relative overflow-hidden">
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-end justify-between gap-8">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                ESTADO CONSOLIDADO EN FIRME
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-950/70 px-3 py-1 rounded-full border border-emerald-700/50">
                <span className="material-symbols-outlined text-[16px]">verified</span> Consolidación Automática
              </span>
            </div>

            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              PATRIMONIO NETO OPERATIVO VALUADO
            </div>

            <div className="flex flex-wrap items-baseline gap-4">
              <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                ${patrimonioTotal.toLocaleString('es-AR')},00{' '}
                <span className="text-xl font-normal text-slate-400">ARS</span>
              </span>
              <div className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold">
                <span className="material-symbols-outlined text-[16px]">trending_up</span> +14.2% vs mes anterior
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed pt-1">
              Valuación dinámica según normas locales de microcrédito comercial: liquidez disponible en bóveda, cartera viva no castigada y valuación de stock a costo de reposición auditado.
            </p>
          </div>

          {/* Ratios Rápidos de Solvencia */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 bg-slate-800/80 backdrop-blur rounded-2xl p-5 border border-slate-700/80">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Apalancamiento de Deuda
              </div>
              <div className="text-lg font-bold font-mono text-emerald-400">
                0.00% <span className="text-xs font-normal text-slate-300">(Sin Pasivo Bancario)</span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-slate-700"></div>

            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Índice Solvencia Corriente
              </div>
              <div className="text-lg font-bold font-mono text-white">
                100% Capital Propio
              </div>
            </div>
          </div>
        </div>

        {/* FÓRMULA MATEMÁTICA DESGLOSADA EN VIVO */}
        <div className="pt-6 border-t border-slate-800/90 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 gap-2">
            <span className="font-bold uppercase tracking-wider text-slate-300">
              Fórmula Desglosada en Vivo: Patrimonio Neto = Caja + Préstamos + Mercadería + Stock
            </span>
            <span>Asignación Global de Activos: 100% Auditado</span>
          </div>

          {/* Strip de las 4 partes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Caja Líquida</span>
                <span className="font-bold text-amber-400">{pctCaja}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${kpis.cajaLiquida.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Capital en Calle</span>
                <span className="font-bold text-emerald-400">{pctPrestamos}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${kpis.capitalEnCalle.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Mercadería Calle</span>
                <span className="font-bold text-teal-400">{pctMercaderia}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${kpis.mercaderiaFinanciada.toLocaleString('es-AR')}
              </div>
            </div>

            <div className="bg-slate-800/70 p-4 rounded-xl border border-slate-700/60">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Stock Depósito</span>
                <span className="font-bold text-blue-400">{pctStock}%</span>
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ${kpis.stockEnDeposito.toLocaleString('es-AR')}
              </div>
            </div>
          </div>

          {/* Barra de Proporción Segmentada Continua */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex gap-1 p-0.5">
            <div style={{ width: `${pctCaja}%` }} className="h-full bg-amber-400 rounded-full" title={`Caja: ${pctCaja}%`} />
            <div style={{ width: `${pctPrestamos}%` }} className="h-full bg-emerald-500 rounded-full" title={`Préstamos: ${pctPrestamos}%`} />
            <div style={{ width: `${pctMercaderia}%` }} className="h-full bg-teal-400 rounded-full" title={`Mercadería: ${pctMercaderia}%`} />
            <div style={{ width: `${pctStock}%` }} className="h-full bg-blue-500 rounded-full" title={`Stock: ${pctStock}%`} />
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. LAS 4 TARJETAS DE MÉTRICAS DETALLADAS CON CONCILIACIÓN */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1: Caja Líquida Disponible */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-amber-600">payments</span> Activo Disponible
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                {pctCaja}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Caja Líquida Disponible</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.cajaLiquida.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Conciliación Contable */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Conciliación Contable:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Recaudación rendida:</span>
                <span className="font-mono font-bold text-slate-800">+$6.890.000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Comisiones pagadas:</span>
                <span className="font-mono font-bold text-rose-600">-$689.000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Compras reposición:</span>
                <span className="font-mono font-bold text-rose-600">-$1.281.000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Aportes de capital:</span>
                <span className="font-mono font-bold text-emerald-600">+$500.000</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Disponibilidad:</span>
            <span className="font-bold text-emerald-600">T+0 Sin Restricción</span>
          </div>
        </div>

        {/* Card 2: Capital en Calle (Préstamos) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">currency_exchange</span> Cartera Efectivo
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                {pctPrestamos}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Capital en Calle (Préstamos)</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.capitalEnCalle.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Parámetros Operativos */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Parámetros Operativos:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Créditos en curso:</span>
                <span className="font-mono font-bold text-slate-800">142 colocaciones</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Plazos habituales:</span>
                <span className="font-mono text-slate-700">26 a 35 cuotas</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Recupero mes:</span>
                <span className="font-mono font-bold text-emerald-600">68.0% cumplido</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Mora residual (&gt;3d):</span>
                <span className="font-mono font-bold text-rose-600">4.8% ($880.800)</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Riesgo Crediticio:</span>
            <span className="font-bold text-emerald-600">Grado A (Controlado)</span>
          </div>
        </div>

        {/* Card 3: Mercadería Financiada en Calle */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-teal-600">tv_gen</span> Cartera Bienes
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-xs font-bold border border-teal-200">
                {pctMercaderia}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Mercadería Financiada en Calle</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.mercaderiaFinanciada.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Bases Contractuales */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Bases Contractuales:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Contratos vigentes:</span>
                <span className="font-mono font-bold text-slate-800">98 activos</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tipología:</span>
                <span className="font-mono text-slate-700">Electro &amp; Muebles</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Planes extendidos:</span>
                <span className="font-mono text-slate-700">42 a 220 cuotas</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cumplimiento:</span>
                <span className="font-mono font-bold text-emerald-600">92.5% óptimo</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Garantía Prendaria:</span>
            <span className="font-bold text-emerald-600">100% Respaldado</span>
          </div>
        </div>

        {/* Card 4: Stock en Depósito Central */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span className="material-symbols-outlined text-[18px] text-blue-600">inventory_2</span> Inventario Físico
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                {pctStock}% Ratio
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">Stock en Depósito Central</div>
            <div className="text-2xl font-black font-mono text-slate-900">
              ${kpis.stockEnDeposito.toLocaleString('es-AR')},00
            </div>

            {/* Desglose Auditoría Almacén */}
            <div className="bg-slate-50 rounded-xl p-3.5 space-y-2 text-xs border border-slate-100">
              <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                Auditoría Almacén:
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Unidades en stock:</span>
                <span className="font-mono font-bold text-slate-800">164 unidades</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Criterio valuación:</span>
                <span className="font-mono text-slate-700">Costo reposición</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Rotación promedio:</span>
                <span className="font-mono font-bold text-emerald-600">18 días</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Seguro siniestros:</span>
                <span className="font-mono font-bold text-emerald-600">Póliza al día</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Ubicación Física:</span>
            <span className="font-bold text-slate-700">Galpón Alberdi #340</span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. BENCHMARK COBRADORES (8 cols) + COMPOSICIÓN DE CARTERA DONUT (4 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Rendimiento por Cobrador */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px]">speed</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Rendimiento y Efectividad por Cobrador
                  </h3>
                  <p className="text-xs text-slate-500">
                    Benchmark comparativo diario en tiempo real: Cobrado rendido vs. Cartera exigible
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Meta Diaria: &ge; 90%
              </span>
            </div>

            {/* Lista de Ranking */}
            <div className="space-y-4 pt-2">
              {efectividadCobradores.map((c) => (
                <div key={c.nombre} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100 hover:bg-slate-50/80 transition">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center font-mono">
                        {c.orden}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900">{c.nombre}</span>
                        <span className="text-xs text-slate-400 ml-2">{c.zona}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs">
                        <span className="font-mono font-bold text-slate-900">
                          ARS ${c.cobrado.toLocaleString('es-AR')}
                        </span>
                        <span className="text-slate-400 font-mono"> / ${c.exigible.toLocaleString('es-AR')}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          c.color === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.pct}% {c.estado}
                      </span>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        c.color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(c.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Totales Benchmark */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-4 bg-slate-50/60 p-4 rounded-xl">
            <div className="flex items-center gap-6">
              <span>Exigible Consolidado: <strong className="font-mono text-slate-900">$702.000</strong></span>
              <span>Recaudado Efectivo: <strong className="font-mono text-emerald-600">$637.900</strong></span>
            </div>
            <div className="font-bold text-emerald-700">
              Efectividad Global de Calle: 90.86% (Superávit de Gestión)
            </div>
          </div>
        </div>

        {/* Composición de Cartera con Donut SVG */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">pie_chart</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Composición de Cartera</h3>
                <p className="text-xs text-slate-500">Ponderación de capital activo en calle</p>
              </div>
            </div>

            {/* Gráfico Donut SVG */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-44 h-44">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" fill="transparent" r="40" stroke="#e2e8f0" strokeWidth="12" />
                  {/* Segmento 1: Efectivo 52.2% */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#059669"
                    strokeDasharray="131.2 251.3"
                    strokeDashoffset="0"
                    strokeWidth="12"
                  />
                  {/* Segmento 2: Electro 47.8% */}
                  <circle
                    cx="50"
                    cy="50"
                    fill="transparent"
                    r="40"
                    stroke="#0d9488"
                    strokeDasharray="120.1 251.3"
                    strokeDashoffset="-131.2"
                    strokeWidth="12"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Calle</span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    ${(totalCalle / 1000000).toFixed(2)}M
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">100% Activa</span>
                </div>
              </div>
            </div>

            {/* Leyenda Detallada */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                  <span className="font-semibold text-slate-800">Préstamos en Efectivo</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">${kpis.capitalEnCalle.toLocaleString('es-AR')}</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-slate-700">52.2%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-teal-600"></span>
                  <span className="font-semibold text-slate-800">Electro &amp; Bienes</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-slate-800">${kpis.mercaderiaFinanciada.toLocaleString('es-AR')}</span>
                  <span className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-slate-700">47.8%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400">Riesgo Diversificado:</span>
            <span className="font-bold text-emerald-600">Perfil Balanceado</span>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. ÍNDICES DE SALUD FINANCIERA (8 cols) + PROYECCIÓN MENSUAL (4 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Índices y Calidad de Cartera */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">health_and_safety</span>
                <h3 className="text-base font-bold text-slate-900">
                  Índices de Salud Financiera &amp; Calidad de Cartera
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Métricas de control prudencial crediticio bajo umbrales internos de solvencia
              </p>
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="material-symbols-outlined text-[16px]">shield</span> Calificación Institucional A+
            </span>
          </div>

          {/* 3 Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Mora Temprana</span>
                <span className="material-symbols-outlined text-[18px]">schedule</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900">3.2%</div>
                <div className="text-xs text-slate-400 mt-0.5">Retraso de 1 a 3 días</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '25%' }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Umbral Máx: 6.0%</span>
                <span className="font-bold text-emerald-600">Dentro de Norma</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-rose-600 font-bold uppercase tracking-wider">
                <span>Mora Tardía</span>
                <span className="material-symbols-outlined text-[18px] text-rose-600">warning</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-rose-600">1.8%</div>
                <div className="text-xs text-slate-400 mt-0.5">Retraso &gt; 7 días (Incobrable temp.)</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: '18%' }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Pérdida Esperada: 0.4%</span>
                <span className="font-bold text-emerald-600">Riesgo Mínimo</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
                <span>Rotación de Cartera</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-600">autorenew</span>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900">
                  28.4 <span className="text-sm font-normal text-slate-400">Días</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Ciclo de cobro promedio</div>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '82%' }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Velocidad: Alta</span>
                <span className="font-bold text-emerald-600">Liquidez Continua</span>
              </div>
            </div>
          </div>

          {/* Mini Tabla de Tramos de Vencimiento */}
          <div className="rounded-xl border border-slate-200/80 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-2.5 px-4">Tramo de Vencimiento</th>
                  <th className="py-2.5 px-4">Créditos</th>
                  <th className="py-2.5 px-4 text-right">Monto en Riesgo</th>
                  <th className="py-2.5 px-4 text-right">% Cartera</th>
                  <th className="py-2.5 px-4">Plan de Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900">Al día (0 días)</td>
                  <td className="py-3 px-4 font-mono">218 clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">$33.392.500</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">95.0%</td>
                  <td className="py-3 px-4 text-slate-500">Continuidad regular</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-slate-900">Atraso leve (1 a 3 días)</td>
                  <td className="py-3 px-4 font-mono">14 clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">$1.125.000</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">3.2%</td>
                  <td className="py-3 px-4 text-slate-500">Refuerzo cobranza en ruta</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-rose-600">Mora tardía (&gt; 7 días)</td>
                  <td className="py-3 px-4 font-mono">8 clientes</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">$632.500</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">1.8%</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">Visita de recuperador legal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Proyección de Cobro Mensual Estimado */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-700/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                <span className="material-symbols-outlined text-[16px]">trending_up</span> Proyección Oficial
              </span>
              <span className="text-xs font-mono text-slate-400">Cierre Junio 2026</span>
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Proyección de Cobro Mensual Estimado</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ingreso bruto proyectado según amortizaciones y contratos activos sin refinanciamiento.
              </p>
            </div>

            <div>
              <div className="text-3xl font-black font-mono text-emerald-400">
                $32.400.000<span className="text-sm font-normal text-slate-400">,00</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                ARS • Modelo estocástico con 94.5% de intervalo de confianza
              </div>
            </div>

            {/* Desglose de proyección */}
            <div className="space-y-2.5 bg-slate-800/80 p-4 rounded-xl text-xs border border-slate-700/60">
              <div className="flex justify-between text-slate-300">
                <span>Cuotas Efectivo Proyectadas:</span>
                <span className="font-mono font-bold text-white">$17.800.000</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Cuotas Electro &amp; Muebles:</span>
                <span className="font-mono font-bold text-white">$14.600.000</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Tasa de Deserción Esperada:</span>
                <span className="font-mono font-bold text-emerald-400">-2.1% (Controlada)</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700/70 flex items-center justify-between text-xs">
            <span className="text-slate-400">Flujo de Caja: <strong className="text-emerald-400">Positivo</strong></span>
            <button className="text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1 transition">
              Ver Escenarios <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
