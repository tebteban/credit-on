/**
 * useClientesEnVivo — Hook de monitoreo de cartera en tiempo real
 * ================================================================
 * Carga todas las operaciones vigentes con sus cuotas, clientes y cobradores,
 * evalúa la mora de cada una vía PaymentCascadeService, y se suscribe a
 * cambios en tiempo real (Supabase Realtime) para refrescar automáticamente.
 * 
 * Cuenta con persistencia local ('credit_on_cartera_operaciones') y datos demo
 * para garantizar funcionamiento offline, testing de simulación y resiliencia
 * si Supabase no tiene datos o bloquea inserciones por RLS.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { PaymentCascadeService } from '../../../services/payment-service';
import type {
  CuotaModel,
  TipoOperacion,
  AlertaMora,
  NivelMora,
  OperacionModel,
} from '../../../types/payment';

/* ─── Tipos de dominio para la vista ─── */

export interface ClienteInfo {
  id_cliente: number;
  nombre: string;
  dni: string | null;
  domicilio: string;
  telefono: string | null;
  calificacion: string;
}

export interface CobradorInfo {
  id_cobrador: number;
  nombre: string;
  porcentaje_comision: number;
  telefono: string | null;
}

export interface OperacionConMora {
  nro_op: number;
  fecha: string;
  tipo: TipoOperacion;
  monto_capital: number;
  monto_total: number;
  importe_cuota: number;
  saldo_restante: number;
  domicilio_cobro: string | null;
  cliente: ClienteInfo;
  cobrador: CobradorInfo;
  cuotas: CuotaModel[];
  mora: AlertaMora;
  /** Métricas calculadas */
  cuotas_totales: number;
  cuotas_pagadas: number;
  cuotas_pendientes: number;
  proximo_vencimiento: string | null;
}

export interface FiltrosCartera {
  busqueda: string;
  cobrador: string;
  cobrador_id?: number | null;
  tipo_operacion: TipoOperacion | '';
  nivel_mora: NivelMora | '';
}

export interface IndicadoresCartera {
  total_operaciones: number;
  al_dia: number;
  alerta: number;
  mora_critica: number;
  evaluar_retiro: number;
  monto_en_calle: number;
  monto_vencido: number;
}

export interface RegistroHistorialCobro {
  id_cobro: number;
  nro_op: number;
  fecha_hora: string;
  monto_cobrado: number;
  cuotas_equivalentes: number;
  motivo_no_pago?: string | null;
  observacion?: string | null;
  cobradores?: { nombre: string } | null;
}

export const STORAGE_CARTERA_OPERACIONES = 'credit_on_cartera_operaciones';
export const STORAGE_HISTORIAL_COBROS = 'credit_on_historial_cobros';
export const STORAGE_COBRADORES = 'credit_on_cobradores';

export const COBRADORES_DEFAULT: CobradorInfo[] = [
  { id_cobrador: 1, nombre: 'Carlos Mendilaharzu', porcentaje_comision: 8, telefono: '+54 9 381 445-1290' },
  { id_cobrador: 2, nombre: 'Mauro Sánchez', porcentaje_comision: 8, telefono: '+54 9 381 552-8812' },
  { id_cobrador: 3, nombre: 'Juan Pérez', porcentaje_comision: 7.5, telefono: '+54 9 381 671-0023' },
  { id_cobrador: 4, nombre: 'Lucas Albarracín', porcentaje_comision: 9, telefono: '+54 9 381 332-9011' },
];

import { generarCuotasSchedule } from '../../../core/schedule-engine';
export { generarCuotasSchedule };


/**
 * Crea un objeto OperacionConMora completo con evaluación de mora integrada
 */
export function armarOperacionConMora(
  nro_op: number,
  fecha: string,
  tipo: TipoOperacion,
  montoCapital: number,
  cuotasCount: number,
  valorCuota: number,
  cliente: ClienteInfo,
  cobrador: CobradorInfo,
  pagadasCount: number = 0,
  vencidasImpagas: number = 0
): OperacionConMora {
  const cuotas = generarCuotasSchedule(nro_op, valorCuota, cuotasCount, pagadasCount, vencidasImpagas);
  const mora = PaymentCascadeService.evaluarMora(tipo, cuotas);

  const saldoRestante = cuotas
    .filter(c => c.estado !== 'PAGADA')
    .reduce((s, c) => s + (c.monto_esperado - c.monto_pagado), 0);

  const cuotasPagadas = cuotas.filter(c => c.estado === 'PAGADA').length;
  const cuotasPendientes = cuotas.filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL').length;
  const proximoVencimiento = cuotas
    .filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
    .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]
    ?.fecha_vencimiento ?? null;

  return {
    nro_op,
    fecha,
    tipo,
    monto_capital: montoCapital,
    monto_total: valorCuota * cuotasCount,
    importe_cuota: valorCuota,
    saldo_restante: saldoRestante,
    domicilio_cobro: cliente.domicilio,
    cliente,
    cobrador,
    cuotas,
    mora,
    cuotas_totales: cuotasCount,
    cuotas_pagadas: cuotasPagadas,
    cuotas_pendientes: cuotasPendientes,
    proximo_vencimiento: proximoVencimiento,
  };
}

/**
 * Genera la cartera demo inicial de 6 clientes cubriendo todos los niveles de mora
 */
export function generarOperacionesDemo(): OperacionConMora[] {
  const hoyStr = new Date().toISOString().split('T')[0];

  return [
    armarOperacionConMora(
      101,
      hoyStr,
      'EFECTIVO',
      100000,
      20,
      7500,
      { id_cliente: 1, nombre: 'PÉREZ JUAN CARLOS', dni: '28491203', domicilio: 'Av. Belgrano 1420 - Centro', telefono: '385-4123456', calificacion: 'BUENO' },
      COBRADORES_DEFAULT[0],
      12,
      0 // Al día
    ),
    armarOperacionConMora(
      102,
      hoyStr,
      'PRODUCTO',
      250000,
      24,
      15000,
      { id_cliente: 2, nombre: 'COMERCIAL EL AMIGO', dni: '30112233', domicilio: 'Libertad 840 - Huaico Hondo', telefono: '385-5987654', calificacion: 'BUENO' },
      COBRADORES_DEFAULT[1],
      18,
      0 // Al día
    ),
    armarOperacionConMora(
      103,
      hoyStr,
      'EFECTIVO',
      80000,
      16,
      6500,
      { id_cliente: 3, nombre: 'GÓMEZ MARÍA LAURA', dni: '33445566', domicilio: 'Roca Sur 245 - Cabildo', telefono: '385-6112233', calificacion: 'REGULAR' },
      COBRADORES_DEFAULT[2],
      8,
      1 // Alerta (1 vencida)
    ),
    armarOperacionConMora(
      104,
      hoyStr,
      'PRODUCTO',
      350000,
      24,
      21000,
      { id_cliente: 4, nombre: 'TALLER MECÁNICO RODRÍGUEZ', dni: '25667788', domicilio: 'Av. Colón Sur 3100', telefono: '385-4889900', calificacion: 'REGULAR' },
      COBRADORES_DEFAULT[3],
      6,
      3 // Mora Crítica (3 vencidas)
    ),
    armarOperacionConMora(
      105,
      hoyStr,
      'PRODUCTO',
      180000,
      20,
      13500,
      { id_cliente: 5, nombre: 'BENÍTEZ CLAUDIO ANDRÉS', dni: '29887112', domicilio: 'Calle 12 N° 450 - B° Mishqui Mayu', telefono: '385-4771234', calificacion: 'RIESGO' },
      COBRADORES_DEFAULT[0],
      2,
      6 // Evaluar Retiro (6 vencidas en producto)
    ),
    armarOperacionConMora(
      106,
      hoyStr,
      'EFECTIVO',
      120000,
      20,
      8400,
      { id_cliente: 6, nombre: 'BAZÁN NORMA BEATRIZ', dni: '22334556', domicilio: 'Jujuy 560 - Centro', telefono: '385-5129988', calificacion: 'BUENO' },
      COBRADORES_DEFAULT[1],
      15,
      0 // Al día
    ),
  ];
}

const FILTROS_INICIALES: FiltrosCartera = {
  busqueda: '',
  cobrador: '',
  cobrador_id: null,
  tipo_operacion: '',
  nivel_mora: '',
};

export function useClientesEnVivo() {
  const [operaciones, setOperaciones] = useState<OperacionConMora[]>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_CARTERA_OPERACIONES);
      if (guardado !== null) {
        return JSON.parse(guardado);
      }
    } catch {}
    const inicial = generarOperacionesDemo();
    try {
      localStorage.setItem(STORAGE_CARTERA_OPERACIONES, JSON.stringify(inicial));
    } catch {}
    return inicial;
  });

  const [cobradores, setCobradores] = useState<CobradorInfo[]>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_COBRADORES);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return COBRADORES_DEFAULT;
  });

  const [filtros, setFiltros] = useState<FiltrosCartera>(FILTROS_INICIALES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Guardar operaciones en memoria y en localStorage */
  const guardarOperaciones = useCallback((nuevas: OperacionConMora[]) => {
    setOperaciones(nuevas);
    try {
      localStorage.setItem(STORAGE_CARTERA_OPERACIONES, JSON.stringify(nuevas));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch {}
  }, []);

  /* Carga de cobradores activos desde Supabase (con fallback local) */
  const cargarCobradores = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error: err } = await supabase
        .from('cobradores')
        .select('id_cobrador, nombre, porcentaje_comision, telefono')
        .eq('activo', true)
        .order('nombre');
      if (!err && data && data.length > 0) {
        setCobradores(data);
        localStorage.setItem(STORAGE_COBRADORES, JSON.stringify(data));
        window.dispatchEvent(new Event('credit_on_storage_update'));
      }
    } catch (e) {
      console.warn('Uso de cobradores en modo local:', e);
    }
  }, []);

  /* Carga de operaciones vigentes desde Supabase (respetando datos locales si no hay en DB) */
  const cargarOperaciones = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    try {
      const { data: ops, error: opsErr } = await supabase
        .from('operaciones')
        .select(`
          nro_op,
          fecha,
          tipo,
          monto_capital,
          monto_total,
          importe_cuota,
          saldo_restante,
          domicilio_cobro,
          clientes (id_cliente, nombre, dni, domicilio, telefono, calificacion),
          cobradores (id_cobrador, nombre, porcentaje_comision, telefono),
          cuotas (id_cuota, nro_op, numero_cuota, fecha_vencimiento, monto_esperado, monto_pagado, estado, fecha_pago_efectivo)
        `)
        .eq('estado', 'VIGENTE')
        .order('nro_op', { ascending: false });

      if (opsErr) {
        console.warn('Supabase operaciones error (usando local):', opsErr.message);
        return;
      }

      if (ops && ops.length > 0) {
        // Leemos las operaciones locales actuales para no perder cuotas ni avances calculados
        const localesRaw = localStorage.getItem(STORAGE_CARTERA_OPERACIONES);
        let opsLocales: OperacionConMora[] = [];
        if (localesRaw) {
          try {
            const parsed = JSON.parse(localesRaw);
            if (Array.isArray(parsed)) opsLocales = parsed;
          } catch {}
        }
        const mapaLocales = new Map<number, OperacionConMora>(opsLocales.map((l) => [l.nro_op, l]));

        const resultado: OperacionConMora[] = ops.map((op: any) => {
          const localOp = mapaLocales.get(op.nro_op);
          const importeCuota = Number(op.importe_cuota) || 5000;
          const montoTotal = Number(op.monto_total) || (importeCuota * 20);
          const saldoRestante = Number(op.saldo_restante);

          let cuotas: CuotaModel[] = (op.cuotas ?? []).map((c: any) => ({
            id_cuota: c.id_cuota,
            nro_op: c.nro_op,
            numero_cuota: c.numero_cuota,
            fecha_vencimiento: c.fecha_vencimiento,
            monto_esperado: Number(c.monto_esperado),
            monto_pagado: Number(c.monto_pagado),
            estado: c.estado,
            fecha_pago_efectivo: c.fecha_pago_efectivo,
          }));

          const cuotasTotales = cuotas.length > 0
            ? cuotas.length
            : (localOp?.cuotas_totales || Math.max(1, Math.round(montoTotal / importeCuota)));

          const pagadasPorCuota = cuotas.filter((c) => c.estado === 'PAGADA').length;
          const pagadasPorMonto = Math.max(0, Math.round((montoTotal - saldoRestante) / importeCuota));
          const cuotasPagadas = Math.max(pagadasPorCuota, pagadasPorMonto, localOp?.cuotas_pagadas || 0);

          if (cuotas.length === 0) {
            if (localOp && Array.isArray(localOp.cuotas) && localOp.cuotas.length > 0) {
              cuotas = localOp.cuotas;
            } else {
              cuotas = generarCuotasSchedule(op.nro_op, importeCuota, cuotasTotales, cuotasPagadas, 0);
            }
          }

          const mora = PaymentCascadeService.evaluarMora(
            op.tipo as TipoOperacion,
            cuotas
          );

          const cuotasPendientes = Math.max(0, cuotasTotales - cuotasPagadas);
          const proximaVencimiento = cuotas
            .filter((c) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
            .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]
            ?.fecha_vencimiento ?? null;

          return {
            nro_op: op.nro_op,
            fecha: op.fecha,
            tipo: op.tipo as TipoOperacion,
            monto_capital: Number(op.monto_capital),
            monto_total: montoTotal,
            importe_cuota: importeCuota,
            saldo_restante: saldoRestante,
            domicilio_cobro: op.domicilio_cobro,
            cliente: op.clientes as ClienteInfo,
            cobrador: op.cobradores as CobradorInfo,
            cuotas,
            mora,
            cuotas_totales: cuotasTotales,
            cuotas_pagadas: cuotasPagadas,
            cuotas_pendientes: cuotasPendientes,
            proximo_vencimiento: proximaVencimiento,
          };
        });

        // Combinar con operaciones locales no presentes en DB para que NUNCA desaparezcan
        let combinadas = [...resultado];
        const mapaNroOps = new Set(resultado.map((r) => r.nro_op));
        const localesNoEnDB = opsLocales.filter((local) => !mapaNroOps.has(local.nro_op));
        if (localesNoEnDB.length > 0) {
          combinadas = [...localesNoEnDB, ...resultado];
        }

        guardarOperaciones(combinadas);
      }
    } catch (e: any) {
      console.warn('Fallback a cartera local:', e.message);
    } finally {
      setLoading(false);
    }
  }, [guardarOperaciones]);

  // Lista unificada de cobradores (Supabase + localStorage + cobradores de operaciones existentes)
  const todosLosCobradores = useMemo(() => {
    const mapa = new Map<string, CobradorInfo>();
    COBRADORES_DEFAULT.forEach((c) => mapa.set(c.nombre.toLowerCase().trim(), c));
    cobradores.forEach((c) => mapa.set(c.nombre.toLowerCase().trim(), c));
    operaciones.forEach((op) => {
      if (op.cobrador?.nombre) {
        const key = op.cobrador.nombre.toLowerCase().trim();
        if (!mapa.has(key)) {
          mapa.set(key, {
            id_cobrador: op.cobrador.id_cobrador || mapa.size + 1,
            nombre: op.cobrador.nombre,
            porcentaje_comision: op.cobrador.porcentaje_comision || 8,
            telefono: op.cobrador.telefono || null,
          });
        }
      }
    });
    return Array.from(mapa.values());
  }, [cobradores, operaciones]);

  // Sincronización en vivo ante cambios en localStorage
  useEffect(() => {
    const sincronizarCarteraLocal = () => {
      try {
        const raw = localStorage.getItem(STORAGE_CARTERA_OPERACIONES);
        if (raw) {
          const parseadas = JSON.parse(raw);
          if (Array.isArray(parseadas)) {
            setOperaciones((prev) => {
              const prevStr = prev.map((p) => `${p.nro_op}-${p.saldo_restante}`).join(',');
              const newStr = parseadas.map((p: any) => `${p.nro_op}-${p.saldo_restante}`).join(',');
              if (prevStr !== newStr) {
                return parseadas;
              }
              return prev;
            });
          }
        }
      } catch {}
    };

    window.addEventListener('storage', sincronizarCarteraLocal);
    window.addEventListener('focus', sincronizarCarteraLocal);
    return () => {
      window.removeEventListener('storage', sincronizarCarteraLocal);
      window.removeEventListener('focus', sincronizarCarteraLocal);
    };
  }, []);

  /* Operaciones filtradas */
  const operacionesFiltradas = useMemo(() => {
    return operaciones.filter(op => {
      // Búsqueda por texto
      if (filtros.busqueda) {
        const q = filtros.busqueda.toLowerCase();
        const coincide =
          op.cliente.nombre.toLowerCase().includes(q) ||
          (op.cliente.dni ?? '').toLowerCase().includes(q) ||
          String(op.nro_op).includes(q) ||
          (op.domicilio_cobro ?? '').toLowerCase().includes(q);
        if (!coincide) return false;
      }

      // Filtro por cobrador (nombre exacto / substring o id)
      if (filtros.cobrador) {
        const f = filtros.cobrador.toLowerCase().trim();
        const opCob = (op.cobrador?.nombre || '').toLowerCase().trim();
        if (!opCob.includes(f) && !f.includes(opCob)) {
          return false;
        }
      } else if (filtros.cobrador_id) {
        const cobradorFiltro = todosLosCobradores.find((c) => c.id_cobrador === filtros.cobrador_id);
        const coincideId = op.cobrador?.id_cobrador === filtros.cobrador_id;
        const coincideNombre =
          cobradorFiltro &&
          op.cobrador?.nombre &&
          (op.cobrador.nombre.toLowerCase().includes(cobradorFiltro.nombre.toLowerCase()) ||
            cobradorFiltro.nombre.toLowerCase().includes(op.cobrador.nombre.toLowerCase()));
        if (!coincideId && !coincideNombre) return false;
      }

      // Filtro por tipo
      if (filtros.tipo_operacion && op.tipo !== filtros.tipo_operacion) {
        return false;
      }

      // Filtro por nivel de mora
      if (filtros.nivel_mora && op.mora.nivel !== filtros.nivel_mora) {
        return false;
      }

      return true;
    });
  }, [operaciones, filtros, todosLosCobradores]);

  /* Indicadores de cartera */
  const indicadores: IndicadoresCartera = useMemo(() => {
    const lista = operacionesFiltradas;
    return {
      total_operaciones: lista.length,
      al_dia: lista.filter(o => o.mora.nivel === 'AL_DIA').length,
      alerta: lista.filter(o => o.mora.nivel === 'ALERTA').length,
      mora_critica: lista.filter(o => o.mora.nivel === 'MORA_CRITICA').length,
      evaluar_retiro: lista.filter(o => o.mora.nivel === 'EVALUAR_RETIRO').length,
      monto_en_calle: lista.reduce((s, o) => s + o.saldo_restante, 0),
      monto_vencido: lista.reduce((s, o) => s + o.mora.deuda_vencida_total, 0),
    };
  }, [operacionesFiltradas]);

  /* Vaciar cartera para pruebas en blanco */
  const vaciarCartera = useCallback(() => {
    guardarOperaciones([]);
  }, [guardarOperaciones]);

  /* Restaurar cartera demo */
  const restaurarDemo = useCallback(() => {
    const demo = generarOperacionesDemo();
    guardarOperaciones(demo);
  }, [guardarOperaciones]);

  /* Agregar una nueva operación a la cartera */
  const agregarOperacion = useCallback((nueva: OperacionConMora) => {
    setOperaciones(prev => {
      const actualizadas = [nueva, ...prev];
      try {
        localStorage.setItem(STORAGE_CARTERA_OPERACIONES, JSON.stringify(actualizadas));
      } catch {}
      return actualizadas;
    });
  }, []);

  /* Eliminar operación */
  const eliminarOperacion = useCallback((nro_op: number) => {
    setOperaciones(prev => {
      const actualizadas = prev.filter(o => o.nro_op !== nro_op);
      try {
        localStorage.setItem(STORAGE_CARTERA_OPERACIONES, JSON.stringify(actualizadas));
      } catch {}
      return actualizadas;
    });
  }, []);

  /* Registrar cobro transaccional en memoria + Supabase background */
  const registrarCobro = useCallback(async (nro_op: number, monto: number): Promise<{ exito: boolean; mensaje: string }> => {
    const op = operaciones.find(o => o.nro_op === nro_op);
    if (!op) return { exito: false, mensaje: 'Operación no encontrada.' };

    const service = new PaymentCascadeService(supabase as any);
    const opModel: OperacionModel = {
      nro_op: op.nro_op,
      fecha: op.fecha,
      id_cliente: op.cliente.id_cliente,
      tipo: op.tipo,
      id_plan: 1,
      id_cobrador_actual: op.cobrador.id_cobrador,
      monto_capital: op.monto_capital,
      monto_total: op.monto_total,
      importe_cuota: op.importe_cuota,
      saldo_restante: op.saldo_restante,
      orden_recorrido: 1,
      estado: 'VIGENTE',
      domicilio_cobro: op.domicilio_cobro ?? undefined,
    };

    const valorCuota = Number(op.importe_cuota) || 5000;
    const totalCuotas = Number(op.cuotas_totales) || Math.max(1, Math.round(Number(op.monto_total || valorCuota * 20) / valorCuota));
    const cuotasBase = (Array.isArray(op.cuotas) && op.cuotas.length > 0)
      ? op.cuotas
      : generarCuotasSchedule(nro_op, valorCuota, totalCuotas, op.cuotas_pagadas || 0, 0);

    const resultado = service.procesarCascadaEnMemoria(opModel, cuotasBase, {
      nro_op,
      id_cobrador: op.cobrador.id_cobrador,
      monto,
      fecha_hora: new Date().toISOString(),
    });

    if (!resultado.exito) {
      return { exito: false, mensaje: resultado.mensaje };
    }

    // Actualizar cuotas
    const cuotasActualizadas: CuotaModel[] = cuotasBase.map(c => {
      const afectada = resultado.detalle_completo_imputacion.find(d => d.id_cuota === c.id_cuota);
      if (afectada) {
        return {
          ...c,
          monto_pagado: afectada.nuevo_monto_pagado,
          estado: afectada.nuevo_estado,
          fecha_pago_efectivo: new Date().toISOString().split('T')[0],
        };
      }
      return c;
    });

    const pagadasPorCuota = cuotasActualizadas.filter(c => c.estado === 'PAGADA').length;
    const pagadasPorMonto = Math.max(0, Math.round((Number(op.monto_total || totalCuotas * valorCuota) - resultado.nuevo_saldo) / valorCuota));
    const cuotasPagadas = Math.max(pagadasPorCuota, pagadasPorMonto);
    const cuotasPendientes = Math.max(0, totalCuotas - cuotasPagadas);
    const proximoVto = cuotasActualizadas
      .filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
      .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]
      ?.fecha_vencimiento ?? null;

    const opActualizada: OperacionConMora = {
      ...op,
      cuotas: cuotasActualizadas,
      saldo_restante: resultado.nuevo_saldo,
      mora: resultado.alerta_mora_actualizada,
      cuotas_totales: totalCuotas,
      cuotas_pagadas: cuotasPagadas,
      cuotas_pendientes: cuotasPendientes,
      proximo_vencimiento: proximoVto,
    };

    // Guardar en cartera
    const nuevasOps = operaciones.map(o => o.nro_op === nro_op ? opActualizada : o);
    guardarOperaciones(nuevasOps);

    // Registrar en historial local
    try {
      const histStr = localStorage.getItem(STORAGE_HISTORIAL_COBROS);
      const hist: RegistroHistorialCobro[] = histStr ? JSON.parse(histStr) : [];
      hist.unshift({
        id_cobro: Date.now(),
        nro_op,
        fecha_hora: new Date().toISOString(),
        monto_cobrado: monto,
        cuotas_equivalentes: resultado.cuotas_equivalentes,
        cobradores: { nombre: op.cobrador.nombre },
        observacion: `Cobro imputado en cascada (${resultado.cuotas_totalmente_canceladas.length} cuotas canceladas)`
      });
      localStorage.setItem(STORAGE_HISTORIAL_COBROS, JSON.stringify(hist.slice(0, 100)));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch {}

    // Intentar sync en Supabase de fondo
    if (supabase) {
      service.registrarCobroEnSupabase({
        nro_op,
        id_cobrador: op.cobrador.id_cobrador,
        monto,
      }).catch(err => console.warn('Sync cobro Supabase background:', err));
    }

    return { exito: true, mensaje: resultado.mensaje };
  }, [operaciones, guardarOperaciones]);

  /* Registrar visita infructuosa */
  const registrarVisita = useCallback(async (nro_op: number, motivo: string, observacion: string) => {
    const op = operaciones.find(o => o.nro_op === nro_op);
    if (!op) return;

    try {
      const histStr = localStorage.getItem(STORAGE_HISTORIAL_COBROS);
      const hist: RegistroHistorialCobro[] = histStr ? JSON.parse(histStr) : [];
      hist.unshift({
        id_cobro: Date.now(),
        nro_op,
        fecha_hora: new Date().toISOString(),
        monto_cobrado: 0,
        cuotas_equivalentes: 0,
        motivo_no_pago: motivo,
        observacion: observacion || 'Visita infructuosa registrada',
        cobradores: { nombre: op.cobrador.nombre }
      });
      localStorage.setItem(STORAGE_HISTORIAL_COBROS, JSON.stringify(hist.slice(0, 100)));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch {}

    if (supabase) {
      const service = new PaymentCascadeService(supabase as any);
      service.registrarVisitaSinPago({
        nro_op,
        id_cobrador: op.cobrador.id_cobrador,
        motivo: motivo as any,
        observacion: observacion || undefined,
      }).catch(err => console.warn('Sync visita Supabase background:', err));
    }
  }, [operaciones]);

  /* Obtener historial de cobros local para una operación */
  const obtenerHistorial = useCallback((nro_op: number): RegistroHistorialCobro[] => {
    try {
      const histStr = localStorage.getItem(STORAGE_HISTORIAL_COBROS);
      if (histStr) {
        const hist: RegistroHistorialCobro[] = JSON.parse(histStr);
        return hist.filter(h => h.nro_op === nro_op);
      }
    } catch {}
    return [];
  }, []);

  /* Carga inicial y suscripción real-time */
  useEffect(() => {
    cargarOperaciones();
    cargarCobradores();

    const refrescarDesdeStorage = () => {
      try {
        const raw = localStorage.getItem(STORAGE_CARTERA_OPERACIONES);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setOperaciones(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('credit_on_storage_update', refrescarDesdeStorage);
    window.addEventListener('storage', refrescarDesdeStorage);
    window.addEventListener('focus', refrescarDesdeStorage);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('cartera-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cobros' }, () => {
          cargarOperaciones();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cuotas' }, () => {
          cargarOperaciones();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('credit_on_storage_update', refrescarDesdeStorage);
      window.removeEventListener('storage', refrescarDesdeStorage);
      window.removeEventListener('focus', refrescarDesdeStorage);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [cargarOperaciones, cargarCobradores]);

  return {
    operaciones: operacionesFiltradas,
    todasLasOperaciones: operaciones,
    cobradores: todosLosCobradores,
    filtros,
    setFiltros,
    indicadores,
    loading,
    error,
    refetch: cargarOperaciones,
    guardarOperaciones,
    agregarOperacion,
    eliminarOperacion,
    vaciarCartera,
    restaurarDemo,
    registrarCobro,
    registrarVisita,
    obtenerHistorial,
  };
}
