/**
 * Cobradores — Rendimiento y Gestión de Cobradores
 * ==================================================
 * Vista dedicada al monitoreo de efectividad de cobro por cobrador.
 * Lee de las tablas cobradores, vw_rendimiento_cobrador y cobros.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { descargarPlantillaCSV, parsearCSV, obtenerValor, obtenerNumero } from '../utils/csv-helper';
import { aplicarSimulacionOperacionalCompleta } from '../utils/simulacion-kpi-helper';
import { COBRADORES_CANONICOS } from '../utils/cobradores-catalogo';

/* ─── Tipos locales ─── */

interface CobradorCompleto {
  id_cobrador: number;
  nombre: string;
  telefono: string | null;
  porcentaje_comision: number;
  activo: boolean;
  id_supervisor: number | null;
}

interface RendimientoDia {
  cobrador: string;
  fecha: string;
  total_exigible: number;
  total_cobrado: number;
  clientes_a_cobrar: number;
  clientes_cobrados: number;
  porcentaje_efectividad: number;
  diferencia: number;
}

interface CobroReciente {
  id_cobro: number;
  nro_op: number;
  fecha_hora: string;
  monto_cobrado: number;
  cuotas_equivalentes: number;
  motivo_no_pago: string | null;
}

/* ─── Helpers ─── */

const fmtMoney = (n: number) =>
  `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const efectividadBadge = (pct: number) => {
  if (pct >= 90) return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Óptimo' };
  if (pct >= 80) return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Atención' };
  return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Bajo' };
};

const STORAGE_COBRADORES = 'credit_on_cobradores';

const COBRADORES_DEMO: CobradorCompleto[] = COBRADORES_CANONICOS.map((c) => ({
  id_cobrador: c.id_cobrador,
  nombre: c.nombre,
  telefono: c.telefono,
  porcentaje_comision: c.porcentaje_comision,
  activo: c.activo,
  id_supervisor: null,
}));

/* ─── Componente principal ─── */

export const Cobradores: React.FC = () => {
  const [cobradores, setCobradores] = useState<CobradorCompleto[]>([]);
  const [rendimientos, setRendimientos] = useState<RendimientoDia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historial, setHistorial] = useState<Record<number, CobroReciente[]>>({});
  const [historialLoading, setHistorialLoading] = useState<number | null>(null);

  // Estados para CRUD
  const [modalNuevoCobrador, setModalNuevoCobrador] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevaComision, setNuevaComision] = useState('8');

  const [modalEditarCobrador, setModalEditarCobrador] = useState<CobradorCompleto | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editComision, setEditComision] = useState('');
  const [editActivo, setEditActivo] = useState(true);

  // Estado para Excel / CSV
  const [modalImportarExcel, setModalImportarExcel] = useState(false);
  const [archivoCargando, setArchivoCargando] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const inputExcelRef = useRef<HTMLInputElement | null>(null);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  const hoy = new Date().toISOString().split('T')[0];

  const guardarCobradores = (nuevos: CobradorCompleto[]) => {
    setCobradores(nuevos);
    try {
      localStorage.setItem(STORAGE_COBRADORES, JSON.stringify(nuevos));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch {}
  };

  /* ─── Carga de datos ─── */

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Cobradores
      let cobradoresCargados: CobradorCompleto[] = [];
      const saved = localStorage.getItem(STORAGE_COBRADORES);
      if (saved !== null) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cobradoresCargados = parsed;
          }
        } catch {}
      }

      if (cobradoresCargados.length === 0 && supabase) {
        try {
          const { data: cobrs, error: e1 } = await supabase
            .from('cobradores')
            .select('id_cobrador, nombre, telefono, porcentaje_comision, activo, id_supervisor')
            .eq('activo', true)
            .order('nombre');
          if (!e1 && cobrs && cobrs.length > 0) {
            cobradoresCargados = cobrs;
          }
        } catch {}
      }

      if (cobradoresCargados.length === 0) {
        cobradoresCargados = COBRADORES_DEMO;
      }
      setCobradores(cobradoresCargados);

      // 2. Rendimiento del día
      let rendObtenidos: RendimientoDia[] = [];
      if (supabase) {
        try {
          const { data: rend } = await supabase
            .from('vw_rendimiento_cobrador')
            .select('*')
            .eq('fecha', hoy);
          if (rend && rend.length > 0) {
            rendObtenidos = rend.map((r: any) => ({
              cobrador: r.cobrador,
              fecha: r.fecha,
              total_exigible: Number(r.total_exigible),
              total_cobrado: Number(r.total_cobrado),
              clientes_a_cobrar: Number(r.clientes_a_cobrar),
              clientes_cobrados: Number(r.clientes_cobrados),
              porcentaje_efectividad: Number(r.porcentaje_efectividad),
              diferencia: Number(r.diferencia),
            }));
          }
        } catch {}
      }

      // Si Supabase no trajo rendimientos de hoy (o modo local/offline), calculamos dinámicamente desde cartera y cobros locales
      if (rendObtenidos.length === 0) {
        try {
          const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
          const rawHist = localStorage.getItem('credit_on_historial_cobros');
          const ops: any[] = rawOps ? JSON.parse(rawOps) : [];
          const hist: any[] = rawHist ? JSON.parse(rawHist) : [];
          const cobrosHoy = hist.filter((h: any) => h.fecha_hora && h.fecha_hora.startsWith(hoy));

          rendObtenidos = cobradoresCargados.map((c) => {
            const opsCobrador = ops.filter((o: any) => {
              if (!o.cobrador) return false;
              if (o.cobrador.id_cobrador === c.id_cobrador) return true;
              if (o.cobrador.nombre && o.cobrador.nombre.toLowerCase() === c.nombre.toLowerCase()) return true;
              if (c.nombre.toLowerCase().includes(o.cobrador.nombre?.toLowerCase() || '')) return true;
              return false;
            });

            const cobrosCobrador = cobrosHoy.filter((h: any) => {
              if (h.id_cobrador === c.id_cobrador) return true;
              if (h.cobradores?.nombre && h.cobradores.nombre.toLowerCase() === c.nombre.toLowerCase()) return true;
              if (c.nombre.toLowerCase().includes(h.cobradores?.nombre?.toLowerCase() || '')) return true;
              return false;
            });

            const totalExigible = opsCobrador.reduce((sum, o) => sum + (Number(o.importe_cuota) || 0), 0);
            const totalCobrado = cobrosCobrador.reduce((sum, h) => sum + (Number(h.monto_cobrado) || 0), 0);
            const clientesACobrar = opsCobrador.length;
            const clientesCobrados = cobrosCobrador.filter((h: any) => Number(h.monto_cobrado) > 0).length;
            const pct = totalExigible > 0 ? (totalCobrado / totalExigible) * 100 : 0;
            const diferencia = totalExigible - totalCobrado;

            return {
              cobrador: c.nombre,
              fecha: hoy,
              total_exigible: totalExigible,
              total_cobrado: totalCobrado,
              clientes_a_cobrar: clientesACobrar,
              clientes_cobrados: clientesCobrados,
              porcentaje_efectividad: Math.round(pct * 10) / 10,
              diferencia: diferencia,
            };
          });
        } catch {}
      }

      // Si el total exigible es 0 o no hay cobros registrados, cargamos automáticamente la simulación completa
      if (rendObtenidos.length === 0 || rendObtenidos.every((r) => r.total_exigible === 0)) {
        try {
          const rawHist = localStorage.getItem('credit_on_historial_cobros');
          const hist = rawHist ? JSON.parse(rawHist) : [];
          if (!Array.isArray(hist) || hist.length === 0) {
            await aplicarSimulacionOperacionalCompleta();
            return;
          }
        } catch {}
      }

      setRendimientos(rendObtenidos);
    } catch (e: any) {
      setError(e.message || 'Error al cargar datos de cobradores');
      setCobradores(COBRADORES_DEMO);
    } finally {
      setLoading(false);
    }
  }, [hoy]);

  const handleCrearCobrador = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    const nuevo: CobradorCompleto = {
      id_cobrador: Date.now(),
      nombre: nuevoNombre.trim(),
      telefono: nuevoTelefono.trim() || null,
      porcentaje_comision: parseFloat(nuevaComision) || 8,
      activo: true,
      id_supervisor: null,
    };

    const actualizados = [nuevo, ...cobradores];
    guardarCobradores(actualizados);
    setModalNuevoCobrador(false);
    setNuevoNombre('');
    setNuevoTelefono('');
    setNuevaComision('8');
    setToastMensaje(`Cobrador "${nuevo.nombre}" agregado con éxito.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const abrirEditarCobrador = (c: CobradorCompleto) => {
    setModalEditarCobrador(c);
    setEditNombre(c.nombre);
    setEditTelefono(c.telefono || '');
    setEditComision(c.porcentaje_comision.toString());
    setEditActivo(c.activo);
  };

  const handleGuardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEditarCobrador) return;

    const actualizados = cobradores.map(c => {
      if (c.id_cobrador === modalEditarCobrador.id_cobrador) {
        return {
          ...c,
          nombre: editNombre.trim() || c.nombre,
          telefono: editTelefono.trim() || null,
          porcentaje_comision: parseFloat(editComision) || c.porcentaje_comision,
          activo: editActivo,
        };
      }
      return c;
    });

    guardarCobradores(actualizados);
    setModalEditarCobrador(null);
    setToastMensaje(`Cobrador actualizado correctamente.`);
    setTimeout(() => setToastMensaje(null), 4000);
  };

  const handleEliminarCobrador = (id: number) => {
    if (confirm('¿Estás seguro de eliminar este cobrador?')) {
      const actualizados = cobradores.filter(c => c.id_cobrador !== id);
      guardarCobradores(actualizados);
      setToastMensaje('Cobrador eliminado.');
      setTimeout(() => setToastMensaje(null), 4000);
    }
  };

  const handleVaciarCobradores = () => {
    if (confirm('¿Deseas vaciar la lista de cobradores para realizar pruebas desde cero en blanco?')) {
      guardarCobradores([]);
      setToastMensaje('Lista de cobradores vaciada por completo.');
      setTimeout(() => setToastMensaje(null), 4000);
    }
  };

  const handleRestaurarDemo = () => {
    guardarCobradores(COBRADORES_DEMO);
    setToastMensaje('Cobradores de prueba restaurados con éxito.');
    setTimeout(() => setToastMensaje(null), 4000);
  };

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

      const nuevos: CobradorCompleto[] = filas.map((fila, idx) => {
        const nombre =
          obtenerValor(fila, ['nombre', 'cobrador', 'operador', 'agente', 'persona']) ||
          Object.values(fila).find(v => typeof v === 'string' && v.trim().length > 1) ||
          `Cobrador ${idx + 1}`;
        const tel =
          obtenerValor(fila, ['telefono', 'celular', 'tel', 'contacto', 'movil']) || null;
        const comision =
          obtenerNumero(fila, ['porcentaje_comision', 'comision', 'porcentaje', 'pct']) || 8;

        return {
          id_cobrador: Date.now() + idx,
          nombre,
          telefono: tel,
          porcentaje_comision: comision,
          activo: true,
          id_supervisor: null,
        };
      });

      const combinados = [...nuevos, ...cobradores];
      guardarCobradores(combinados);
      setModalImportarExcel(false);
      setToastMensaje(`¡Se importaron ${nuevos.length} cobradores desde el archivo exitosamente!`);
      setTimeout(() => setToastMensaje(null), 5000);
    } catch (err: any) {
      setArchivoError(err?.message || 'Error al procesar el archivo CSV/Excel');
    } finally {
      setArchivoCargando(false);
      if (inputExcelRef.current) inputExcelRef.current.value = '';
    }
  };

  const handleCargarSimulacionOperacional = async () => {
    try {
      setLoading(true);
      const res = await aplicarSimulacionOperacionalCompleta();
      await cargarDatos();
      setToastMensaje(
        `⚡ ¡Simulación operacional cargada! ${res.totalCobradores} cobradores activos, ${res.totalOperaciones} créditos en cartera y ${fmtMoney(res.totalCobrado)} recaudados hoy.`
      );
      setTimeout(() => setToastMensaje(null), 6000);
    } catch (e: any) {
      setError(e.message || 'Error al cargar simulación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();

    const refrescar = () => {
      cargarDatos();
    };

    window.addEventListener('credit_on_storage_update', refrescar);
    window.addEventListener('storage', refrescar);
    window.addEventListener('focus', refrescar);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('cobradores-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cobros' }, () => {
          cargarDatos();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('credit_on_storage_update', refrescar);
      window.removeEventListener('storage', refrescar);
      window.removeEventListener('focus', refrescar);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [cargarDatos]);

  /* ─── Cargar historial reciente al expandir ─── */

  const toggleExpand = async (cobradorId: number) => {
    if (expandedId === cobradorId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cobradorId);

    const cobrador = cobradores.find(c => c.id_cobrador === cobradorId);
    const cobradorNombre = cobrador?.nombre?.toLowerCase() || '';

    // Buscar primero en historial local para respuesta instantánea
    let cobrosLocales: CobroReciente[] = [];
    try {
      const rawHist = localStorage.getItem('credit_on_historial_cobros');
      if (rawHist) {
        const hist: any[] = JSON.parse(rawHist);
        cobrosLocales = hist
          .filter((h: any) => {
            if (h.id_cobrador === cobradorId) return true;
            if (h.cobradores?.nombre && h.cobradores.nombre.toLowerCase().includes(cobradorNombre)) return true;
            if (cobradorNombre && cobradorNombre.includes(h.cobradores?.nombre?.toLowerCase() || '')) return true;
            return false;
          })
          .map((h: any) => ({
            id_cobro: h.id_cobro || Date.now(),
            nro_op: h.nro_op,
            fecha_hora: h.fecha_hora,
            monto_cobrado: Number(h.monto_cobrado) || 0,
            cuotas_equivalentes: Number(h.cuotas_equivalentes) || (Number(h.monto_cobrado) > 0 ? 1 : 0),
            motivo_no_pago: h.motivo_no_pago || null
          }));
      }
    } catch {}

    if (cobrosLocales.length > 0) {
      setHistorial(prev => ({ ...prev, [cobradorId]: cobrosLocales }));
      return;
    }

    if (!supabase) {
      setHistorial(prev => ({ ...prev, [cobradorId]: [] }));
      return;
    }

    setHistorialLoading(cobradorId);
    try {
      const { data } = await supabase
        .from('cobros')
        .select('id_cobro, nro_op, fecha_hora, monto_cobrado, cuotas_equivalentes, motivo_no_pago')
        .eq('id_cobrador', cobradorId)
        .order('fecha_hora', { ascending: false })
        .limit(20);
      setHistorial(prev => ({ ...prev, [cobradorId]: data ?? [] }));
    } catch {
      // silencioso
    } finally {
      setHistorialLoading(null);
    }
  };

  /* ─── Indicadores globales ─── */

  const indicadores = useMemo(() => {
    const totalExigible = rendimientos.reduce((s, r) => s + r.total_exigible, 0);
    const totalCobrado = rendimientos.reduce((s, r) => s + r.total_cobrado, 0);
    const pctGlobal = totalExigible > 0 ? (totalCobrado / totalExigible) * 100 : 0;
    return {
      totalCobradores: cobradores.length,
      enCalle: rendimientos.length,
      totalExigible,
      totalCobrado,
      pctGlobal: pctGlobal.toFixed(1),
    };
  }, [cobradores, rendimientos]);

  /* ─── Combinar cobrador + rendimiento ─── */

  const cobradoresConRendimiento = useMemo(() => {
    return cobradores.map(c => {
      const rend = rendimientos.find(r => r.cobrador === c.nombre);
      return { ...c, rendimiento: rend ?? null };
    });
  }, [cobradores, rendimientos]);

  return (
    <div className="space-y-6 pb-8">
      {/* ───────────────────────────────────────────────── */}
      {/* INDICADORES */}
      {/* ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Cobradores Activos', value: indicadores.totalCobradores, icon: 'badge', color: 'slate' },
          { label: 'En Calle Hoy', value: indicadores.enCalle, icon: 'directions_walk', color: 'emerald' },
          { label: 'Exigible Hoy', value: fmtMoney(indicadores.totalExigible), icon: 'request_quote', color: 'amber', mono: true },
          { label: 'Cobrado Hoy', value: fmtMoney(indicadores.totalCobrado), icon: 'payments', color: 'emerald', mono: true },
          { label: 'Efectividad Global', value: `${indicadores.pctGlobal}%`, icon: 'speed', color: Number(indicadores.pctGlobal) >= 90 ? 'emerald' : 'amber', mono: true },
        ].map(kpi => (
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

      {/* ───────────────────────────────────────────────── */}
      {/* ERROR */}
      {/* ───────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 shadow-sm">
          <span className="material-symbols-outlined text-rose-600 text-[24px]">error</span>
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* ───────────────────────────────────────────────── */}
      {/* TABLA DE COBRADORES */}
      {/* ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">badge</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Rendimiento por Cobrador</h3>
              <p className="text-xs text-slate-500">Efectividad de cobro del día — Fecha: {hoy}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCargarSimulacionOperacional}
              className="px-3.5 py-2 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
              title="Cargar simulación de operaciones y cobranzas para ver KPIs en acción"
            >
              <span className="material-symbols-outlined text-[17px]">bolt</span>
              <span>⚡ Simular Rendimiento Hoy</span>
            </button>

            <button
              type="button"
              onClick={() => setModalNuevoCobrador(true)}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Registrar un nuevo cobrador individual"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>+ Nuevo Cobrador</span>
            </button>

            <button
              type="button"
              onClick={() => setModalImportarExcel(true)}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Cargar varios cobradores desde un archivo Excel/CSV"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              <span>Subir Excel</span>
            </button>

            <button
              type="button"
              onClick={() => descargarPlantillaCSV('cobradores')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200"
              title="Descargar plantilla de ejemplo de Excel/CSV para rellenar"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Plantilla Ejemplo</span>
            </button>

            <button
              type="button"
              onClick={handleVaciarCobradores}
              className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-rose-200"
              title="Dejar en blanco la lista de cobradores para pruebas"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              <span>Vaciar</span>
            </button>

            <button
              type="button"
              onClick={handleRestaurarDemo}
              className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center gap-1"
              title="Restaurar cobradores de prueba"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Demo</span>
            </button>

            <button
              onClick={cargarDatos}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold tracking-wider border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">Cobrador</th>
                <th className="py-3 px-4">Comisión</th>
                <th className="py-3 px-4 text-right">Exigible Hoy</th>
                <th className="py-3 px-4 text-right">Cobrado Hoy</th>
                <th className="py-3 px-4 text-right">Clientes</th>
                <th className="py-3 px-4">Efectividad</th>
                <th className="py-3 px-4 text-right">Diferencia</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading && cobradoresConRendimiento.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[32px] animate-spin mb-2 block">progress_activity</span>
                    Cargando cobradores...
                  </td>
                </tr>
              ) : cobradoresConRendimiento.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <span className="material-symbols-outlined text-4xl text-slate-300">badge</span>
                      <p className="font-semibold text-sm text-slate-700">No hay cobradores registrados</p>
                      <p className="text-xs text-slate-400 max-w-md">
                        La lista está en blanco. Puedes dar de alta un cobrador, importar una plantilla de Excel o restaurar el equipo demo de prueba.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => setModalNuevoCobrador(true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">person_add</span>
                          <span>+ Nuevo Cobrador</span>
                        </button>
                        <button
                          onClick={() => setModalImportarExcel(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">upload_file</span>
                          <span>Subir Excel</span>
                        </button>
                        <button
                          onClick={handleRestaurarDemo}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                          <span>Restaurar Demo</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                cobradoresConRendimiento.map(c => {
                  const rend = c.rendimiento;
                  const pct = rend?.porcentaje_efectividad ?? 0;
                  const badge = efectividadBadge(pct);
                  const isExpanded = expandedId === c.id_cobrador;

                  return (
                    <React.Fragment key={c.id_cobrador}>
                      <tr
                        className="hover:bg-slate-50/70 transition cursor-pointer"
                        onClick={() => toggleExpand(c.id_cobrador)}
                      >
                        <td className="py-3 px-4">
                          <span className={`material-symbols-outlined text-[16px] text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            chevron_right
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                              {c.nombre.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{c.nombre}</div>
                              {c.telefono && (
                                <div className="text-[11px] text-slate-400">{c.telefono}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{c.porcentaje_comision}%</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {rend ? fmtMoney(rend.total_exigible) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {rend ? fmtMoney(rend.total_cobrado) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {rend ? (
                            <span className="font-mono">{rend.clientes_cobrados}/{rend.clientes_a_cobrar}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {rend ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                                <div
                                  className={`h-full rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-slate-900">{pct.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Sin actividad</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {rend ? (
                            <span className={rend.diferencia > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {rend.diferencia > 0 ? '-' : ''}{fmtMoney(Math.abs(rend.diferencia))}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {rend ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text} border ${badge.border}`}>
                              {badge.label}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => abrirEditarCobrador(c)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition"
                              title="Editar Cobrador"
                            >
                              <span className="material-symbols-outlined text-[17px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarCobrador(c.id_cobrador)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                              title="Eliminar Cobrador"
                            >
                              <span className="material-symbols-outlined text-[17px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Panel expandible: historial reciente */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="bg-slate-50/50 px-6 py-4">
                            <div className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px]">history</span>
                              Últimos cobros registrados por {c.nombre}
                            </div>
                            {historialLoading === c.id_cobrador ? (
                              <div className="text-center text-slate-400 py-4">
                                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
                              </div>
                            ) : (historial[c.id_cobrador] ?? []).length === 0 ? (
                              <div className="text-center text-slate-400 py-4">Sin registros recientes</div>
                            ) : (
                              <table className="w-full text-xs">
                                <thead className="border-b border-slate-200">
                                  <tr className="text-slate-500 uppercase font-bold">
                                    <th className="py-1.5 px-3 text-left">Fecha</th>
                                    <th className="py-1.5 px-3 text-left">N° OP</th>
                                    <th className="py-1.5 px-3 text-right">Monto</th>
                                    <th className="py-1.5 px-3 text-right">Cuotas</th>
                                    <th className="py-1.5 px-3 text-left">Motivo No-Pago</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(historial[c.id_cobrador] ?? []).slice(0, 10).map(cobro => (
                                    <tr key={cobro.id_cobro} className="hover:bg-white/50">
                                      <td className="py-1.5 px-3 font-mono text-slate-600">
                                        {new Date(cobro.fecha_hora).toLocaleDateString('es-AR')}
                                      </td>
                                      <td className="py-1.5 px-3 font-mono font-bold">#{cobro.nro_op}</td>
                                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900">
                                        {fmtMoney(Number(cobro.monto_cobrado))}
                                      </td>
                                      <td className="py-1.5 px-3 text-right font-mono text-slate-600">
                                        {Number(cobro.cuotas_equivalentes).toFixed(1)}
                                      </td>
                                      <td className="py-1.5 px-3 text-slate-500">
                                        {cobro.motivo_no_pago || '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{cobradoresConRendimiento.length} cobradores activos</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Datos en vivo — Meta operativa: ≥ 90%
          </span>
        </div>
      </section>

      {/* Modal: Nuevo Cobrador */}
      {modalNuevoCobrador && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">person_add</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Agregar Cobrador</h4>
                  <p className="text-[11px] text-slate-500">Alta individual de cobrador en ruta</p>
                </div>
              </div>
              <button
                onClick={() => setModalNuevoCobrador(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCrearCobrador} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Marcelo Delgado"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Teléfono / Celular
                </label>
                <input
                  type="text"
                  placeholder="+54 9 381 400-0000"
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Porcentaje de Comisión (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={nuevaComision}
                  onChange={(e) => setNuevaComision(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNuevoCobrador(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">save</span>
                  <span>Guardar Cobrador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Cobrador */}
      {modalEditarCobrador && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Editar Cobrador</h4>
                  <p className="text-[11px] text-slate-500">Actualizar datos de {modalEditarCobrador.nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setModalEditarCobrador(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarEdicion} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Teléfono / Celular
                </label>
                <input
                  type="text"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-medium focus:outline-none transition"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Porcentaje de Comisión (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editComision}
                  onChange={(e) => setEditComision(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 p-2.5 rounded-xl text-slate-900 font-mono font-bold focus:outline-none transition"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editActivo"
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="editActivo" className="text-slate-700 font-bold select-none cursor-pointer">
                  Cobrador Activo en Ruta
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalEditarCobrador(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Importar Cobradores desde Excel / CSV */}
      {modalImportarExcel && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">upload_file</span>
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">Importar Cobradores desde Excel</h4>
                  <p className="text-[11px] text-slate-500">Carga masiva por archivo CSV o Excel (.csv / .xlsx)</p>
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
                  Formato de la Hoja de Cálculo
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  El archivo debe contener las siguientes columnas (puedes descargar nuestra plantilla de ejemplo lista para usar):
                </p>
                <div className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-700">
                  Nombre, Telefono, Porcentaje Comision
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 text-xs block">¿No tienes el archivo listo?</span>
                  <span className="text-[11px] text-slate-500">Descarga la plantilla con cobradores de ejemplo.</span>
                </div>
                <button
                  type="button"
                  onClick={() => descargarPlantillaCSV('cobradores')}
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
                  id="input-archivo-cobradores"
                />
                <label
                  htmlFor="input-archivo-cobradores"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <span className="material-symbols-outlined text-4xl text-emerald-600">cloud_upload</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {archivoCargando ? 'Procesando archivo...' : 'Haz clic aquí para seleccionar tu archivo Excel o CSV'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Soporta archivos Excel nativos (.xlsx / .xls) y hojas CSV (.csv)
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
    </div>
  );
};
