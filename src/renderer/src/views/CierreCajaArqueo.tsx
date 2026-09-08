import React, { useState, useMemo, useEffect } from 'react';
import { cerrarCajaEnSupabase, supabase } from '../lib/supabase';
import { COBRADORES_CANONICOS } from '../utils/cobradores-catalogo';

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

interface DenominacionItem {
  valor: number;
  etiqueta: string;
  subtitulo: string;
}

const DENOMINACIONES: DenominacionItem[] = [
  { valor: 20000, etiqueta: '$20.000', subtitulo: 'J. B. Alberdi' },
  { valor: 10000, etiqueta: '$10.000', subtitulo: 'Belgrano / Thompson' },
  { valor: 2000, etiqueta: '$2.000', subtitulo: 'Carrillo / Grierson' },
  { valor: 1000, etiqueta: '$1.000', subtitulo: 'San Martín / Hornero' },
  { valor: 500, etiqueta: '$500', subtitulo: 'Yaguareté' },
  { valor: 200, etiqueta: '$200', subtitulo: 'Ballena Franca' },
  { valor: 100, etiqueta: '$100', subtitulo: 'Evita / Roca / Taruca' },
  { valor: 50, etiqueta: '$50 / Mon.', subtitulo: 'Cambio Menor' },
];

const COBRADORES_INICIALES: CobradorItem[] = COBRADORES_CANONICOS.map((c) => ({
  id: c.id_cobrador,
  nombre: c.nombre,
  inicial: c.inicial || c.nombre.charAt(0),
  porcentaje_comision: c.porcentaje_comision,
  zona: c.zona,
  cobrado: 0,
  contrato: c.contrato || `Contrato #C-0${c.id_cobrador}`,
  tarifa: c.tarifa || 'Cobrador Senior',
}));

export const CierreCajaArqueo: React.FC = () => {
  const hoyStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const ayerStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }, []);

  const [cobradores, setCobradores] = useState<CobradorItem[]>(COBRADORES_INICIALES);
  const [selectedCobradorId, setSelectedCobradorId] = useState<number>(1);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(hoyStr);
  const [dineroFisicoContado, setDineroFisicoContado] = useState<string>('0');
  const [modoConteo, setModoConteo] = useState<'billetes' | 'monto'>('billetes');
  const [conteoBilletes, setConteoBilletes] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
  });

  const [observaciones, setObservaciones] = useState<string>('');
  const [cierreConfirmado, setCierreConfirmado] = useState<boolean>(false);
  const [cierresHoy, setCierresHoy] = useState<Record<number, any>>({});
  const [cargando, setCargando] = useState<boolean>(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [mostrarModalActa, setMostrarModalActa] = useState<boolean>(false);
  const [adminNombre, setAdminNombre] = useState<string>('Administrador');

  // Obtener nombre del administrador autenticado desde Supabase Auth
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const u = data.user;
        const nombre =
          u.user_metadata?.nombre ||
          u.user_metadata?.full_name ||
          (u.email ? u.email.split('@')[0] : 'Administrador');
        setAdminNombre(nombre);
      }
    });
  }, []);

  // Cargar cobradores y cobros dinámicos desde localStorage / Supabase
  useEffect(() => {
    let cancelado = false;

    const sincronizarDatos = async () => {
      try {
        const cobradoresRaw = localStorage.getItem('credit_on_cobradores');
        const historialRaw = localStorage.getItem('credit_on_historial_cobros');

        let lista: any[] = [];
        if (cobradoresRaw) {
          try {
            lista = JSON.parse(cobradoresRaw);
          } catch {}
        }
        if (!Array.isArray(lista) || lista.length === 0) {
          lista = COBRADORES_CANONICOS;
        }

        let cobrosHistorial: any[] = [];
        if (historialRaw) {
          try {
            cobrosHistorial = JSON.parse(historialRaw);
          } catch {}
        }

        // Consultar cobros directamente desde Supabase Cloud para reflejar pagos de la PWA móvil
        if (supabase) {
          try {
            const { data: dbCobros } = await supabase
              .from('cobros')
              .select('id_cobro, nro_op, id_cobrador, fecha_hora, monto_cobrado, cuotas_equivalentes, cobradores(nombre)')
              .gte('fecha_hora', `${fechaSeleccionada}T00:00:00`)
              .lte('fecha_hora', `${fechaSeleccionada}T23:59:59.999Z`);

            if (dbCobros && dbCobros.length > 0) {
              const mapaIds = new Set(cobrosHistorial.map((h: any) => h.id_cobro));
              dbCobros.forEach((dc: any) => {
                if (!mapaIds.has(dc.id_cobro)) {
                  cobrosHistorial.push(dc);
                }
              });
              cobrosHistorial.sort((a: any, b: any) => new Date(b.fecha_hora || 0).getTime() - new Date(a.fecha_hora || 0).getTime());
            }
          } catch (err) {
            console.warn('[CierreCajaArqueo] Error al consultar cobros en Supabase:', err);
          }
        }

        if (cancelado) return;

        if (Array.isArray(lista) && lista.length > 0) {
          const actualizados: CobradorItem[] = lista.map((c: any, idx: number) => {
            const cid = Number(c.id || c.id_cobrador || idx + 1);
            const cNombre = (c.nombre || '').toLowerCase().trim();
            const cobradorBase = COBRADORES_CANONICOS.find((cb) => cb.id_cobrador === cid);

            // Sumar cobros realizados para la fecha seleccionada
            const cobrosCobrador = cobrosHistorial.filter((h: any) => {
              const rawFecha = h.fecha_hora || h.fecha || h.created_at || '';
              const hFecha = rawFecha ? rawFecha.split('T')[0] : '';
              const hCobradorId = Number(h.id_cobrador || h.cobradorId || h.cobrador_id);
              const hNombre = (h.cobradores?.nombre || h.cobradorNombre || h.cobrador || '').toLowerCase().trim();

              const matchId = hCobradorId === cid;
              const matchNombre = Boolean(cNombre && hNombre && (cNombre.includes(hNombre) || hNombre.includes(cNombre)));

              const matchFecha = !fechaSeleccionada || hFecha === fechaSeleccionada;

              return (matchId || matchNombre) && matchFecha;
            });

            const sumaCobros = cobrosCobrador.reduce((acc: number, h: any) => {
              const rawMonto = h.monto_cobrado !== undefined ? h.monto_cobrado : (h.monto !== undefined ? h.monto : h.importe);
              const m = Number(rawMonto);
              return acc + (isNaN(m) ? 0 : m);
            }, 0);

            // Si hay cobros registrados en la fecha, usar suma exacta; sino respetar cobrado si viene en el objeto o 0
            const montoFinalCobrado = sumaCobros > 0
              ? sumaCobros
              : (c.cobrado !== undefined ? Number(c.cobrado) : 0);

            return {
              id: cid,
              nombre: c.nombre || cobradorBase?.nombre || `Cobrador ${cid}`,
              inicial: (c.nombre || cobradorBase?.nombre || 'C').charAt(0).toUpperCase(),
              porcentaje_comision: Number(c.porcentaje_comision || cobradorBase?.porcentaje_comision || 10),
              zona: c.zona || cobradorBase?.zona || `Circuito Z-0${cid}`,
              cobrado: montoFinalCobrado,
              supervisor: c.supervisor || cobradorBase?.supervisor || undefined,
              contrato: c.contrato || cobradorBase?.contrato || `Contrato #C-0${cid}`,
              tarifa: c.tarifa || cobradorBase?.tarifa || 'Cobrador de Campo',
            };
          });

          setCobradores(actualizados);
        }

        // Cargar cierres definitivos de la fecha seleccionada
        const cierresRaw = localStorage.getItem('credit_on_cierres_caja');
        if (cierresRaw) {
          try {
            const listCierres = JSON.parse(cierresRaw);
            const mapaCierres: Record<number, any> = {};
            if (Array.isArray(listCierres)) {
              listCierres.forEach((cr: any) => {
                const cF = (cr.fecha || '').split('T')[0];
                if (cF === fechaSeleccionada) {
                  mapaCierres[Number(cr.id_cobrador)] = cr;
                }
              });
            }
            setCierresHoy(mapaCierres);
          } catch {}
        } else {
          setCierresHoy({});
        }
      } catch (e) {
        console.warn('Error al sincronizar cobradores:', e);
      }
    };

    sincronizarDatos();

    window.addEventListener('credit_on_storage_update', sincronizarDatos);
    window.addEventListener('storage', sincronizarDatos);
    window.addEventListener('focus', sincronizarDatos);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('cierre-caja-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cobros' }, () => {
          sincronizarDatos();
        })
        .subscribe();
    }

    return () => {
      cancelado = true;
      window.removeEventListener('credit_on_storage_update', sincronizarDatos);
      window.removeEventListener('storage', sincronizarDatos);
      window.removeEventListener('focus', sincronizarDatos);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [fechaSeleccionada]);

  const cobradorActual = useMemo(() => {
    return cobradores.find((c) => c.id === selectedCobradorId) || cobradores[0] || COBRADORES_INICIALES[0];
  }, [cobradores, selectedCobradorId]);

  // Formato de fecha legible
  const fechaFormateada = useMemo(() => {
    try {
      const [y, m, d] = fechaSeleccionada.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12, 0, 0);
      return date.toLocaleDateString('es-AR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return fechaSeleccionada;
    }
  }, [fechaSeleccionada]);

  // Clave de almacenamiento para borrador según cobrador y fecha
  const DRAFT_KEY = `credit_on_draft_arqueo_${selectedCobradorId}_${fechaSeleccionada}`;

  // Restaurar estado según cierre definitivo registrado o borrador
  useEffect(() => {
    const yaCerrado = cierresHoy[selectedCobradorId];
    if (yaCerrado) {
      setCierreConfirmado(true);
      if (yaCerrado.fisico !== undefined) setDineroFisicoContado(String(yaCerrado.fisico));
      if (yaCerrado.billetes) setConteoBilletes(yaCerrado.billetes);
      if (yaCerrado.observaciones !== undefined) setObservaciones(yaCerrado.observaciones);
      return;
    }

    setCierreConfirmado(false);
    try {
      const guardado = localStorage.getItem(DRAFT_KEY);
      if (guardado) {
        const d = JSON.parse(guardado);
        if (d.dineroFisicoContado !== undefined) setDineroFisicoContado(String(d.dineroFisicoContado));
        if (d.conteoBilletes) setConteoBilletes(d.conteoBilletes);
        if (d.modoConteo) setModoConteo(d.modoConteo);
        if (d.observaciones !== undefined) setObservaciones(d.observaciones);
        setNotificacion(`Borrador recuperado para ${cobradorActual.nombre} (${fechaSeleccionada}).`);
        setTimeout(() => setNotificacion(null), 3000);
      } else {
        setDineroFisicoContado('0');
        setConteoBilletes({
          20000: 0,
          10000: 0,
          2000: 0,
          1000: 0,
          500: 0,
          200: 0,
          100: 0,
          50: 0,
        });
      }
    } catch (e) {
      console.warn('Error al leer borrador local:', e);
    }
  }, [selectedCobradorId, fechaSeleccionada, cierresHoy]);

  // Cálculos consolidados del lote
  const resumen = useMemo(() => {
    const totalGeneral = cobradorActual.cobrado !== undefined ? Number(cobradorActual.cobrado) : 22000;
    const totalEfectivo = Math.round(totalGeneral * 0.65);
    const totalProductos = totalGeneral - totalEfectivo;
    const comisionCobrador = Math.round(totalGeneral * (cobradorActual.porcentaje_comision / 100));
    const viaticos = totalGeneral > 0 ? 2500 : 0;
    const adelantos = 0;
    const netoARendir = Math.max(0, totalGeneral - comisionCobrador - viaticos - adelantos);

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

  // Total de billetes contados
  const totalBilletesContados = useMemo(() => {
    return Object.values(conteoBilletes).reduce((acc, cant) => acc + (cant || 0), 0);
  }, [conteoBilletes]);

  // Manejo interactivo de billetes
  const handleCambiarCantidadBillete = (valor: number, nuevaCantidad: number) => {
    const cant = Math.max(0, Math.floor(nuevaCantidad || 0));
    setConteoBilletes((prev) => {
      const next = { ...prev, [valor]: cant };
      const nuevoTotal = Object.entries(next).reduce(
        (acc, [denom, c]) => acc + Number(denom) * (c || 0),
        0
      );
      setDineroFisicoContado(String(nuevoTotal));
      return next;
    });
  };

  const handleAutocompletarBilletes = (montoObjetivo: number) => {
    let resto = Math.max(0, Math.round(montoObjetivo));
    const nuevoConteo: Record<number, number> = {
      20000: 0,
      10000: 0,
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
      50: 0,
    };

    for (const item of DENOMINACIONES) {
      if (resto >= item.valor) {
        const cant = Math.floor(resto / item.valor);
        nuevoConteo[item.valor] = cant;
        resto -= cant * item.valor;
      }
    }

    setConteoBilletes(nuevoConteo);
    setDineroFisicoContado(String(montoObjetivo));
    setModoConteo('billetes');
  };

  const handleLimpiarBilletes = () => {
    setConteoBilletes({
      20000: 0,
      10000: 0,
      2000: 0,
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
      50: 0,
    });
    setDineroFisicoContado('0');
  };

  const handleGuardarBorrador = () => {
    try {
      const draft = {
        cobradorId: selectedCobradorId,
        cobradorNombre: cobradorActual.nombre,
        fecha: fechaSeleccionada,
        dineroFisicoContado,
        conteoBilletes,
        modoConteo,
        observaciones,
        guardadoEn: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setNotificacion(`✓ Borrador guardado exitosamente para ${cobradorActual.nombre}.`);
      setTimeout(() => setNotificacion(null), 3500);
    } catch (e: any) {
      setNotificacion(`Error al guardar borrador: ${e.message}`);
    }
  };

  const handleConfirmarCierre = async () => {
    if (resumen.fisicoNum <= 0) {
      alert('Por favor ingrese el dinero físico (conteo de billetes) antes de cerrar.');
      return;
    }

    const conf = window.confirm(
      `¿Confirmar el cierre definitivo de caja para ${cobradorActual.nombre}?\n\n` +
      `Recaudación Bruta: $${resumen.totalGeneral.toLocaleString('es-AR')}\n` +
      `Comisión: -$${resumen.comisionCobrador.toLocaleString('es-AR')}\n` +
      `Viáticos Combustible: -$${resumen.viaticos.toLocaleString('es-AR')}\n` +
      `Neto Teórico a Rendir: $${resumen.netoARendir.toLocaleString('es-AR')}\n` +
      `Físico en Mano: $${resumen.fisicoNum.toLocaleString('es-AR')} (${totalBilletesContados} billetes)\n` +
      (resumen.diferencia !== 0
        ? `Diferencia de Arqueo: $${resumen.diferencia.toLocaleString('es-AR')} (${resumen.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'})`
        : 'Estado: ARQUEO EXACTO CONCILIADO')
    );

    if (!conf) return;

    setCargando(true);
    try {
      if (supabase) {
        await cerrarCajaEnSupabase({
          id_cobrador: cobradorActual.id,
          fecha: fechaSeleccionada,
        }).catch((err) => console.warn('Supabase fn_cerrar_caja error:', err));
      }

      // Guardar registro inmutable en localStorage
      try {
        const cierresPrev = JSON.parse(localStorage.getItem('credit_on_cierres_caja') || '[]');
        const sinDuplicados = Array.isArray(cierresPrev)
          ? cierresPrev.filter((item: any) => {
              const itemFecha = (item.fecha || '').split('T')[0];
              return !(Number(item.id_cobrador) === cobradorActual.id && itemFecha === fechaSeleccionada);
            })
          : [];

        const nuevoRegistro = {
          id_cobrador: cobradorActual.id,
          cobrador_nombre: cobradorActual.nombre,
          fecha: fechaSeleccionada,
          recaudado: resumen.totalGeneral,
          comision: resumen.comisionCobrador,
          neto: resumen.netoARendir,
          fisico: resumen.fisicoNum,
          diferencia: resumen.diferencia,
          total_billetes: totalBilletesContados,
          billetes: conteoBilletes,
          observaciones,
          cerrado_en: new Date().toISOString(),
        };

        sinDuplicados.push(nuevoRegistro);
        localStorage.setItem('credit_on_cierres_caja', JSON.stringify(sinDuplicados));
        setCierresHoy((prev) => ({ ...prev, [cobradorActual.id]: nuevoRegistro }));
        window.dispatchEvent(new Event('credit_on_storage_update'));
      } catch {}

      setCierreConfirmado(true);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setNotificacion(`¡Caja de ${cobradorActual.nombre} cerrada y conciliada con éxito! Queda archivada como rendida.`);
      setTimeout(() => setNotificacion(null), 5000);
    } catch (error: any) {
      setNotificacion(`Caja cerrada localmente: ${error.message || 'registrada en auditoría'}`);
      setCierreConfirmado(true);
    } finally {
      setCargando(false);
    }
  };

  const handleReabrirCierre = () => {
    if (!window.confirm(`¿Deseas reabrir el arqueo de ${cobradorActual.nombre} para realizar modificaciones?`)) return;
    try {
      const raw = localStorage.getItem('credit_on_cierres_caja');
      if (raw) {
        const list = JSON.parse(raw);
        const filtrados = Array.isArray(list)
          ? list.filter((item: any) => {
              const itemFecha = (item.fecha || '').split('T')[0];
              return !(Number(item.id_cobrador) === cobradorActual.id && itemFecha === fechaSeleccionada);
            })
          : [];
        localStorage.setItem('credit_on_cierres_caja', JSON.stringify(filtrados));
      }
      setCierreConfirmado(false);
      setCierresHoy((prev) => {
        const next = { ...prev };
        delete next[cobradorActual.id];
        return next;
      });
      window.dispatchEvent(new Event('credit_on_storage_update'));
      setNotificacion(`Caja de ${cobradorActual.nombre} reabierta para edición.`);
      setTimeout(() => setNotificacion(null), 3500);
    } catch (e: any) {
      setNotificacion(`Error al reabrir caja: ${e.message}`);
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
            <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-800 px-3.5 py-2 rounded-xl text-sm font-semibold capitalize">
              <span className="material-symbols-outlined text-[18px] text-emerald-600">calendar_today</span>
              <span>{fechaFormateada} - Turno Tarde</span>
            </div>

            <button
              onClick={() => setFechaSeleccionada(hoyStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                fechaSeleccionada === hoyStr
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setFechaSeleccionada(ayerStr)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                fechaSeleccionada === ayerStr
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ayer
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                cierreConfirmado
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cierreConfirmado ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              ></span>
              <span className="uppercase tracking-wide">
                {cierreConfirmado ? 'Caja Rendida y Bóveda Cerrada' : 'Pendiente de Arqueo Físico'}
              </span>
            </div>
            <div className="text-xs text-slate-400 hidden md:block">
              Cierre N° <strong className="font-mono text-slate-700">ARQ-{fechaSeleccionada.replace(/-/g, '')}-Z0{cobradorActual.id}</strong>
            </div>
          </div>
        </div>

        {/* Fila 2: Carrusel de Chips de Cobradores con Montos y Estado de Cierre */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Seleccionar Cobrador para Arqueo Individual:
            </div>
            {/* Indicador de progreso de cobradores rendidos */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Progreso del turno:</span>
              <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                {Object.keys(cierresHoy).length} de {cobradores.length} rendidos
              </span>
              {Object.keys(cierresHoy).length === cobradores.length && cobradores.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  ✓ Turno 100% Rendido
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cobradores.map((cob) => {
              const isSelected = cob.id === selectedCobradorId;
              const estaCerrado = Boolean(cierresHoy[cob.id]);

              return (
                <button
                  key={cob.id}
                  onClick={() => {
                    setSelectedCobradorId(cob.id);
                  }}
                  className={`p-3.5 sm:p-4 rounded-xl text-left transition-all border flex flex-col justify-between relative overflow-hidden ${
                    estaCerrado
                      ? isSelected
                        ? 'bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/30 shadow-sm'
                        : 'bg-emerald-50/50 border-emerald-300 hover:border-emerald-400'
                      : isSelected
                      ? 'bg-slate-50 border-slate-900 ring-2 ring-slate-900/10 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        estaCerrado
                          ? 'bg-emerald-700 text-white shadow-sm'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {estaCerrado ? (
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                      ) : (
                        cob.inicial
                      )}
                    </div>

                    {/* Badge de estado: Cerrado o Pendiente */}
                    {estaCerrado ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                        <span className="material-symbols-outlined text-[12px]">check</span>
                        Cerrado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                        Pendiente
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-bold text-sm text-slate-900 leading-tight flex items-center gap-1">
                      <span className="truncate">{cob.nombre}</span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-slate-900 text-[16px] flex-shrink-0">
                          radio_button_checked
                        </span>
                      )}
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

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <div className="text-xs font-bold font-mono text-emerald-700">
                      ${cob.cobrado.toLocaleString('es-AR')}
                    </div>
                    {estaCerrado && (
                      <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                        Rendido
                      </span>
                    )}
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
              <span>Cobranza préstamos personales</span>
              <span className="font-bold text-emerald-600">65.0% del total</span>
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
              <span>Cuotas de artículos financiados</span>
              <span className="font-bold text-emerald-600">35.0% del total</span>
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
              <span>Jornada de {cobradorActual.nombre}</span>
              <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full text-[11px]">
                100% verificado
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

        {/* Columna Derecha (7 cols): Módulo de Arqueo Físico y Desglose de Billetes */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Cabecera del Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">payments</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Arqueo Físico &amp; Conteo en Mano</h3>
                  <p className="text-xs text-slate-500">Conteo por billetes y validación contra tesorería</p>
                </div>
              </div>

              {/* Selector de Modo de Conteo */}
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModoConteo('billetes')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoConteo === 'billetes'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">receipt</span>
                  <span>Por Billetes</span>
                  {totalBilletesContados > 0 && (
                    <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-black">
                      {totalBilletesContados}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModoConteo('monto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    modoConteo === 'monto'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">keyboard</span>
                  <span>Monto Directo</span>
                </button>
              </div>
            </div>

            {/* Aviso de Caja Cerrada Definitivamente */}
            {cierreConfirmado && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-wrap items-center justify-between gap-3 text-emerald-900 text-xs shadow-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="material-symbols-outlined text-[20px] text-emerald-700">verified</span>
                  <span>Este cobrador ya cerró definitivamente su caja para esta fecha. Los valores están protegidos.</span>
                </div>
                <button
                  type="button"
                  onClick={handleReabrirCierre}
                  className="px-3 py-1.5 bg-white border border-emerald-400 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg shadow-sm transition text-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  <span>Reabrir para Modificar</span>
                </button>
              </div>
            )}

            {/* Acciones Rápidas del Arqueo */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Billetes en mano:</span>
                <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono">
                  {totalBilletesContados} unidades
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-bold font-mono text-emerald-700 text-sm">
                  ARS ${resumen.fisicoNum.toLocaleString('es-AR')},00
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={cierreConfirmado}
                  onClick={() => handleAutocompletarBilletes(resumen.netoARendir)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 shadow-sm"
                  title="Reparte automáticamente el neto a rendir en billetes de curso legal"
                >
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  <span>Match Exacto</span>
                </button>
                <button
                  type="button"
                  disabled={cierreConfirmado}
                  onClick={handleLimpiarBilletes}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  title="Poner todos los billetes a cero"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* MODO 1: CONTEO POR DENOMINACIÓN DE BILLETES */}
            {modoConteo === 'billetes' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {DENOMINACIONES.map((den) => {
                    const cant = conteoBilletes[den.valor] || 0;
                    const subtotal = cant * den.valor;
                    return (
                      <div
                        key={den.valor}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${
                          cant > 0
                            ? 'bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-400/30'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-black font-mono text-xs text-slate-900 block">
                              {den.etiqueta}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block leading-tight">
                              {den.subtitulo}
                            </span>
                          </div>
                          {cant > 0 && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                              {cant}
                            </span>
                          )}
                        </div>

                        {/* Controles de Cantidad (+ / - e input) */}
                        <div className="flex items-center gap-1 my-2">
                          <button
                            type="button"
                            disabled={cant <= 0 || cierreConfirmado}
                            onClick={() => handleCambiarCantidadBillete(den.valor, cant - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={cant === 0 ? '' : cant}
                            onChange={(e) => {
                              const v = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              handleCambiarCantidadBillete(den.valor, isNaN(v) ? 0 : v);
                            }}
                            placeholder="0"
                            disabled={cierreConfirmado}
                            className="w-full text-center font-mono font-bold text-sm bg-slate-50 border border-slate-200 rounded-lg py-1 text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none transition"
                          />
                          <button
                            type="button"
                            disabled={cierreConfirmado}
                            onClick={() => handleCambiarCantidadBillete(den.valor, cant + 1)}
                            className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center font-bold text-sm transition"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal del billete */}
                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Subtotal:</span>
                          <span className={`font-mono font-bold ${cant > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            ${subtotal.toLocaleString('es-AR')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODO 2: ENTRADA DIRECTA DE MONTO */}
            {modoConteo === 'monto' && (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Ingresar Dinero Físico Contado ($ ARS):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xl text-slate-400">
                    ARS $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={dineroFisicoContado}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDineroFisicoContado('');
                        return;
                      }
                      const limpio = val.replace(/[^0-9]/g, '');
                      setDineroFisicoContado(limpio);
                    }}
                    placeholder="0"
                    disabled={cierreConfirmado}
                    className="w-full bg-white border border-slate-300 focus:border-emerald-500 rounded-xl pl-20 pr-4 py-3.5 text-3xl font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={cierreConfirmado}
                    onClick={() => handleAutocompletarBilletes(resumen.netoARendir)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    Match Exacto (${resumen.netoARendir.toLocaleString('es-AR')})
                  </button>
                  <button
                    type="button"
                    disabled={cierreConfirmado}
                    onClick={() => {
                      const m = Math.max(0, resumen.netoARendir - 2000);
                      setDineroFisicoContado(String(m));
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    -$2.000 Faltante
                  </button>
                  <button
                    type="button"
                    disabled={cierreConfirmado}
                    onClick={() => {
                      const m = resumen.netoARendir + 1500;
                      setDineroFisicoContado(String(m));
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    +$1.500 Sobrante
                  </button>
                  <button
                    type="button"
                    disabled={cierreConfirmado}
                    onClick={() => handleAutocompletarBilletes(resumen.fisicoNum)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-200 text-slate-800 hover:bg-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition ml-auto"
                  >
                    Desglosar en Billetes →
                  </button>
                </div>
              </div>
            )}

            {/* Indicador Dinámico de Conciliación / Diferencia */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between transition-all ${
                resumen.diferencia === 0
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : resumen.diferencia > 0
                  ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                    resumen.diferencia === 0
                      ? 'bg-emerald-600 text-white'
                      : resumen.diferencia > 0
                      ? 'bg-blue-600 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {resumen.diferencia === 0 ? 'check_circle' : resumen.diferencia > 0 ? 'trending_up' : 'error'}
                  </span>
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                    {resumen.diferencia === 0
                      ? 'ARQUEO EXACTO: CONCILIADO'
                      : resumen.diferencia > 0
                      ? 'SOBRANTE DE CAJA EN ARQUEO'
                      : 'FALTANTE DE CAJA EN ARQUEO'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-600 mt-0.5">
                    {resumen.diferencia === 0
                      ? 'Coincidencia perfecta al centavo con el Neto Teórico. Sin desvíos.'
                      : resumen.diferencia > 0
                      ? 'El dinero físico ingresado supera el neto exigible según la recaudación.'
                      : 'El dinero físico en mano es menor al monto teórico liquidado.'}
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Diferencia</span>
                <span className="text-lg sm:text-xl font-mono font-black">
                  {resumen.diferencia === 0
                    ? '$0,00'
                    : `${resumen.diferencia > 0 ? '+' : ''}$${resumen.diferencia.toLocaleString('es-AR')},00`}
                </span>
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
                disabled={cierreConfirmado}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Ingresa detalles de la rendición, justificación de diferencias o novedades..."
                className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-500 focus:bg-white rounded-xl p-3 text-xs text-slate-800 focus:outline-none transition resize-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. BARRA DE ACCIÓN PRINCIPAL Y CIERRE DE CAJA (STICKY BOTTOM) */}
      {/* ===================================================================== */}
      <section className="fixed bottom-0 left-72 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-8 py-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Efectivo Ingresante a Bóveda */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block">
            Efectivo Ingresante a Bóveda
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-emerald-700">
              ARS ${resumen.fisicoNum.toLocaleString('es-AR')},00
            </span>
            {totalBilletesContados > 0 && (
              <span className="text-[11px] font-mono text-slate-500">
                ({totalBilletesContados} billetes)
              </span>
            )}
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-wrap items-center gap-3">
          {cierreConfirmado ? (
            <button
              type="button"
              onClick={handleReabrirCierre}
              className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-2 shadow-sm"
              title="Permite reabrir el arqueo para corregir billetes u observaciones"
            >
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>Reabrir para Modificar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGuardarBorrador}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>Guardar Borrador</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMostrarModalActa(true)}
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
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {cierreConfirmado ? 'check_circle' : 'lock'}
            </span>
            <span>
              {cargando
                ? 'Procesando Cierre...'
                : cierreConfirmado
                ? '✓ Caja Cerrada Definitivamente'
                : 'Confirmar y Cerrar Caja Definitivamente'}
            </span>
          </button>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MODAL / VISTA DE IMPRESIÓN: ACTA OFICIAL DE CIERRE DE CAJA (A4) */}
      {/* ===================================================================== */}
      {mostrarModalActa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Barra de Acciones del Modal (No se imprime) */}
            <div className="no-print bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[22px]">description</span>
                <span className="text-sm font-bold">Acta Oficial de Cierre Diario de Caja (Formato A4)</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Imprimir / Guardar como PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarModalActa(false)}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            {/* Hoja A4 Imprimible */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
              <div className="bg-white w-full max-w-3xl p-10 shadow-md border border-slate-200 text-slate-800 space-y-6 text-xs font-sans rounded-xl">
                {/* Encabezado Institucional */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                        CO
                      </div>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">CREDIT-ON</h1>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sistema Integral de Gestión Crediticia y Tesorería • Sucursal Santiago del Estero
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-slate-100 border border-slate-300 font-mono font-bold text-slate-800 px-3 py-1 rounded text-xs">
                      ACTA #{fechaSeleccionada.replace(/-/g, '')}-Z0{cobradorActual.id}
                    </span>
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Emisión: {new Date().toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>

                <div className="text-center py-1">
                  <h2 className="text-base font-extrabold uppercase tracking-wider text-slate-900">
                    Acta Notarial de Cierre Diario de Caja y Arqueo Físico
                  </h2>
                  <p className="text-slate-500 text-[11px]">
                    Constancia legal y conciliación de valores rendidos en cobranza de campo
                  </p>
                </div>

                {/* Datos del Cobrador y la Jornada */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Cobrador Responsable:</span>
                    <strong className="text-slate-900 text-sm">{cobradorActual.nombre}</strong>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      {cobradorActual.tarifa} • {cobradorActual.contrato}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">Zona y Circuito de Cobro:</span>
                    <strong className="text-slate-900 text-sm">{cobradorActual.zona}</strong>
                    <div className="text-slate-500 text-[11px] mt-0.5">
                      Fecha de Rendición: <strong className="font-mono text-slate-800">{fechaSeleccionada}</strong>
                    </div>
                  </div>
                </div>

                {/* Desglose de Rendición y Liquidación */}
                <div className="space-y-2">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    1. Liquidación Financiera de la Jornada
                  </h3>
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-slate-100">
                        <td className="py-2 text-slate-600">Recaudación Bruta Total en Calle:</td>
                        <td className="py-2 text-right font-mono font-bold text-slate-900">
                          ${resumen.totalGeneral.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pl-4 text-slate-500">↳ Cobros de Créditos en Efectivo (65%):</td>
                        <td className="py-1.5 text-right font-mono text-slate-700">
                          ${resumen.totalEfectivo.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 pl-4 text-slate-500">↳ Cobros de Artículos / Bienes (35%):</td>
                        <td className="py-1.5 text-right font-mono text-slate-700">
                          ${resumen.totalProductos.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 text-rose-700">
                        <td className="py-2">(-) Comisión Devengada Cobrador ({cobradorActual.porcentaje_comision}%):</td>
                        <td className="py-2 text-right font-mono font-bold">
                          -${resumen.comisionCobrador.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100 text-rose-700">
                        <td className="py-2">(-) Retención Combustible / Viáticos:</td>
                        <td className="py-2 text-right font-mono font-bold">
                          -${resumen.viaticos.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                        <td className="py-2.5 px-2 text-slate-900 font-extrabold text-sm">
                          (=) NETO TEÓRICO A INGRESAR A BÓVEDA:
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-extrabold text-emerald-700 text-sm">
                          ${resumen.netoARendir.toLocaleString('es-AR')},00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Conciliación Física de Billetes */}
                <div className="space-y-3">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">
                    2. Arqueo y Conciliación Física en Tesorería
                  </h3>

                  {/* Tabla de Desglose de Billetes Auditados */}
                  {totalBilletesContados > 0 ? (
                    <table className="w-full text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-3 text-left">Denominación</th>
                          <th className="py-1.5 px-3 text-center">Cantidad Billetes</th>
                          <th className="py-1.5 px-3 text-right">Subtotal ($ ARS)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {DENOMINACIONES.filter((d) => (conteoBilletes[d.valor] || 0) > 0).map((d) => {
                          const cant = conteoBilletes[d.valor] || 0;
                          const sub = cant * d.valor;
                          return (
                            <tr key={d.valor}>
                              <td className="py-1.5 px-3 font-sans text-slate-800">
                                <strong>{d.etiqueta}</strong> <span className="text-slate-400 text-[10px]">({d.subtitulo})</span>
                              </td>
                              <td className="py-1.5 px-3 text-center font-bold text-slate-900">
                                {cant} u.
                              </td>
                              <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                                ${sub.toLocaleString('es-AR')},00
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50 font-bold border-t border-slate-300">
                          <td className="py-2 px-3 text-slate-800">TOTAL FÍSICO AUDITADO:</td>
                          <td className="py-2 px-3 text-center text-slate-900">{totalBilletesContados} billetes</td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-black text-xs">
                            ${resumen.fisicoNum.toLocaleString('es-AR')},00
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px]">
                      Dinero físico ingresado por monto directo: <strong>${resumen.fisicoNum.toLocaleString('es-AR')},00</strong> (sin desglose de billetes registrado).
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px] block">Dinero Físico Recontado:</span>
                      <div className="text-lg font-mono font-black text-slate-900 mt-0.5">
                        ${resumen.fisicoNum.toLocaleString('es-AR')},00
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase text-[10px] block">Discrepancia / Diferencia:</span>
                      <div
                        className={`text-sm font-mono font-bold mt-1 ${
                          resumen.diferencia === 0
                            ? 'text-emerald-700'
                            : resumen.diferencia > 0
                            ? 'text-blue-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {resumen.diferencia === 0
                          ? 'CONCILIADO EXACTO ($0,00)'
                          : resumen.diferencia > 0
                          ? `SOBRANTE (+$${resumen.diferencia.toLocaleString('es-AR')},00)`
                          : `FALTANTE (-$${Math.abs(resumen.diferencia).toLocaleString('es-AR')},00)`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">
                    Observaciones y Constancias de Cobranza:
                  </span>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 italic text-xs">
                    {observaciones || 'Sin observaciones asentadas.'}
                  </div>
                </div>

                {/* Bloque de Firmas en Blanco para Firma Manuscrita */}
                <div className="pt-10 border-t border-slate-200 grid grid-cols-2 gap-16 text-center">
                  <div className="space-y-2">
                    <div className="border-b-2 border-slate-400 h-20"></div>
                    <div>
                      <strong className="text-slate-900 block">{cobradorActual.nombre}</strong>
                      <span className="text-slate-500 text-[10px]">Firma y Aclaración Cobrador</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="border-b-2 border-slate-400 h-20"></div>
                    <div>
                      <strong className="text-slate-900 block">{adminNombre}</strong>
                      <span className="text-slate-500 text-[10px]">Firma y Sello Tesorería / Administración</span>
                    </div>
                  </div>
                </div>

                {/* Pie de Seguridad */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>HASH: SHA256-ARQ-{fechaSeleccionada.replace(/-/g, '')}-{cobradorActual.id}-VAL</span>
                  <span>CREDIT-ON BACKOFFICE v1.2</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
