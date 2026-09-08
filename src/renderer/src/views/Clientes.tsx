/**
 * Clientes — Monitoreo en Tiempo Real de Cartera
 * ================================================
 * Vista dedicada al estado de clientes: cuotas, mora, acciones de cobro.
 * Conectada a datos reales de Supabase con sincronización en vivo y
 * fallback a persistencia local ('credit_on_cartera_operaciones') para modo prueba y demo.
 */
import React, { useState, useRef } from 'react';
import {
  useClientesEnVivo,
  type OperacionConMora,
  type FiltrosCartera,
  type ClienteInfo,
  type CobradorInfo,
  armarOperacionConMora,
  COBRADORES_DEFAULT,
} from '../hooks/useClientesEnVivo';
import { supabase } from '../lib/supabase';
import type { NivelMora, TipoOperacion } from '../../../types/payment';
import { descargarPlantillaCSV, parsearCSV, obtenerValor, obtenerNumero } from '../utils/csv-helper';
import {
  PLANES_PRODUCTO_OFICIALES,
  PLANES_EFECTIVO_OFICIALES,
  calcularCuotaProducto,
  calcularCuotaEfectivo,
} from '@core/calendar-engine';

/* ─── Helpers de formato ─── */

const fmtMoney = (n: number | null | undefined) =>
  `$${(Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const moraBadge = (nivel: NivelMora) => {
  const estilos: Record<NivelMora, { bg: string; text: string; border: string; label: string }> = {
    AL_DIA: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Al día' },
    ALERTA: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Alerta' },
    MORA_CRITICA: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Mora Crítica' },
    EVALUAR_RETIRO: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-300', label: 'Evaluar Retiro' },
  };
  const s = estilos[nivel];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${s.bg} ${s.text} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${nivel === 'AL_DIA' ? 'bg-emerald-500' : nivel === 'ALERTA' ? 'bg-amber-500' : 'bg-rose-500'}`} />
      {s.label}
    </span>
  );
};

const tipoBadge = (tipo: TipoOperacion) => (
  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
    tipo === 'PRODUCTO'
      ? 'bg-blue-50 text-blue-700 border border-blue-100'
      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  }`}>
    {tipo === 'PRODUCTO' ? 'Producto' : 'Efectivo'}
  </span>
);

/* ─── Modal simple genérico ─── */
const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, maxWidth = 'max-w-2xl', children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 w-full ${maxWidth} max-h-[88vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition">
            <span className="material-symbols-outlined text-[20px] text-slate-400">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

/* ─── Componente principal ─── */

export const Clientes: React.FC = () => {
  const {
    operaciones,
    todasLasOperaciones,
    cobradores,
    filtros,
    setFiltros,
    indicadores,
    loading,
    error,
    refetch,
    guardarOperaciones,
    agregarOperacion,
    eliminarOperacion,
    vaciarCartera,
    restaurarDemo,
    registrarCobro,
    registrarVisita,
    obtenerHistorial,
  } = useClientesEnVivo();

  // Estado de modales
  const [modalDetalle, setModalDetalle] = useState<OperacionConMora | null>(null);
  const [modalHistorial, setModalHistorial] = useState<OperacionConMora | null>(null);
  const [modalCobro, setModalCobro] = useState<OperacionConMora | null>(null);
  const [modalVisita, setModalVisita] = useState<OperacionConMora | null>(null);
  const [modalRecibo, setModalRecibo] = useState<OperacionConMora | null>(null);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);

  // Modal Nueva Operación
  const [modalNuevaOp, setModalNuevaOp] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDni, setNuevoDni] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoDomicilio, setNuevoDomicilio] = useState('');
  const [nuevoTipo, setNuevoTipo] = useState<TipoOperacion>('EFECTIVO');
  const [nuevoMonto, setNuevoMonto] = useState('100000');
  const [nuevasCuotas, setNuevasCuotas] = useState('26');
  const [nuevoValorCuota, setNuevoValorCuota] = useState('5000');
  const [nuevoCobradorId, setNuevoCobradorId] = useState<number>(1);

  // Estado para cobro manual
  const [montoCobroInput, setMontoCobroInput] = useState('');
  const [cobroProcessing, setCobroProcessing] = useState(false);

  // Estado para visita infructuosa
  const [motivoVisita, setMotivoVisita] = useState<string>('CERRADO');
  const [obsVisita, setObsVisita] = useState('');
  const [visitaProcessing, setVisitaProcessing] = useState(false);

  // Estados para Carga Masiva Excel
  const [modalImportarExcel, setModalImportarExcel] = useState(false);
  const [archivoCargando, setArchivoCargando] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);
  const inputExcelRef = useRef<HTMLInputElement | null>(null);

  // Confirmación vaciar
  const [confirmarVaciar, setConfirmarVaciar] = useState(false);

  const handleArchivoExcelSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoCargando(true);
    setArchivoError(null);

    try {
      const filas = await parsearCSV(file);
      if (filas.length === 0) {
        throw new Error('El archivo no contiene filas o está vacío.');
      }

      const hoyStr = new Date().toISOString().split('T')[0];
      let maxNroOp = todasLasOperaciones.reduce((max, o) => Math.max(max, o.nro_op), 100);
      const nuevasOps: OperacionConMora[] = [];

      let procesados = 0;
      for (const f of filas) {
        const nombre =
          obtenerValor(f, ['nombre', 'cliente', 'titular', 'razon_social', 'persona']) || '';
        if (!nombre) continue;
        const dni =
          obtenerValor(f, ['dni', 'documento', 'cuit', 'cuil']) || null;
        const telefono =
          obtenerValor(f, ['telefono', 'celular', 'tel', 'contacto']) || null;
        const domicilio =
          obtenerValor(f, ['direccion', 'domicilio', 'calle', 'ubicacion']) || 'Sin dirección especificada';
        const monto =
          obtenerNumero(f, ['monto_financiado', 'monto_total', 'capital', 'monto', 'total']) || 100000;
        const cuotasCount =
          obtenerNumero(f, ['cantidad_cuotas', 'cuotas_totales', 'cuotas', 'plazo']) || 20;
        const valorCuota =
          obtenerNumero(f, ['valor_cuota', 'cuota_valor', 'cuota', 'importe_cuota']) ||
          Math.round((monto * 1.5) / cuotasCount);
        const tipoStr = obtenerValor(f, ['tipo_operacion', 'tipo']).toUpperCase();
        const tipo: TipoOperacion = tipoStr.includes('PROD') ? 'PRODUCTO' : 'EFECTIVO';
        const cobradorNombre =
          obtenerValor(f, ['cobrador', 'cobrador_asignado', 'oficial']) || '';

        // Buscar cobrador por nombre o asignar el primero disponible
        const cobradorEncontrado = cobradores.find(c =>
          c.nombre.toLowerCase().includes(cobradorNombre.toLowerCase())
        ) || cobradores[0] || COBRADORES_DEFAULT[0];

        maxNroOp++;
        const nuevoNroOp = maxNroOp;

        const clienteInfo: ClienteInfo = {
          id_cliente: nuevoNroOp,
          nombre,
          dni,
          domicilio,
          telefono,
          calificacion: 'BUENO'
        };

        // Parsear cuotas pagadas / avance del archivo
        let cuotasPagadas = 0;
        const avanceRaw = obtenerValor(f, [
          'cuotas_pagadas',
          'avance',
          'pagadas',
          'cuotas_cobradas',
          'cuotas_abonadas',
          'abonadas',
          'cobrado',
          'progreso'
        ]);

        if (avanceRaw) {
          if (avanceRaw.includes('/')) {
            const partes = avanceRaw.split('/');
            cuotasPagadas = parseInt(partes[0].trim(), 10) || 0;
          } else if (avanceRaw.includes('%')) {
            const pct = parseFloat(avanceRaw.replace('%', '').trim()) || 0;
            cuotasPagadas = Math.round((pct / 100) * cuotasCount);
          } else {
            cuotasPagadas = parseInt(avanceRaw.trim(), 10) || 0;
          }
        } else {
          // Intentar deducir si viene saldo restante en el archivo
          const saldoRestanteRaw = obtenerNumero(f, ['saldo_restante', 'saldo', 'deuda_actual', 'restante']);
          if (saldoRestanteRaw > 0 && saldoRestanteRaw < (valorCuota * cuotasCount)) {
            cuotasPagadas = Math.round(((valorCuota * cuotasCount) - saldoRestanteRaw) / valorCuota);
          }
        }
        cuotasPagadas = Math.max(0, Math.min(cuotasPagadas, cuotasCount));

        // Parsear cuotas vencidas si vienen en el archivo
        const cuotasVencidas = obtenerNumero(f, ['cuotas_vencidas', 'vencidas', 'atraso', 'mora', 'cuotas_en_mora']) || 0;

        const opMora = armarOperacionConMora(
          nuevoNroOp,
          hoyStr,
          tipo,
          monto,
          cuotasCount,
          valorCuota,
          clienteInfo,
          cobradorEncontrado,
          cuotasPagadas,
          cuotasVencidas
        );

        nuevasOps.push(opMora);
        procesados++;

        // Guardado transparente y completo en Supabase si está disponible
        if (supabase) {
          (async () => {
            try {
              // 1. Insertar o buscar cliente
              const { data: cData } = await supabase
                .from('clientes')
                .insert({
                  nombre,
                  dni,
                  telefono,
                  domicilio,
                  calificacion: 'BUENO'
                })
                .select('id_cliente')
                .single();

              if (!cData?.id_cliente) return;

              // 2. Resolver o asegurar plan válido
              const { data: planExistente } = await supabase
                .from('planes')
                .select('id_plan')
                .eq('tipo', tipo)
                .limit(1)
                .maybeSingle();

              let idPlan = planExistente?.id_plan;
              if (!idPlan) {
                const { data: nuevoPlan } = await supabase
                  .from('planes')
                  .insert({
                    tipo,
                    dias: cuotasCount,
                    tasa_interes: 30,
                    descripcion: `Plan ${tipo} ${cuotasCount} cuotas`
                  })
                  .select('id_plan')
                  .single();
                idPlan = nuevoPlan?.id_plan;
              }

              // 3. Resolver o asegurar cobrador en DB
              const { data: cobExistente } = await supabase
                .from('cobradores')
                .select('id_cobrador')
                .limit(1)
                .maybeSingle();

              let idCobrador = cobExistente?.id_cobrador || cobradorEncontrado.id_cobrador;
              if (!cobExistente) {
                const { data: nuevoCob } = await supabase
                  .from('cobradores')
                  .insert({
                    nombre: cobradorEncontrado.nombre || 'Carlos Mendilaharzu',
                    porcentaje_comision: 8,
                    activo: true
                  })
                  .select('id_cobrador')
                  .single();
                if (nuevoCob?.id_cobrador) idCobrador = nuevoCob.id_cobrador;
              }

              // 4. Resolver producto si la operación es de tipo PRODUCTO
              let idProducto: number | null = null;
              if (tipo === 'PRODUCTO') {
                const { data: prodExistente } = await supabase
                  .from('productos')
                  .select('id_producto')
                  .limit(1)
                  .maybeSingle();

                if (prodExistente?.id_producto) {
                  idProducto = prodExistente.id_producto;
                } else {
                  const { data: nuevoProd } = await supabase
                    .from('productos')
                    .insert({
                      nombre: 'Artículo General Financiado',
                      costo: monto,
                      activo: true,
                      stock_deposito: 10,
                      stock_calle: 10
                    })
                    .select('id_producto')
                    .single();
                  idProducto = nuevoProd?.id_producto || null;
                }
              }

              if (idPlan) {
                // 5. Insertar operación con foreign keys válidas
                const { data: opData } = await supabase
                  .from('operaciones')
                  .insert({
                    id_cliente: cData.id_cliente,
                    id_cobrador_actual: idCobrador,
                    id_plan: idPlan,
                    id_producto: idProducto,
                    tipo,
                    monto_capital: monto,
                    monto_total: valorCuota * cuotasCount,
                    importe_cuota: valorCuota,
                    saldo_restante: opMora.saldo_restante,
                    domicilio_cobro: domicilio,
                    estado: 'VIGENTE'
                  })
                  .select('nro_op')
                  .single();

                // 6. Insertar cuotas generadas para sincronización con terminal móvil
                if (opData?.nro_op) {
                  const cuotasRows = opMora.cuotas.map(c => ({
                    nro_op: opData.nro_op,
                    numero_cuota: c.numero_cuota,
                    fecha_vencimiento: c.fecha_vencimiento,
                    monto_esperado: c.monto_esperado,
                    monto_pagado: c.monto_pagado,
                    estado: c.estado,
                    fecha_pago_efectivo: c.fecha_pago_efectivo || null,
                  }));
                  await supabase.from('cuotas').insert(cuotasRows);
                }
              }
            } catch (dbErr) {
              console.warn('Sync Supabase background notice:', dbErr);
            }
          })();
        }
      }

      if (nuevasOps.length === 0) {
        throw new Error('No se detectaron filas válidas con datos de cliente en el archivo.');
      }

      guardarOperaciones([...nuevasOps, ...todasLasOperaciones]);
      setModalImportarExcel(false);
      setToastMensaje(`¡Se importaron ${procesados} operaciones y clientes a la cartera exitosamente!`);
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (err: any) {
      setArchivoError(err?.message || 'Error al procesar el archivo CSV/Excel');
    } finally {
      setArchivoCargando(false);
      if (inputExcelRef.current) inputExcelRef.current.value = '';
    }
  };

  /* ─── Handlers ─── */

  const updateFiltro = <K extends keyof FiltrosCartera>(key: K, value: FiltrosCartera[K]) => {
    setFiltros(prev => ({ ...prev, [key]: value }));
  };

  const handleCrearNuevaOperacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) {
      alert('Por favor ingrese el nombre del cliente.');
      return;
    }

    const monto = parseFloat(nuevoMonto) || 100000;
    const cuotasCount = parseInt(nuevasCuotas, 10) || 20;
    const valorCuota = parseFloat(nuevoValorCuota) || Math.round((monto * 1.5) / cuotasCount);
    const cobradorSeleccionado = cobradores.find(c => c.id_cobrador === nuevoCobradorId) || cobradores[0] || COBRADORES_DEFAULT[0];
    const maxNroOp = todasLasOperaciones.reduce((max, o) => Math.max(max, o.nro_op), 100);
    const nuevoNroOp = maxNroOp + 1;
    const hoyStr = new Date().toISOString().split('T')[0];

    const cliente: ClienteInfo = {
      id_cliente: nuevoNroOp,
      nombre: nuevoNombre.trim().toUpperCase(),
      dni: nuevoDni.trim() || null,
      domicilio: nuevoDomicilio.trim() || 'Sin dirección',
      telefono: nuevoTelefono.trim() || null,
      calificacion: 'BUENO',
    };

    const op = armarOperacionConMora(
      nuevoNroOp,
      hoyStr,
      nuevoTipo,
      monto,
      cuotasCount,
      valorCuota,
      cliente,
      cobradorSeleccionado,
      0,
      0
    );

    agregarOperacion(op);
    setModalNuevaOp(false);
    setNuevoNombre('');
    setNuevoDni('');
    setNuevoTelefono('');
    setNuevoDomicilio('');
    setToastMensaje(`¡Operación #${nuevoNroOp} creada exitosamente para ${cliente.nombre}!`);
    setTimeout(() => setToastMensaje(null), 5000);
  };

  const handleVerHistorial = async (op: OperacionConMora) => {
    setModalHistorial(op);
    setHistorialLoading(true);
    try {
      const localHist = obtenerHistorial(op.nro_op);
      let dbHist: any[] = [];
      if (supabase) {
        try {
          const { data } = await supabase
            .from('cobros')
            .select('id_cobro, fecha_hora, monto_cobrado, cuotas_equivalentes, motivo_no_pago, observacion, cobradores(nombre)')
            .eq('nro_op', op.nro_op)
            .order('fecha_hora', { ascending: false })
            .limit(50);
          if (data) dbHist = data;
        } catch {}
      }
      setHistorialData([...localHist, ...dbHist]);
    } catch {
      setHistorialData([]);
    } finally {
      setHistorialLoading(false);
    }
  };

  const handleRegistrarCobro = async () => {
    if (!modalCobro || cobroProcessing) return;
    const monto = parseFloat(montoCobroInput);
    if (!monto || monto <= 0) { alert('Ingrese un monto válido.'); return; }

    setCobroProcessing(true);
    try {
      const res = await registrarCobro(modalCobro.nro_op, monto);
      if (res.exito) {
        setModalCobro(null);
        setMontoCobroInput('');
        setToastMensaje(res.mensaje);
        setTimeout(() => setToastMensaje(null), 5000);
      } else {
        alert(`Error: ${res.mensaje}`);
      }
    } catch (e: any) {
      alert(`Error al registrar cobro: ${e.message}`);
    } finally {
      setCobroProcessing(false);
    }
  };

  const handleRegistrarVisita = async () => {
    if (!modalVisita || visitaProcessing) return;
    setVisitaProcessing(true);
    try {
      await registrarVisita(modalVisita.nro_op, motivoVisita, obsVisita);
      setModalVisita(null);
      setMotivoVisita('CERRADO');
      setObsVisita('');
      setToastMensaje(`Visita infructuosa registrada para OP #${modalVisita.nro_op}.`);
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setVisitaProcessing(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* ───────────────────────────────────────────────── */}
      {/* INDICADORES DE CARTERA */}
      {/* ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {[
          { label: 'Operaciones Activas', value: indicadores.total_operaciones, icon: 'account_balance', color: 'slate' },
          { label: 'Al Día', value: indicadores.al_dia, icon: 'check_circle', color: 'emerald' },
          { label: 'Alerta', value: indicadores.alerta, icon: 'warning', color: 'amber' },
          { label: 'Mora Crítica', value: indicadores.mora_critica, icon: 'error', color: 'rose' },
          { label: 'Evaluar Retiro', value: indicadores.evaluar_retiro, icon: 'gavel', color: 'red' },
          { label: 'Capital en Calle', value: fmtMoney(indicadores.monto_en_calle), icon: 'payments', color: 'emerald', mono: true },
          { label: 'Monto Vencido', value: fmtMoney(indicadores.monto_vencido), icon: 'money_off', color: 'rose', mono: true },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined text-[18px] text-${kpi.color}-500`}>{kpi.icon}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{kpi.label}</span>
            </div>
            <div className={`text-xl font-black ${kpi.mono ? 'font-mono' : ''} text-slate-900`}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ───────────────────────────────────────────────── */}
      {/* BARRA DE FILTROS & ACCIONES */}
      {/* ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Búsqueda y Selects */}
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Búsqueda */}
            <div className="relative flex-1 min-w-[180px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                type="text"
                value={filtros.busqueda}
                onChange={e => updateFiltro('busqueda', e.target.value)}
                placeholder="Buscar por nombre, DNI o N° operación..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white pl-9 pr-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition"
              />
            </div>

            {/* Cobrador */}
            <select
              value={filtros.cobrador || ''}
              onChange={e => updateFiltro('cobrador', e.target.value)}
              className="bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition"
            >
              <option value="">Todos los cobradores</option>
              {cobradores.map(c => (
                <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>

            {/* Tipo */}
            <select
              value={filtros.tipo_operacion}
              onChange={e => updateFiltro('tipo_operacion', e.target.value as TipoOperacion | '')}
              className="bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition"
            >
              <option value="">Todos los tipos</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="PRODUCTO">Producto</option>
            </select>

            {/* Estado mora */}
            <select
              value={filtros.nivel_mora}
              onChange={e => updateFiltro('nivel_mora', e.target.value as any)}
              className="bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition"
            >
              <option value="">Todos los estados</option>
              <option value="AL_DIA">Al día</option>
              <option value="ALERTA">Alerta</option>
              <option value="MORA_CRITICA">Mora Crítica</option>
              <option value="EVALUAR_RETIRO">Evaluar Retiro</option>
            </select>
          </div>

          {/* Botones de Acción */}
          <div className="flex flex-wrap items-center gap-2">

            <button
              type="button"
              onClick={() => setModalImportarExcel(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Importar clientes y operaciones desde archivo Excel o CSV (.xlsx / .csv)"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Subir Excel</span>
            </button>

            <button
              type="button"
              onClick={() => descargarPlantillaCSV('clientes')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200"
              title="Descargar planilla Excel de ejemplo para rellenar"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Plantilla Ejemplo</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmarVaciar(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-rose-200"
              title="Dejar en blanco toda la cartera para pruebas desde cero"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Vaciar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                restaurarDemo();
                setToastMensaje('¡Cartera demo restaurada con 6 clientes modelo!');
                setTimeout(() => setToastMensaje(null), 4000);
              }}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-amber-200"
              title="Restaurar la cartera de prueba con clientes modelo"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Demo</span>
            </button>

            <button
              onClick={refetch}
              disabled={loading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center"
              title="Actualizar datos"
            >
              <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        </div>
      </section>

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

      {/* Error Notificación */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 shadow-sm">
          <span className="material-symbols-outlined text-rose-600 text-[24px]">error</span>
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────── */}
      {/* TABLA PRINCIPAL */}
      {/* ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4">N° OP</th>
                <th className="py-3 px-4">Cliente / DNI</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Cuota</th>
                <th className="py-3 px-4">Avance</th>
                <th className="py-3 px-4">Próx. Vto.</th>
                <th className="py-3 px-4">Estado Mora</th>
                <th className="py-3 px-4 text-right">Adeudado</th>
                <th className="py-3 px-4">Cobrador</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading && operaciones.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[32px] animate-spin mb-2 block">progress_activity</span>
                    Cargando cartera...
                  </td>
                </tr>
              ) : operaciones.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <span className="material-symbols-outlined text-[42px] text-slate-300 block">search_off</span>
                      <p className="font-bold text-sm text-slate-600">No hay operaciones en la cartera</p>
                      <p className="text-xs text-slate-400">
                        La cartera se encuentra vacía o no coincide con los filtros aplicados. Puedes cargar clientes con Excel o restaurar el padrón demo.
                      </p>
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            restaurarDemo();
                            setToastMensaje('¡Cartera demo cargada con éxito!');
                            setTimeout(() => setToastMensaje(null), 4000);
                          }}
                          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition border border-amber-200"
                        >
                          Cargar Cartera Demo
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalImportarExcel(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                        >
                          Subir Archivo Excel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                operaciones.map(op => (
                  <tr key={op.nro_op} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">#{op.nro_op}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{op.cliente.nombre}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{op.cliente.dni || '—'}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">{op.domicilio_cobro || op.cliente.domicilio}</div>
                    </td>
                    <td className="py-3 px-4">{tipoBadge(op.tipo)}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{fmtMoney(op.importe_cuota)}</td>
                    <td className="py-3 px-4">
                      {(() => {
                        const totales = op.cuotas_totales > 0 ? op.cuotas_totales : Math.max(1, Math.round((op.monto_total || op.importe_cuota * 20) / op.importe_cuota));
                        const pagadas = Math.min(totales, Math.max(0, op.cuotas_pagadas || 0));
                        const pct = Math.round((pagadas / totales) * 100);
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden w-16 border border-slate-200/50">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                              {pagadas}/{totales}
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({pct}%)
                              </span>
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{fmtDate(op.proximo_vencimiento)}</td>
                    <td className="py-3 px-4">{moraBadge(op.mora.nivel)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {fmtMoney(op.saldo_restante)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700 font-medium">{op.cobrador.nombre}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 text-slate-400">
                        <button
                          onClick={() => setModalDetalle(op)}
                          className="p-1 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                          title="Ver detalle de operación"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => { setModalCobro(op); setMontoCobroInput(String(op.importe_cuota)); }}
                          className="p-1 hover:text-emerald-600 rounded hover:bg-slate-100 transition"
                          title="Registrar cobro"
                        >
                          <span className="material-symbols-outlined text-[18px]">payments</span>
                        </button>
                        <button
                          onClick={() => setModalVisita(op)}
                          className="p-1 hover:text-amber-600 rounded hover:bg-slate-100 transition"
                          title="Visita infructuosa"
                        >
                          <span className="material-symbols-outlined text-[18px]">person_off</span>
                        </button>
                        <button
                          onClick={() => handleVerHistorial(op)}
                          className="p-1 hover:text-indigo-600 rounded hover:bg-slate-100 transition"
                          title="Historial de pagos"
                        >
                          <span className="material-symbols-outlined text-[18px]">history</span>
                        </button>
                        <button
                          onClick={() => setModalRecibo(op)}
                          className="p-1 hover:text-blue-600 rounded hover:bg-slate-100 transition"
                          title="Generar recibo de saldo"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt</span>
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Seguro que deseas eliminar la operación #${op.nro_op} de ${op.cliente.nombre}?`)) {
                              eliminarOperacion(op.nro_op);
                              setToastMensaje(`Operación #${op.nro_op} eliminada.`);
                              setTimeout(() => setToastMensaje(null), 3000);
                            }
                          }}
                          className="p-1 hover:text-rose-600 rounded hover:bg-rose-50 transition"
                          title="Eliminar operación"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer con conteo */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando {operaciones.length} de {todasLasOperaciones.length} operaciones activas</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sincronización en vivo activa
          </span>
        </div>
      </section>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: NUEVA OPERACIÓN */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={modalNuevaOp}
        onClose={() => setModalNuevaOp(false)}
        title="Crear Nueva Operación de Crédito"
      >
        <form onSubmit={handleCrearNuevaOperacion} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nombre y Apellido *</label>
              <input
                type="text"
                required
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Ej. Juan Carlos Pérez"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">DNI / Documento</label>
              <input
                type="text"
                value={nuevoDni}
                onChange={e => setNuevoDni(e.target.value)}
                placeholder="Ej. 30123456"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Teléfono</label>
              <input
                type="text"
                value={nuevoTelefono}
                onChange={e => setNuevoTelefono(e.target.value)}
                placeholder="Ej. +54 9 381 555-1234"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Domicilio de Cobro</label>
              <input
                type="text"
                value={nuevoDomicilio}
                onChange={e => setNuevoDomicilio(e.target.value)}
                placeholder="Ej. Av. Belgrano 1420 - Centro"
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tipo de Operación</label>
              <select
                value={nuevoTipo}
                onChange={e => {
                  const t = e.target.value as TipoOperacion;
                  setNuevoTipo(t);
                  const m = parseFloat(nuevoMonto) || 100000;
                  if (t === 'EFECTIVO') {
                    setNuevasCuotas('26');
                    const c = calcularCuotaEfectivo(m, 26);
                    setNuevoValorCuota(String(c.cuotaDiaria));
                  } else {
                    setNuevasCuotas('84');
                    const c = calcularCuotaProducto(m, 84);
                    setNuevoValorCuota(String(c.cuotaDiaria));
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              >
                <option value="EFECTIVO">Efectivo / Préstamo Dinerario</option>
                <option value="PRODUCTO">Venta Financiada de Producto</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cobrador Asignado</label>
              <select
                value={nuevoCobradorId}
                onChange={e => setNuevoCobradorId(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-900 focus:outline-none"
              >
                {cobradores.map(c => (
                  <option key={c.id_cobrador} value={c.id_cobrador}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {nuevoTipo === 'EFECTIVO' ? 'Capital a Desembolsar ($)' : 'Precio de Contado / Costo Base ($)'}
              </label>
              <input
                type="number"
                value={nuevoMonto}
                onChange={e => {
                  setNuevoMonto(e.target.value);
                  const m = parseFloat(e.target.value) || 0;
                  const c = parseInt(nuevasCuotas, 10) || (nuevoTipo === 'EFECTIVO' ? 26 : 84);
                  if (nuevoTipo === 'EFECTIVO') {
                    const res = calcularCuotaEfectivo(m, c);
                    setNuevoValorCuota(String(res.cuotaDiaria));
                  } else {
                    const res = calcularCuotaProducto(m, c);
                    setNuevoValorCuota(String(res.cuotaDiaria));
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Planes Oficiales Rápidos */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-slate-600">
                Planes Oficiales (Fórmulas Lista de Precios):
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {nuevoTipo === 'EFECTIVO' ? '26d (+30%) | 35d (+40%)' : '42d (+53%) | 84d (+63%) | 135d (+73%) | 175d (+83%) | 220d (+93%)'}
              </span>
            </div>

            {nuevoTipo === 'EFECTIVO' ? (
              <div className="grid grid-cols-2 gap-2">
                {PLANES_EFECTIVO_OFICIALES.map((plan) => {
                  const m = parseFloat(nuevoMonto) || 0;
                  const res = calcularCuotaEfectivo(m, plan.dias);
                  const isSelected = parseInt(nuevasCuotas, 10) === plan.dias;
                  return (
                    <button
                      key={plan.dias}
                      type="button"
                      onClick={() => {
                        setNuevasCuotas(String(plan.dias));
                        setNuevoValorCuota(String(res.cuotaDiaria));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-slate-800">Plan {plan.dias} Días</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          +{plan.tasaInteres}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-mono font-black text-sm text-slate-900">
                          ${(res.cuotaDiaria || 0).toLocaleString('es-AR')}<span className="text-[10px] font-normal text-slate-400">/d</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Tot: ${(res.total || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {PLANES_PRODUCTO_OFICIALES.map((plan) => {
                  const m = parseFloat(nuevoMonto) || 0;
                  const res = calcularCuotaProducto(m, plan.cuotas);
                  const isSelected = parseInt(nuevasCuotas, 10) === plan.cuotas;
                  return (
                    <button
                      key={plan.cuotas}
                      type="button"
                      onClick={() => {
                        setNuevasCuotas(String(plan.cuotas));
                        setNuevoValorCuota(String(res.cuotaDiaria));
                      }}
                      className={`p-2 rounded-xl border text-left transition ${
                        isSelected
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[11px] text-slate-800">{plan.cuotas}c</span>
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded">
                          {plan.recargoPorcentaje}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-none mt-0.5">{plan.semanas} sem</div>
                      <div className="mt-1">
                        <div className="font-mono font-black text-xs text-slate-900 leading-tight">
                          ${(res.cuotaDiaria || 0).toLocaleString('es-AR')}<span className="text-[9px] font-normal text-slate-400">/d</span>
                        </div>
                        <div className="text-[10px] font-mono text-blue-600 font-bold">
                          ${(res.cuotaSemanal || 0).toLocaleString('es-AR')}/sem
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Cantidad de Cuotas</label>
              <input
                type="number"
                value={nuevasCuotas}
                onChange={e => {
                  setNuevasCuotas(e.target.value);
                  const m = parseFloat(nuevoMonto) || 0;
                  const c = parseInt(e.target.value, 10) || 1;
                  if (nuevoTipo === 'EFECTIVO') {
                    const res = calcularCuotaEfectivo(m, c);
                    setNuevoValorCuota(String(res.cuotaDiaria));
                  } else {
                    const res = calcularCuotaProducto(m, c);
                    setNuevoValorCuota(String(res.cuotaDiaria));
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Valor Cuota Diaria ($)</label>
              <input
                type="number"
                value={nuevoValorCuota}
                onChange={e => setNuevoValorCuota(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalNuevaOp(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>Dar de Alta</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: DETALLE DEL CLIENTE */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={!!modalDetalle}
        onClose={() => setModalDetalle(null)}
        title={`Detalle — OP #${modalDetalle?.nro_op}`}
      >
        {modalDetalle && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Cliente</span>
                <p className="font-bold text-slate-900">{modalDetalle.cliente.nombre}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">DNI</span>
                <p className="font-mono text-slate-800">{modalDetalle.cliente.dni || '—'}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Domicilio</span>
                <p className="text-slate-800">{modalDetalle.domicilio_cobro || modalDetalle.cliente.domicilio}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Teléfono</span>
                <p className="text-slate-800">{modalDetalle.cliente.telefono || '—'}</p>
              </div>
            </div>
            <hr className="border-slate-100" />
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Tipo</span>
                <p>{tipoBadge(modalDetalle.tipo)}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Capital</span>
                <p className="font-mono font-bold">{fmtMoney(modalDetalle.monto_capital)}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Total a Devolver</span>
                <p className="font-mono font-bold">{fmtMoney(modalDetalle.monto_total)}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Cuota</span>
                <p className="font-mono font-bold">{fmtMoney(modalDetalle.importe_cuota)}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Saldo Restante</span>
                <p className="font-mono font-bold text-rose-700">{fmtMoney(modalDetalle.saldo_restante)}</p>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase text-slate-400">Cobrador</span>
                <p className="font-bold">{modalDetalle.cobrador.nombre}</p>
              </div>
            </div>
            <hr className="border-slate-100" />
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-900">Estado de Mora</span>
                {moraBadge(modalDetalle.mora.nivel)}
              </div>
              <p className="text-xs text-slate-600">{modalDetalle.mora.mensaje}</p>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Cuotas Vencidas</span>
                  <p className="font-mono font-bold text-slate-900">{modalDetalle.mora.cuotas_vencidas_impagas}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Deuda Vencida</span>
                  <p className="font-mono font-bold text-rose-700">{fmtMoney(modalDetalle.mora.deuda_vencida_total)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Avance</span>
                  <p className="font-mono font-bold text-slate-900">
                    {modalDetalle.cuotas_pagadas}/{modalDetalle.cuotas_totales}
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      ({modalDetalle.cuotas_totales > 0 ? Math.round((modalDetalle.cuotas_pagadas / modalDetalle.cuotas_totales) * 100) : 0}%)
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: HISTORIAL DE PAGOS & VISITAS */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={!!modalHistorial}
        onClose={() => setModalHistorial(null)}
        title={`Historial de Pagos & Visitas — OP #${modalHistorial?.nro_op}`}
        maxWidth="max-w-5xl"
      >
        {historialLoading ? (
          <div className="text-center py-12 text-slate-400">
            <span className="material-symbols-outlined text-[36px] animate-spin block mb-2 text-emerald-600">progress_activity</span>
            Cargando historial detallado...
          </div>
        ) : historialData.length === 0 ? (
          <div className="text-center py-12 text-slate-400 space-y-2">
            <span className="material-symbols-outlined text-[36px] block text-slate-300">receipt_long</span>
            <p className="font-bold text-slate-700 text-sm">Sin registros de cobros o visitas aún</p>
            <p className="text-xs text-slate-400">Al registrar cobros o visitas en la vista se imputarán y listarán aquí automáticamente con su comprobante.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Barra de Resumen de la Operación */}
            {modalHistorial && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Titular:</span>
                  <span className="font-bold text-slate-900 font-sans truncate block">{modalHistorial.cliente.nombre}</span>
                  <span className="text-[11px] text-slate-500 font-sans">DNI: {modalHistorial.cliente.dni || '—'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Cobrador Asignado:</span>
                  <span className="font-bold text-slate-800 font-sans block">{modalHistorial.cobrador.nombre}</span>
                  <span className="text-[11px] text-emerald-600 font-sans">Circuito Activo</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Total Financiado:</span>
                  <span className="font-bold text-slate-900 block">{fmtMoney(modalHistorial.monto_total)}</span>
                  <span className="text-[11px] text-slate-500 font-sans">{modalHistorial.cuotas_pagadas} de {modalHistorial.cuotas_totales} cuotas</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Saldo Restante:</span>
                  <span className="font-bold text-rose-600 block">{fmtMoney(modalHistorial.saldo_restante)}</span>
                  <span className="text-[11px] text-slate-500 font-sans">{fmtMoney(modalHistorial.importe_cuota)} / día</span>
                </div>
              </div>
            )}

            {/* Tabla con scroll horizontal y vertical cómodo */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm max-h-[50vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 text-left font-bold uppercase tracking-wider">Fecha / Hora</th>
                    <th className="py-3 px-4 text-right font-bold uppercase tracking-wider">Monto Cobrado</th>
                    <th className="py-3 px-4 text-center font-bold uppercase tracking-wider">Cuotas Eq.</th>
                    <th className="py-3 px-4 text-left font-bold uppercase tracking-wider">Cobrador</th>
                    <th className="py-3 px-4 text-left font-bold uppercase tracking-wider min-w-[240px]">Detalle y Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {historialData.map((cobro: any, i: number) => {
                    const esCobro = Number(cobro.monto_cobrado) > 0;
                    return (
                      <tr key={cobro.id_cobro || i} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                          <div className="font-bold">{new Date(cobro.fecha_hora).toLocaleDateString('es-AR')}</div>
                          <div className="text-[11px] text-slate-400">{new Date(cobro.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                          {esCobro ? (
                            <span className="text-emerald-700 font-black text-sm">
                              {fmtMoney(Number(cobro.monto_cobrado || 0))}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">$0 (Sin pago)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-600 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold">
                            {Number(cobro.cuotas_equivalentes || 0).toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px] text-slate-400">person</span>
                            {cobro.cobradores?.nombre || modalHistorial?.cobrador?.nombre || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {esCobro ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Cobro Imputado a Cuotas
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Visita: {cobro.motivo_no_pago || 'No Pagó'}
                              </span>
                            )}
                            <div className="text-[11px] text-slate-600 leading-relaxed break-words font-sans">
                              {cobro.observacion || (esCobro ? 'Imputación de cobranza automática.' : 'Visita infructuosa registrada por el cobrador.')}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer de totales */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">
                Total de registros: <strong>{historialData.length} eventos</strong>
              </span>
              <span className="font-mono text-slate-900 font-bold">
                Total Recaudado Registrado:{' '}
                <span className="text-emerald-700 text-sm font-black">
                  {fmtMoney(historialData.reduce((acc, h) => acc + (Number(h.monto_cobrado) || 0), 0))}
                </span>
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: REGISTRAR COBRO */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={!!modalCobro}
        onClose={() => setModalCobro(null)}
        title={`Registrar Cobro — OP #${modalCobro?.nro_op}`}
      >
        {modalCobro && (
          <div className="space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Cliente</span>
                  <p className="font-bold text-slate-900">{modalCobro.cliente.nombre}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Cuota</span>
                  <p className="font-mono font-bold">{fmtMoney(modalCobro.importe_cuota)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Saldo Restante</span>
                  <p className="font-mono font-bold text-rose-700">{fmtMoney(modalCobro.saldo_restante)}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold">Cobrador</span>
                  <p className="font-bold">{modalCobro.cobrador.nombre}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Monto a cobrar ($)</label>
              <input
                type="number"
                value={montoCobroInput}
                onChange={e => setMontoCobroInput(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white px-4 py-3 rounded-xl text-lg font-mono font-bold text-slate-900 focus:outline-none transition"
                placeholder="0"
                min={1}
                step={100}
              />
              <div className="flex gap-2 mt-2">
                {[0.5, 1, 2].map(mult => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => setMontoCobroInput(String(Math.round(modalCobro.importe_cuota * mult)))}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition"
                  >
                    {mult === 0.5 ? '½ cuota' : `${mult} cuota${mult > 1 ? 's' : ''}`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleRegistrarCobro}
              disabled={cobroProcessing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              {cobroProcessing ? 'Imputando pago...' : 'Confirmar Cobro'}
            </button>
          </div>
        )}
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: VISITA INFRUCTUOSA */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={!!modalVisita}
        onClose={() => setModalVisita(null)}
        title={`Visita Infructuosa — OP #${modalVisita?.nro_op}`}
      >
        {modalVisita && (
          <div className="space-y-5">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="font-bold text-slate-900">{modalVisita.cliente.nombre}</p>
              <p className="text-xs text-slate-500">{modalVisita.domicilio_cobro || modalVisita.cliente.domicilio}</p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Motivo</label>
              <select
                value={motivoVisita}
                onChange={e => setMotivoVisita(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none transition"
              >
                <option value="CERRADO">Cerrado / Sin atender</option>
                <option value="AUSENTE">Ausente</option>
                <option value="NO_TENIA_DINERO">No tenía dinero</option>
                <option value="PASAR_MAS_TARDE">Pidió pasar más tarde</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Observación (opcional)</label>
              <textarea
                value={obsVisita}
                onChange={e => setObsVisita(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl p-3 text-xs text-slate-800 focus:outline-none transition resize-none"
                placeholder="Detalles adicionales de la visita..."
              />
            </div>

            <button
              onClick={handleRegistrarVisita}
              disabled={visitaProcessing}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">person_off</span>
              {visitaProcessing ? 'Registrando...' : 'Registrar Visita Infructuosa'}
            </button>
          </div>
        )}
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: RECIBO DE OPERACIÓN */}
      {/* ───────────────────────────────────────────────── */}
      <Modal
        open={!!modalRecibo}
        onClose={() => setModalRecibo(null)}
        title={`Recibo de Estado de Cuenta — OP #${modalRecibo?.nro_op}`}
      >
        {modalRecibo && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono space-y-2">
              <div className="text-center pb-2 border-b border-slate-200">
                <p className="font-bold text-sm text-slate-900">CREDIT-ON — ESTADO DE CUENTA</p>
                <p className="text-[10px] text-slate-400">Emisión: {new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR')}</p>
              </div>
              <div className="space-y-1 text-slate-700">
                <p><strong>Operación:</strong> #{modalRecibo.nro_op} ({modalRecibo.tipo})</p>
                <p><strong>Cliente:</strong> {modalRecibo.cliente.nombre}</p>
                <p><strong>DNI:</strong> {modalRecibo.cliente.dni || '—'}</p>
                <p><strong>Cobrador Asignado:</strong> {modalRecibo.cobrador.nombre}</p>
                <p><strong>Monto Total Financiado:</strong> {fmtMoney(modalRecibo.monto_total)}</p>
                <p><strong>Cuotas:</strong> {modalRecibo.cuotas_pagadas} de {modalRecibo.cuotas_totales} abonadas</p>
                <p><strong>Valor Cuota:</strong> {fmtMoney(modalRecibo.importe_cuota)}</p>
                <p><strong>Saldo Restante:</strong> <span className="font-bold text-rose-700">{fmtMoney(modalRecibo.saldo_restante)}</span></p>
                <p><strong>Estado:</strong> {modalRecibo.mora.nivel}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Imprimir Recibo</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: IMPORTAR CARTERA DESDE EXCEL / CSV */}
      {/* ───────────────────────────────────────────────── */}
      {modalImportarExcel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Importar Clientes &amp; Operaciones</h4>
                  <p className="text-[11px] text-slate-500">Carga masiva por archivo Excel (.xlsx / .xls) o CSV (.csv)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalImportarExcel(false);
                  setArchivoError(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-indigo-600 text-[18px]">info</span>
                  Columnas de la Hoja de Cálculo
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  El archivo debe contener las siguientes columnas (puedes descargarlo con ejemplos):
                </p>
                <div className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-700 overflow-x-auto">
                  Nombre ; DNI ; Telefono ; Direccion ; Monto Financiado ; Cantidad Cuotas ; Valor Cuota ; Tipo ; Cobrador
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 text-xs block">¿No tienes el archivo listo?</span>
                  <span className="text-[11px] text-slate-500">Descarga la plantilla con ejemplos reales.</span>
                </div>
                <button
                  type="button"
                  onClick={() => descargarPlantillaCSV('clientes')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">download</span>
                  <span>Descargar Plantilla</span>
                </button>
              </div>

              {/* Zona de Selección de Archivo */}
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
                <input
                  ref={inputExcelRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={handleArchivoExcelSeleccionado}
                  className="hidden"
                  id="input-archivo-clientes"
                />
                <label
                  htmlFor="input-archivo-clientes"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <span className="material-symbols-outlined text-4xl text-emerald-600">cloud_upload</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {archivoCargando ? 'Procesando archivo...' : 'Haz clic aquí para seleccionar tu archivo Excel o CSV'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Soporta archivos Excel nativos (.xlsx / .xls) y hojas CSV delimitadas por punto y coma (;)
                  </span>
                </label>
              </div>

              {archivoError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{archivoError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setModalImportarExcel(false);
                  setArchivoError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────── */}
      {/* MODAL: CONFIRMAR VACIAR CARTERA */}
      {/* ───────────────────────────────────────────────── */}
      {confirmarVaciar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-slate-900 text-base">¿Vaciar cartera de clientes?</h4>
              <p className="text-xs text-slate-500">
                Se dejarán en blanco todas las operaciones de la cartera para iniciar pruebas desde cero. Podrás restaurar los datos de ejemplo con el botón Demo en cualquier momento.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmarVaciar(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  vaciarCartera();
                  setConfirmarVaciar(false);
                  setToastMensaje('Cartera vaciada. Listo para pruebas en blanco.');
                  setTimeout(() => setToastMensaje(null), 3000);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-sm"
              >
                Confirmar Vaciar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
