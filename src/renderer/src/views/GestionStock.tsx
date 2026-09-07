import React, { useState } from 'react';

interface ProductoInventario {
  id: number;
  nombre: string;
  lote: string;
  icono: string;
  costo: number;
  stock_deposito: number;
  stock_calle: number;
  valuacion: number;
  retorno: number;
  estado: 'Stock Óptimo' | 'Stock Bajo' | 'Stock Alto';
  series: string[];
}

export const GestionStock: React.FC = () => {
  const [productos, setProductos] = useState<ProductoInventario[]>([
    {
      id: 1,
      nombre: 'Smart TV 43" Noblex / Philips',
      lote: 'Lote NBX-PHIL-24 | 36 trazados',
      icono: 'tv',
      costo: 220000,
      stock_deposito: 14,
      stock_calle: 22,
      valuacion: 3080000,
      retorno: 64,
      estado: 'Stock Óptimo',
      series: ['NBX-43FHD-994103', 'NBX-43FHD-994104', 'PH-43SMART-00219'],
    },
    {
      id: 2,
      nombre: 'Heladera con Freezer Gafa 280L',
      lote: 'Lote GAF-280-W | 24 trazados',
      icono: 'kitchen',
      costo: 340000,
      stock_deposito: 8,
      stock_calle: 16,
      valuacion: 2720000,
      retorno: 58,
      estado: 'Stock Bajo',
      series: ['GAF-SERIE-8812', 'GAF-SERIE-8819'],
    },
    {
      id: 3,
      nombre: 'Sommier 2 Plazas Piero Espuma',
      lote: 'Lote PIERO-CORONA | 50 trazados',
      icono: 'bed',
      costo: 185000,
      stock_deposito: 19,
      stock_calle: 31,
      valuacion: 3515000,
      retorno: 72,
      estado: 'Stock Óptimo',
      series: ['PIERO-SER-1190', 'PIERO-SER-1194', 'PIERO-SER-1201'],
    },
    {
      id: 4,
      nombre: 'Celular Moto G54 256GB 5G',
      lote: 'Lote MOT-G54-BLUE | 40 trazados',
      icono: 'smartphone',
      costo: 145000,
      stock_deposito: 22,
      stock_calle: 18,
      valuacion: 3190000,
      retorno: 81,
      estado: 'Stock Alto',
      series: ['IMEI: 358920119283401', 'IMEI: 358920119283402'],
    },
    {
      id: 5,
      nombre: 'Ventilador Industrial 30" Metal',
      lote: 'Lote VENT-IND-30 | 46 trazados',
      icono: 'mode_fan',
      costo: 520000,
      stock_deposito: 35,
      stock_calle: 11,
      valuacion: 1820000,
      retorno: 69,
      estado: 'Stock Alto',
      series: ['VENT-SN-9901', 'VENT-SN-9902', 'VENT-SN-9903'],
    },
  ]);

  // Formulario de Ingreso de Compra
  const [categoriaCompra, setCategoriaCompra] = useState('Electrodomésticos');
  const [proveedorCompra, setProveedorCompra] = useState('Distribuidora Cuyo Norte');
  const [descCompra, setDescCompra] = useState('Lavarropas Drean Next 8.12 Eco');
  const [cantidadCompra, setCantidadCompra] = useState<number>(6);
  const [costoCompra, setCostoCompra] = useState<number>(385000);
  const [financiacionBase, setFinanciacionBase] = useState<number>(680000);

  // Formulario de Recupero
  const [opRecupero, setOpRecupero] = useState<string>('#PR-09841');
  const [causalRetiro, setCausalRetiro] = useState('Incumplimiento contractual reiterado');
  const [estadoBien, setEstadoBien] = useState('Detalles cosméticos (Desgaste menor)');
  const [depositoReceptor, setDepositoReceptor] = useState('Galpón Central Alberdi #340');

  // Modales y Toasts
  const [modalSeries, setModalSeries] = useState<{ nombre: string; series: string[] } | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);
  const [filtroMatriz, setFiltroMatriz] = useState<string>('');

  const handleIngresarLote = (e: React.FormEvent) => {
    e.preventDefault();
    setToastMensaje(`¡Lote de ${cantidadCompra} un. de "${descCompra}" ingresado y conciliado con tesorería!`);
    setTimeout(() => setToastMensaje(null), 5000);
  };

  const handleEjecutarRetiro = () => {
    setToastMensaje(
      `¡Retiro de mercadería ${opRecupero} efectuado con éxito! Unidad reincorporada a ${depositoReceptor} y saldo deudor de $94.000 compensado.`
    );
    setTimeout(() => setToastMensaje(null), 5000);
  };

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(filtroMatriz.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Toast Notificación */}
      {toastMensaje && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-600 text-[24px]">check_circle</span>
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
      {/* 1. TOP HEADER CONTEXT BAR */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono text-[11px] font-bold rounded uppercase tracking-wider">
              Módulo Logístico &amp; Legal
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-mono text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              AUDIT-SYNC ACTIVO
            </span>
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            Control de Stock Físico, Inventario en Calle &amp; Recupero por Mora
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            Trazabilidad de unidades activas, gestión judicial de secuestros y conciliación de mercadería financiada.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => alert('Exportando Reporte CIAL oficial de bienes prendados...')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            <span className="material-symbols-outlined text-[18px]">inventory</span>
            <span>Exportar Reporte CIAL</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setModalSeries({
                nombre: 'Escaneo de Entrada / IMEI',
                series: ['NBX-43FHD-994103', 'NBX-43FHD-994104', 'PH-43SMART-00219'],
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition"
          >
            <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
            <span>Escanear IMEI / Serie</span>
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. LAS 5 TARJETAS SUPERIORES DE KPIS LOGÍSTICOS */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Valuación en Depósito */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Valuación Depósito</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warehouse</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">ARS $8.150.500</div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-bold">
              <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
              <span>+4.2%</span>
              <span className="text-slate-400 font-normal">vs. cierre anterior</span>
            </div>
          </div>
        </div>

        {/* Card 2: Capital Financiado */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Capital Financiado</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-700">ARS $16.800.000</div>
            <div className="text-xs text-slate-400 mt-1">Valor de colocación activa</div>
          </div>
        </div>

        {/* Card 3: Stock en Galpón */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Stock en Galpón</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">shelves</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              164 <span className="text-xs font-normal text-slate-400">un.</span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-slate-900 h-full rounded-full" style={{ width: '62%' }} />
            </div>
          </div>
        </div>

        {/* Card 4: Mercadería en Calle */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mercadería en Calle</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-slate-900">
              98 <span className="text-xs font-normal text-slate-400">un.</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>93 contratadas sin mora</span>
            </div>
          </div>
        </div>

        {/* Card 5: Bienes en Riesgo */}
        <div className="bg-rose-50 p-5 rounded-2xl shadow-sm border border-rose-200 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between text-rose-600">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bienes en Riesgo</span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
            </div>
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-rose-700">
              5 <span className="text-xs font-normal text-rose-600">unidades</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-rose-600">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Mora crítica &gt; 14 días</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. DOS PANELES OPERATIVOS: RECUPERO POR MORA (7 cols) & INGRESO DE COMPRAS (5 cols) */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Columna Izquierda: Protocolo de Recupero de Mercadería (7 cols) */}
        <div className="xl:col-span-7 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-rose-200 space-y-6 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-rose-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">unfold_more_double</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Protocolo de Recupero de Mercadería por Incumplimiento
                </h3>
                <p className="text-xs text-slate-500">
                  Secuestro extrajudicial y extinción compensatoria en cuenta de cliente
                </p>
              </div>
            </div>

            <span className="px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg uppercase tracking-wider">
              Acción Ejecutoria
            </span>
          </div>

          {/* Buscador de Expediente en Mora */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={opRecupero}
                onChange={(e) => setOpRecupero(e.target.value)}
                placeholder="Buscar OP... ej. #PR-09841 o DNI cliente"
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 focus:bg-white pl-10 pr-3 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none transition"
              />
            </div>
            <button
              type="button"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">manage_search</span>
              <span>Validar Expediente</span>
            </button>
          </div>

          {/* Ficha del Expediente de Ramón Sosa */}
          <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-200/70 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-rose-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-[20px]">person_off</span>
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">Ramón Sosa (DNI 28.491.032)</div>
                  <div className="text-xs text-slate-500">Domicilio: Calle Belgrano 1420, B° Belgrano, SDE</div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-rose-700 text-xs font-bold uppercase font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  18 DÍAS SIN ABONAR
                </span>
                <div className="text-sm font-bold font-mono text-rose-700">
                  Saldo impago: ARS $94.000
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-white p-3.5 rounded-xl border border-rose-200/60 space-y-1">
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Bien Prendado / Financiado
                </span>
                <div className="font-bold text-slate-900">Smart TV Noblex 43" Full HD</div>
                <div className="font-mono text-slate-500">IMEI / SERIE: NBX-43FHD-994103</div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-rose-200/60 space-y-1">
                <span className="font-bold uppercase tracking-wider text-slate-400 block text-[10px]">
                  Estado Geográfico y Legal
                </span>
                <div className="font-bold text-slate-900 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">pin_drop</span>
                  <span>Localizado en domicilio</span>
                </div>
                <div className="text-emerald-700">Acta notarial de intimación entregada</div>
              </div>
            </div>
          </div>

          {/* Selectores de Parámetros de Retiro */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Causal de Retiro
              </label>
              <select
                value={causalRetiro}
                onChange={(e) => setCausalRetiro(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Incumplimiento contractual reiterado">Incumplimiento reiterado</option>
                <option value="Renuncia voluntaria deudor">Renuncia voluntaria deudor</option>
                <option value="Orden de secuestro ejecutorio">Orden de secuestro ejecutorio</option>
              </select>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Estado de Recepción
              </label>
              <select
                value={estadoBien}
                onChange={(e) => setEstadoBien(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Buen estado (Operativo)">Buen estado (Operativo)</option>
                <option value="Detalles cosméticos (Desgaste menor)">Detalles cosméticos</option>
                <option value="Requiere servicio técnico / Incompleto">Requiere servicio técnico</option>
              </select>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                Depósito Receptor
              </label>
              <select
                value={depositoReceptor}
                onChange={(e) => setDepositoReceptor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-rose-400 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              >
                <option value="Galpón Central Alberdi #340">Galpón Central Alberdi #340</option>
                <option value="Depósito Sur - Calle La Plata 820">Depósito Sur - La Plata 820</option>
                <option value="Taller de Servicio Oficial">Taller de Servicio Oficial</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleEjecutarRetiro}
              className="w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition"
            >
              <span className="material-symbols-outlined text-[20px]">assignment_return</span>
              <span>Registrar Retiro de Mercadería por Falta de Pago</span>
            </button>

            <div className="text-center text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">verified_user</span>
              <span>
                Efecto: Devuelve automáticamente la unidad al inventario bajo estado 'Reacondicionado' y extingue el saldo en mora judicial ($94.000).
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Ingreso de Mercadería (5 cols) */}
        <div className="xl:col-span-5 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">add_business</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Ingreso de Mercadería</h3>
                <p className="text-xs text-slate-500">Alta de stock por compra directa a mayoristas</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold font-mono rounded-lg">
              Lote Nuevo
            </span>
          </div>

          <form onSubmit={handleIngresarLote} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Categoría</label>
                <select
                  value={categoriaCompra}
                  onChange={(e) => setCategoriaCompra(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
                >
                  <option value="Electrodomésticos">Electrodomésticos</option>
                  <option value="Muebles &amp; Colchonería">Muebles &amp; Colchonería</option>
                  <option value="Motos / Rodados">Motos / Rodados</option>
                  <option value="Telefonía Celular">Telefonía Celular</option>
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Proveedor Oficial</label>
                <input
                  type="text"
                  value={proveedorCompra}
                  onChange={(e) => setProveedorCompra(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Descripción del Producto</label>
              <input
                type="text"
                value={descCompra}
                onChange={(e) => setDescCompra(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-800 font-medium focus:outline-none transition"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidadCompra}
                  onChange={(e) => setCantidadCompra(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Costo Unit. ($)</label>
                <input
                  type="number"
                  value={costoCompra}
                  onChange={(e) => setCostoCompra(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">Financiación Base</label>
                <input
                  type="number"
                  value={financiacionBase}
                  onChange={(e) => setFinanciacionBase(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-emerald-700 font-mono font-bold focus:outline-none transition"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Inversión Total de Lote:</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  ARS ${(cantidadCompra * costoCompra).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Margen Teórico:</span>
                <span className="text-sm font-bold font-mono text-emerald-600">+76.6% retorno</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition"
            >
              <span className="material-symbols-outlined text-[18px]">post_add</span>
              <span>Ingresar al Inventario Físico</span>
            </button>
          </form>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. MATRIZ DE INVENTARIO FÍSICO VS. CALLE FINANCIADA (TABLA COMPLETA) */}
      {/* ===================================================================== */}
      <section className="bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">table_chart_view</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Matriz de Inventario Físico vs. Calle Financiada
              </h3>
              <p className="text-xs text-slate-500">
                Visualización comparativa de stock cautivo en depósito contra rotación activa en cartera de clientes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                filter_list
              </span>
              <input
                type="text"
                value={filtroMatriz}
                onChange={(e) => setFiltroMatriz(e.target.value)}
                placeholder="Filtrar matriz..."
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl text-xs text-slate-800 focus:outline-none transition w-56"
              />
            </div>
            <button
              onClick={() => alert('Descargando inventario completo en formato CSV...')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">file_download</span>
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Tabla Espaciosa con Todos los Datos */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">Producto / Referencia Técnica</th>
                <th className="py-3 px-4 text-right">Costo Unit. ($)</th>
                <th className="py-3 px-4 text-center">En Depósito</th>
                <th className="py-3 px-4 text-center">En Calle</th>
                <th className="py-3 px-4 text-right">Valuación Depósito</th>
                <th className="py-3 px-4 text-center">Tasa Retorno</th>
                <th className="py-3 px-4 text-center">Estado Stock</th>
                <th className="py-3 px-4 text-right">Acciones Directas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {productosFiltrados.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-[18px]">{p.icono}</span>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{p.nombre}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{p.lote}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                    ${p.costo.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono font-bold">
                      {p.stock_deposito} un.
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-bold border border-emerald-100">
                      {p.stock_calle} un.
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ${p.valuacion.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="inline-flex items-center gap-1 font-mono font-bold text-emerald-600">
                      <span className="material-symbols-outlined text-[14px]">trending_up</span>
                      <span>{p.retorno}%</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        p.estado === 'Stock Óptimo'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : p.estado === 'Stock Bajo'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          p.estado === 'Stock Óptimo'
                            ? 'bg-emerald-500'
                            : p.estado === 'Stock Bajo'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      {p.estado}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => setModalSeries({ nombre: p.nombre, series: p.series })}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                        title="Ver Números de Serie / IMEI"
                      >
                        <span className="material-symbols-outlined text-[18px]">barcode</span>
                      </button>
                      <button
                        onClick={() => alert(`Reasignando unidad de ${p.nombre} a nuevo crédito en trámite...`)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                        title="Reasignar a Nuevo Crédito"
                      >
                        <span className="material-symbols-outlined text-[14px]">sync_alt</span>
                        <span>Reasignar</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal de Trazabilidad de Números de Serie */}
      {modalSeries && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-800 text-[22px]">fingerprint</span>
                <h4 className="font-bold text-sm text-slate-900">{modalSeries.nombre}</h4>
              </div>
              <button
                onClick={() => setModalSeries(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Listado de unidades únicas registradas en el libro mayor de garantías prendarias:
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200/70">
              {modalSeries.series.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs font-mono">
                  <span className="text-slate-800 font-bold">{s}</span>
                  <span className="text-emerald-600 font-bold text-[10px]">ACTIVO</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalSeries(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
