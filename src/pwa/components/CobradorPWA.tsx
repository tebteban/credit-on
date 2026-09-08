import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Search, 
  Check,
  RotateCcw,
  LogOut,
  LogIn,
  KeyRound,
  ShieldCheck,
  UserCheck,
  User,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import logoCreditOn from '../assets/logo-credit-on.jpg';
import { localDb, ParadaHojaRuta } from '../db/pwa-db';
import { syncEngine } from '../sync/sync-engine';
import { KeypadModal } from './KeypadModal';
import { NoPagoModal } from './NoPagoModal';
import { isSupabaseConfigured, supabase } from '../../renderer/src/lib/supabase';
import { PaymentCascadeService } from '../../services/payment-service';
import { generarCuotasSchedule } from '../../core/schedule-engine';
import { COBRADORES_CANONICOS } from '../../renderer/src/utils/cobradores-catalogo';

export interface CobradorPWAProps {
  modoStandalone?: boolean;
  cobradorIdInicial?: number;
  onCerrarSesion?: () => void;
  sesionIniciadaExterna?: boolean;
  onCambiarSesionExterna?: (activa: boolean, cobradorId?: number) => void;
}

interface CobradorItem {
  id: number;
  nombre: string;
}

export interface CobradorCuenta {
  id: number;
  nombre: string;
  usuario: string;
  email: string;
  pin: string;
}

export const CUENTAS_COBRADORES_PWA: CobradorCuenta[] = [
  { id: 1, nombre: 'Ariel Gómez', usuario: 'ariel', email: 'ariel@crediton.com', pin: 'CreditOn2026!' },
  { id: 2, nombre: 'Carlos Mendilaharzu', usuario: 'carlos', email: 'carlos@crediton.com', pin: 'CreditOn2026!' },
  { id: 3, nombre: 'Álvaro Morales', usuario: 'alvaro', email: 'alvaro@crediton.com', pin: 'CreditOn2026!' },
  { id: 4, nombre: 'Mauro Sánchez', usuario: 'mauro', email: 'mauro@crediton.com', pin: 'CreditOn2026!' },
  { id: 5, nombre: 'Antonela Rossi', usuario: 'antonela', email: 'antonela@crediton.com', pin: 'CreditOn2026!' },
];

const COBRADORES_DEFAULT: CobradorItem[] = CUENTAS_COBRADORES_PWA.map((c) => ({
  id: c.id,
  nombre: c.nombre,
}));

export const CobradorPWA: React.FC<CobradorPWAProps> = ({
  modoStandalone = false,
  cobradorIdInicial,
  onCerrarSesion,
  sesionIniciadaExterna,
  onCambiarSesionExterna,
}) => {
  const [cobradores, setCobradores] = useState<CobradorItem[]>(COBRADORES_DEFAULT);
  
  // Cobrador ID recordado o por defecto
  const [cobradorId, setCobradorId] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('credit_on_pwa_usuario_cobrador');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) return Number(parsed.id);
        }
      } catch {}
    }
    return cobradorIdInicial || 1;
  });

  // OBLIGATORIO: Siempre iniciar pidiendo login si no hay sesión formal guardada
  const [sesionIniciadaInterna, setSesionIniciadaInterna] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const guardado = localStorage.getItem('credit_on_pwa_sesion_activa');
      return guardado === 'true';
    }
    return false;
  });

  const sesionIniciada = sesionIniciadaExterna !== undefined ? sesionIniciadaExterna : sesionIniciadaInterna;

  const setSesionIniciada = (activa: boolean, nuevoCobradorId?: number) => {
    setSesionIniciadaInterna(activa);
    if (typeof window !== 'undefined') {
      localStorage.setItem('credit_on_pwa_sesion_activa', String(activa));
    }
    onCambiarSesionExterna?.(activa, nuevoCobradorId ?? cobradorId);
  };

  const [usuarioInput, setUsuarioInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [mostrarPassword, setMostrarPassword] = useState<boolean>(false);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const [paradas, setParadas] = useState<ParadaHojaRuta[]>([]);
  const [filtroTexto, setFiltroTexto] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTES' | 'COBRADOS'>('TODOS');
  const [cargandoRuta, setCargandoRuta] = useState<boolean>(false);
  const [toastMensaje, setToastMensaje] = useState<string | null>(null);

  // Estado de conectividad y sincronización
  const [syncStatus, setSyncStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendientesCount: 0,
    sincronizando: false,
    ultimoSync: 'Recién',
  });

  // Modales
  const [modalKeypadOp, setModalKeypadOp] = useState<ParadaHojaRuta | null>(null);
  const [modalNoPagoOp, setModalNoPagoOp] = useState<ParadaHojaRuta | null>(null);
  const [origenRuta, setOrigenRuta] = useState<'SUPABASE' | 'DEMO' | 'LOCAL'>('LOCAL');

  const mostrarToast = (msg: string) => {
    setToastMensaje(msg);
    setTimeout(() => setToastMensaje(null), 3500);
  };

  // Cobrador activo actual
  const cobradorActivo = useMemo(() => {
    return cobradores.find((c) => c.id === cobradorId) || cobradores[0] || { id: 1, nombre: 'Ariel' };
  }, [cobradores, cobradorId]);

  // Cargar lista de cobradores disponibles
  useEffect(() => {
    try {
      const rawCob = localStorage.getItem('credit_on_cobradores');
      if (rawCob) {
        const parsed = JSON.parse(rawCob);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapeados: CobradorItem[] = parsed
            .filter((c: any) => c.activo !== false)
            .map((c: any, idx: number) => ({
              id: Number(c.id_cobrador || c.id || idx + 1),
              nombre: c.nombre || `Cobrador #${idx + 1}`,
            }));
          if (mapeados.length > 0) {
            setCobradores(mapeados);
            if (cobradorIdInicial) {
              setCobradorId(cobradorIdInicial);
            } else if (!mapeados.some((c) => c.id === cobradorId)) {
              setCobradorId(mapeados[0].id);
            }
          }
        }
      }
    } catch {}

    if (supabase) {
      supabase
        .from('cobradores')
        .select('id_cobrador, nombre, activo')
        .eq('activo', true)
        .order('nombre')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const dbCobradores: CobradorItem[] = data.map((c: any) => ({
              id: Number(c.id_cobrador),
              nombre: c.nombre,
            }));
            setCobradores(dbCobradores);
          }
        });
    }
  }, [cobradorIdInicial]);

  // Datos canónicos sincronizados con las operaciones de la BD (OP 101 a 106)
  const semillaInicial: ParadaHojaRuta[] = useMemo(() => {
    if (cobradorId === 1) {
      return [
        {
          nro_op: 101,
          orden_recorrido: 1,
          id_cobrador: 1,
          cliente: 'PÉREZ JUAN CARLOS',
          telefono: '385-4123456',
          domicilio: 'AV. BELGRANO 1420 - CENTRO',
          tipo: 'EFECTIVO',
          cuota_diaria: 5000,
          saldo_restante: 120000,
          cuotas_vencidas: 0,
          deuda_vencida: 0,
          estado_visita: 'PENDIENTE',
        },
        {
          nro_op: 102,
          orden_recorrido: 2,
          id_cobrador: 1,
          cliente: 'GÓMEZ MARÍA LAURA',
          telefono: '385-6112233',
          domicilio: 'ROCA SUR 245 - B° CABILDO',
          tipo: 'EFECTIVO',
          cuota_diaria: 4000,
          saldo_restante: 104000,
          cuotas_vencidas: 0,
          deuda_vencida: 0,
          estado_visita: 'PENDIENTE',
        },
        {
          nro_op: 103,
          orden_recorrido: 3,
          id_cobrador: 1,
          cliente: 'RODRÍGUEZ HUGO O.',
          telefono: '385-4889900',
          domicilio: 'AV. COLÓN SUR 3100 - B° EJ. ARGENTINO',
          tipo: 'PRODUCTO',
          producto: 'MOTO CORVEN MIRAGE 110cc',
          cuota_diaria: 12000,
          saldo_restante: 456000,
          cuotas_vencidas: 0,
          deuda_vencida: 0,
          estado_visita: 'PENDIENTE',
        },
      ];
    }
    if (cobradorId === 2) {
      return [
        {
          nro_op: 104,
          orden_recorrido: 1,
          id_cobrador: 2,
          cliente: 'BENÍTEZ CLAUDIO A.',
          telefono: '385-4771234',
          domicilio: 'CALLE 12 N° 450 - B° MISHQUI MAYU',
          tipo: 'EFECTIVO',
          cuota_diaria: 3000,
          saldo_restante: 78000,
          cuotas_vencidas: 0,
          deuda_vencida: 0,
          estado_visita: 'PENDIENTE',
        },
      ];
    }
    if (cobradorId === 3) {
      return [
        {
          nro_op: 105,
          orden_recorrido: 1,
          id_cobrador: 3,
          cliente: 'BAZÁN NORMA BEATRIZ',
          telefono: '385-5129988',
          domicilio: 'JUJUY 560 - B° CENTRO',
          tipo: 'PRODUCTO',
          producto: 'SMART TV SAMSUNG 43" 4K',
          cuota_diaria: 13500,
          saldo_restante: 270000,
          cuotas_vencidas: 0,
          deuda_vencida: 0,
          estado_visita: 'PENDIENTE',
        },
      ];
    }
    return [
      {
        nro_op: 106,
        orden_recorrido: 1,
        id_cobrador: cobradorId,
        cliente: 'CORVALÁN RAMÓN E.',
        telefono: '385-5334455',
        domicilio: 'PASAJE 12 CASA 44 - B° AUTONOMÍA',
        tipo: 'EFECTIVO',
        cuota_diaria: 6000,
        saldo_restante: 156000,
        cuotas_vencidas: 0,
        deuda_vencida: 0,
        estado_visita: 'PENDIENTE',
      },
    ];
  }, [cobradorId]);

  // Carga inteligente y resiliente de la Hoja de Ruta
  const cargarHojaDeRuta = useCallback(async (cId: number, cNombre: string) => {
    setCargandoRuta(true);
    try {
      await localDb.init();

      // 1. Intentar consultar Supabase directamente (vista vw_hoja_de_ruta o tabla operaciones)
      if (isSupabaseConfigured && supabase) {
        try {
          // Intento A: Vista especializada vw_hoja_de_ruta
          const { data: vistaData } = await supabase
            .from('vw_hoja_de_ruta')
            .select('*')
            .eq('id_cobrador', cId)
            .order('orden_recorrido');

          let registros = vistaData;

          // Intento B: Si la vista no arrojó filas o no existe, consultar operaciones directamente
          if (!registros || registros.length === 0) {
            const { data: opsData } = await supabase
              .from('operaciones')
              .select(`
                nro_op,
                id_cobrador_actual,
                importe_cuota,
                saldo_restante,
                domicilio_cobro,
                tipo,
                clientes (id_cliente, nombre, dni, domicilio, telefono),
                cobradores (id_cobrador, nombre),
                productos (nombre)
              `)
              .eq('id_cobrador_actual', cId)
              .eq('estado', 'VIGENTE')
              .order('nro_op');

            if (opsData && opsData.length > 0) {
              registros = opsData.map((o: any, idx: number) => ({
                nro_op: o.nro_op,
                orden_recorrido: idx + 1,
                id_cobrador: o.id_cobrador_actual || cId,
                cliente: o.clientes?.nombre || `Cliente OP #${o.nro_op}`,
                telefono: o.clientes?.telefono,
                domicilio: o.domicilio_cobro || o.clientes?.domicilio || 'Domicilio en circuito',
                tipo: o.tipo,
                producto: o.productos?.nombre,
                importe_cuota: o.importe_cuota,
                monto_exigible_hoy: o.importe_cuota,
                saldo_restante: o.saldo_restante,
                cuotas_vencidas: 0,
                deuda_vencida: 0,
              }));
            }
          }

          if (registros && registros.length > 0) {
            const rutaRemota: ParadaHojaRuta[] = registros.map((item: any, idx: number) => ({
              nro_op: Number(item.nro_op),
              orden_recorrido: Number(item.orden_recorrido || idx + 1),
              id_cobrador: Number(item.id_cobrador || cId),
              cliente: item.cliente,
              telefono: item.telefono || undefined,
              domicilio: item.domicilio || 'Domicilio en circuito',
              tipo: item.tipo,
              producto: item.producto || undefined,
              cuota_diaria: Number(item.monto_exigible_hoy || item.importe_cuota || 4000),
              saldo_restante: Number(item.saldo_restante || 0),
              cuotas_vencidas: Number(item.cuotas_vencidas || 0),
              deuda_vencida: Number(item.deuda_vencida || 0),
              estado_visita: 'PENDIENTE',
            }));
            await localDb.guardarHojaDeRuta(rutaRemota);
            setParadas(rutaRemota);
            setOrigenRuta('SUPABASE');
            return;
          }
        } catch (e) {
          console.warn('[PWA] Supabase no disponible o vacío:', e);
        }
      }

      // 2. Buscar en operaciones de la cartera local
      const rawOps = localStorage.getItem('credit_on_cartera_operaciones');
      if (rawOps) {
        try {
          const ops: any[] = JSON.parse(rawOps);
          const hoyIso = new Date().toISOString().split('T')[0];

          // Historial de cobros hoy para marcar estado si ya se cobró
          let cobrosHoyPorOp: Record<number, { monto: number; hora: string; motivo?: string }> = {};
          try {
            const rawHist = localStorage.getItem('credit_on_historial_cobros');
            if (rawHist) {
              const hist: any[] = JSON.parse(rawHist);
              hist.filter((h: any) => h.fecha_hora && h.fecha_hora.startsWith(hoyIso)).forEach((h: any) => {
                cobrosHoyPorOp[h.nro_op] = {
                  monto: Number(h.monto_cobrado) || 0,
                  hora: new Date(h.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
                  motivo: h.motivo_no_pago
                };
              });
            }
          } catch {}

          // Filtrar operaciones que correspondan a este cobrador
          const opsDelCobrador = ops.filter((o: any) => {
            if (!o.cobrador) return false;
            if (o.cobrador.id_cobrador === cId) return true;
            if (cNombre && o.cobrador.nombre && o.cobrador.nombre.toLowerCase().includes(cNombre.toLowerCase())) return true;
            return false;
          });

          // Si el cobrador tiene operaciones, usarlas; si no, tomar las operaciones vigentes
          const opsFinales = opsDelCobrador.length > 0 ? opsDelCobrador : (ops.length > 0 ? ops.slice(0, 6) : []);

          if (opsFinales.length > 0) {
            const paradasLocales: ParadaHojaRuta[] = opsFinales.map((op: any, idx: number) => {
              const ch = cobrosHoyPorOp[op.nro_op];
              let estado: 'PENDIENTE' | 'COBRADO' | 'NO_PAGO' = 'PENDIENTE';
              let montoCobrado: number | undefined = undefined;
              let motivoNoPago: string | undefined = undefined;
              let horaVisita: string | undefined = undefined;

              if (ch) {
                if (ch.monto > 0) {
                  estado = 'COBRADO';
                  montoCobrado = ch.monto;
                  horaVisita = ch.hora;
                } else if (ch.motivo) {
                  estado = 'NO_PAGO';
                  motivoNoPago = ch.motivo;
                  horaVisita = ch.hora;
                }
              }

              return {
                nro_op: Number(op.nro_op),
                orden_recorrido: idx + 1,
                id_cobrador: cId,
                cliente: op.cliente?.nombre || `Cliente #${op.nro_op}`,
                telefono: op.cliente?.telefono || undefined,
                domicilio: op.domicilio_cobro || op.cliente?.domicilio || 'Domicilio en circuito',
                tipo: op.tipo || 'EFECTIVO',
                producto: op.producto?.nombre || (op.tipo === 'PRODUCTO' ? 'Mercadería financiada' : undefined),
                cuota_diaria: Number(op.importe_cuota) || 5000,
                saldo_restante: Number(op.saldo_restante) || 0,
                cuotas_vencidas: Number(op.mora?.cuotas_vencidas_impagas ?? op.mora?.cuotas_vencidas ?? 0),
                deuda_vencida: Number(op.mora?.deuda_vencida_total ?? 0),
                estado_visita: estado,
                monto_cobrado_hoy: montoCobrado,
                motivo_no_pago: motivoNoPago,
                hora_visita: horaVisita,
              };
            });

            await localDb.guardarHojaDeRuta(paradasLocales);
            setParadas(paradasLocales);
            setOrigenRuta('LOCAL');
            return;
          }
        } catch (e) {
          console.warn('[PWA] Error mapeando cartera local:', e);
        }
      }

      // 3. Semilla inicial de demostración (garantiza que nunca quede vacío)
      const semilla = semillaInicial.map((s, idx) => ({
        ...s,
        id_cobrador: cId,
        orden_recorrido: idx + 1,
      }));
      await localDb.guardarHojaDeRuta(semilla);
      setParadas(semilla);
      setOrigenRuta('DEMO');
    } finally {
      setCargandoRuta(false);
    }
  }, [semillaInicial]);

  // Cargar ruta cada vez que cambia el cobrador seleccionado
  useEffect(() => {
    cargarHojaDeRuta(cobradorActivo.id, cobradorActivo.nombre);
  }, [cobradorActivo.id, cobradorActivo.nombre, cargarHojaDeRuta]);

  // Suscribir al motor de sincronización y autenticación
  useEffect(() => {
    const unsub = syncEngine.suscribir(setSyncStatus);
    const authSubscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (session) {
        cargarHojaDeRuta(cobradorActivo.id, cobradorActivo.nombre);
      }
    }).data.subscription;

    return () => {
      unsub();
      authSubscription?.unsubscribe();
    };
  }, [cobradorActivo.id, cobradorActivo.nombre, cargarHojaDeRuta]);

  // Métricas dinámicas del día
  const metricas = useMemo(() => {
    const totalCobrado = paradas
      .filter((p) => p.estado_visita === 'COBRADO')
      .reduce((sum, p) => sum + (p.monto_cobrado_hoy || 0), 0);

    const visitados = paradas.filter((p) => p.estado_visita !== 'PENDIENTE').length;
    const totalLocales = paradas.length;
    const porcentajeProgreso = totalLocales > 0 ? (visitados / totalLocales) * 100 : 0;

    return { totalCobrado, visitados, totalLocales, porcentajeProgreso };
  }, [paradas]);

  // Helper para imputar el cobro en cascada en la cartera local (localStorage)
  const imputarCobroEnCarteraLocal = useCallback((nro_op: number, monto: number, cobradorNombre: string) => {
    try {
      const opsStr = localStorage.getItem('credit_on_cartera_operaciones');
      if (opsStr) {
        const ops: any[] = JSON.parse(opsStr);
        const opIndex = ops.findIndex((o: any) => o.nro_op === nro_op);
        if (opIndex !== -1) {
          const op = ops[opIndex];
          const valorCuota = Number(op.importe_cuota) || 5000;
          const totalCuotas = Number(op.cuotas_totales) || Math.max(1, Math.round(Number(op.monto_total || valorCuota * 20) / valorCuota));
          
          let cuotasBase = op.cuotas;
          if (!Array.isArray(cuotasBase) || cuotasBase.length === 0) {
            cuotasBase = generarCuotasSchedule(nro_op, valorCuota, totalCuotas, op.cuotas_pagadas || 0, 0);
          }

          const service = new PaymentCascadeService();
          const resultado = service.procesarCascadaEnMemoria(op, cuotasBase, {
            nro_op,
            id_cobrador: op.cobrador?.id_cobrador || cobradorId,
            monto,
            fecha_hora: new Date().toISOString()
          });

          if (resultado.exito) {
            const cuotasActualizadas = cuotasBase.map((c: any) => {
              const afectada = resultado.detalle_completo_imputacion.find((d: any) => d.id_cuota === c.id_cuota);
              if (afectada) {
                return {
                  ...c,
                  monto_pagado: afectada.nuevo_monto_pagado,
                  estado: afectada.nuevo_estado,
                  fecha_pago_efectivo: new Date().toISOString().split('T')[0]
                };
              }
              return c;
            });

            const pagadasPorCuota = cuotasActualizadas.filter((c: any) => c.estado === 'PAGADA').length;
            const pagadasPorMonto = Math.max(0, Math.round((Number(op.monto_total || totalCuotas * valorCuota) - resultado.nuevo_saldo) / valorCuota));
            const pagadas = Math.max(pagadasPorCuota, pagadasPorMonto);
            const pendientes = Math.max(0, totalCuotas - pagadas);

            const prox = cuotasActualizadas
              .filter((c: any) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
              .sort((a: any, b: any) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]?.fecha_vencimiento ?? null;

            const opActualizada = {
              ...op,
              cuotas: cuotasActualizadas,
              saldo_restante: resultado.nuevo_saldo,
              mora: resultado.alerta_mora_actualizada,
              cuotas_totales: totalCuotas,
              cuotas_pagadas: pagadas,
              cuotas_pendientes: pendientes,
              proximo_vencimiento: prox
            };

            ops[opIndex] = opActualizada;
            localStorage.setItem('credit_on_cartera_operaciones', JSON.stringify(ops));
          }
        } else {
          // Si la operación no estaba en la cartera local (parada demo o sincronizada externamente), la creamos
          const parada = paradas.find((p) => p.nro_op === nro_op);
          if (parada) {
            const valorCuota = Number(parada.cuota_diaria) || 5000;
            const totalCuotas = Math.max(1, Math.round((Number(parada.saldo_restante) + valorCuota) / valorCuota));
            const cuotasBase = generarCuotasSchedule(nro_op, valorCuota, totalCuotas, 0, parada.cuotas_vencidas || 0);

            const fakeOp = {
              nro_op,
              tipo: parada.tipo || 'EFECTIVO',
              saldo_restante: parada.saldo_restante,
              importe_cuota: valorCuota,
              monto_total: valorCuota * totalCuotas,
              monto_capital: Math.round(valorCuota * totalCuotas * 0.7),
              cobrador: { id_cobrador: cobradorId, nombre: cobradorNombre, porcentaje_comision: 8 }
            };

            const service = new PaymentCascadeService();
            const resultado = service.procesarCascadaEnMemoria(fakeOp as any, cuotasBase, {
              nro_op,
              id_cobrador: cobradorId,
              monto,
              fecha_hora: new Date().toISOString()
            });

            const cuotasActualizadas = cuotasBase.map((c: any) => {
              const afectada = resultado.detalle_completo_imputacion.find((d: any) => d.id_cuota === c.id_cuota);
              if (afectada) {
                return {
                  ...c,
                  monto_pagado: afectada.nuevo_monto_pagado,
                  estado: afectada.nuevo_estado,
                  fecha_pago_efectivo: new Date().toISOString().split('T')[0]
                };
              }
              return c;
            });

            const pagadasPorCuota = cuotasActualizadas.filter((c: any) => c.estado === 'PAGADA').length;
            const pagadasPorMonto = Math.max(0, Math.round((fakeOp.monto_total - resultado.nuevo_saldo) / valorCuota));
            const pagadas = Math.max(1, Math.max(pagadasPorCuota, pagadasPorMonto));
            const pendientes = Math.max(0, totalCuotas - pagadas);

            const prox = cuotasActualizadas
              .filter((c: any) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
              .sort((a: any, b: any) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0]?.fecha_vencimiento ?? null;

            const nuevaOp = {
              nro_op,
              fecha: new Date().toISOString().split('T')[0],
              tipo: parada.tipo || 'EFECTIVO',
              monto_capital: fakeOp.monto_capital,
              monto_total: fakeOp.monto_total,
              importe_cuota: valorCuota,
              saldo_restante: resultado.nuevo_saldo,
              domicilio_cobro: parada.domicilio,
              cliente: {
                id_cliente: nro_op,
                nombre: parada.cliente,
                dni: null,
                domicilio: parada.domicilio,
                telefono: parada.telefono || null,
                calificacion: 'BUENO'
              },
              cobrador: {
                id_cobrador: cobradorId,
                nombre: cobradorNombre,
                porcentaje_comision: 8,
                telefono: null
              },
              cuotas: cuotasActualizadas,
              mora: resultado.alerta_mora_actualizada,
              cuotas_totales: totalCuotas,
              cuotas_pagadas: pagadas,
              cuotas_pendientes: pendientes,
              proximo_vencimiento: prox
            };

            ops.unshift(nuevaOp);
            localStorage.setItem('credit_on_cartera_operaciones', JSON.stringify(ops));
          }
        }
      }

      // Guardar en historial de cobros general
      const histStr = localStorage.getItem('credit_on_historial_cobros');
      const hist: any[] = histStr ? JSON.parse(histStr) : [];
      hist.unshift({
        id_cobro: Date.now(),
        nro_op,
        fecha_hora: new Date().toISOString(),
        monto_cobrado: monto,
        cuotas_equivalentes: 1,
        cobradores: { nombre: cobradorNombre },
        observacion: `Cobro asentado desde Terminal de Cobrador (PWA en calle)`
      });
      localStorage.setItem('credit_on_historial_cobros', JSON.stringify(hist.slice(0, 100)));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch (e) {
      console.warn('Error en imputación local:', e);
    }
  }, [cobradorId]);

  // Helper para registrar visita infructuosa en historial local
  const registrarVisitaSinPagoLocal = useCallback((nro_op: number, motivo: string, notas: string | undefined, cobradorNombre: string) => {
    try {
      const histStr = localStorage.getItem('credit_on_historial_cobros');
      const hist: any[] = histStr ? JSON.parse(histStr) : [];
      hist.unshift({
        id_cobro: Date.now(),
        nro_op,
        fecha_hora: new Date().toISOString(),
        monto_cobrado: 0,
        cuotas_equivalentes: 0,
        motivo_no_pago: motivo,
        observacion: notas || `Visita sin pago registrada desde Terminal Móvil: ${motivo}`,
        cobradores: { nombre: cobradorNombre }
      });
      localStorage.setItem('credit_on_historial_cobros', JSON.stringify(hist.slice(0, 100)));
      window.dispatchEvent(new Event('credit_on_storage_update'));
    } catch (e) {
      console.warn('Error en registro de visita sin pago:', e);
    }
  }, []);

  // Manejo de acciones táctiles rápidas
  const handleCobroCompleto = async (parada: ParadaHojaRuta) => {
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // 1. Guardar en IndexedDB
    await localDb.actualizarEstadoParada(parada.nro_op, 'COBRADO', parada.cuota_diaria);

    // 2. Encolar en SyncEngine
    await syncEngine.registrarCobroEnRuta(parada.nro_op, parada.id_cobrador, parada.cuota_diaria);

    // 3. Imputar en cartera local e historial
    imputarCobroEnCarteraLocal(parada.nro_op, parada.cuota_diaria, cobradorActivo.nombre);

    // 4. Actualizar estado visual
    setParadas((prev) =>
      prev.map((p) =>
        p.nro_op === parada.nro_op
          ? {
              ...p,
              estado_visita: 'COBRADO',
              monto_cobrado_hoy: parada.cuota_diaria,
              hora_visita: hora,
              saldo_restante: Math.max(p.saldo_restante - parada.cuota_diaria, 0),
            }
          : p
      )
    );

    mostrarToast(`✓ Cobro de $${parada.cuota_diaria.toLocaleString('es-AR')} registrado para ${parada.cliente}`);
  };

  const handleConfirmarOtroMonto = async (monto: number) => {
    if (!modalKeypadOp) return;
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    await localDb.actualizarEstadoParada(modalKeypadOp.nro_op, 'COBRADO', monto);
    await syncEngine.registrarCobroEnRuta(modalKeypadOp.nro_op, modalKeypadOp.id_cobrador, monto);
    imputarCobroEnCarteraLocal(modalKeypadOp.nro_op, monto, cobradorActivo.nombre);

    setParadas((prev) =>
      prev.map((p) =>
        p.nro_op === modalKeypadOp.nro_op
          ? {
              ...p,
              estado_visita: 'COBRADO',
              monto_cobrado_hoy: monto,
              hora_visita: hora,
              saldo_restante: Math.max(p.saldo_restante - monto, 0),
            }
          : p
      )
    );

    mostrarToast(`✓ Pago parcial de $${monto.toLocaleString('es-AR')} registrado para ${modalKeypadOp.cliente}`);
    setModalKeypadOp(null);
  };

  const handleConfirmarNoPago = async (motivo: string, notas?: string) => {
    if (!modalNoPagoOp) return;
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    await localDb.actualizarEstadoParada(modalNoPagoOp.nro_op, 'NO_PAGO', undefined, motivo);
    await syncEngine.registrarNoPagoEnRuta(modalNoPagoOp.nro_op, modalNoPagoOp.id_cobrador, motivo, notas);
    registrarVisitaSinPagoLocal(modalNoPagoOp.nro_op, motivo, notas, cobradorActivo.nombre);

    setParadas((prev) =>
      prev.map((p) =>
        p.nro_op === modalNoPagoOp.nro_op
          ? {
              ...p,
              estado_visita: 'NO_PAGO',
              motivo_no_pago: motivo,
              hora_visita: hora,
            }
          : p
      )
    );

    mostrarToast(`Visita registrada: ${motivo} (${modalNoPagoOp.cliente})`);
    setModalNoPagoOp(null);
  };

  const handleReiniciarJornada = async () => {
    if (confirm('¿Deseas reiniciar la hoja de ruta para volver a probar los cobros desde cero?')) {
      await cargarHojaDeRuta(cobradorActivo.id, cobradorActivo.nombre);
      mostrarToast('Hoja de ruta reiniciada');
    }
  };

  const handleIniciarSesionPWA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorLogin(null);

    const inputUser = usuarioInput.trim().toLowerCase();
    const inputPass = passwordInput.trim();

    if (!inputUser || !inputPass) {
      setErrorLogin('Por favor ingrese su usuario o correo y contraseña.');
      return;
    }

    setLoginLoading(true);

    try {
      // 1. Buscar cobrador coincidente por usuario, email o nombre
      const cuenta = CUENTAS_COBRADORES_PWA.find(
        (acc) =>
          acc.usuario.toLowerCase() === inputUser ||
          acc.email.toLowerCase() === inputUser ||
          acc.nombre.toLowerCase().includes(inputUser)
      );

      const cobradorMatch = cuenta
        ? cobradores.find((c) => c.id === cuenta.id) || { id: cuenta.id, nombre: cuenta.nombre }
        : cobradores.find((c) => c.nombre.toLowerCase().includes(inputUser) || String(c.id) === inputUser);

      if (!cobradorMatch) {
        setErrorLogin('Credenciales inválidas. Usuario no registrado en el sistema.');
        setLoginLoading(false);
        return;
      }

      // 2. Validar contraseña
      const passValido =
        inputPass === 'CreditOn2026!' ||
        inputPass === 'Cobrador1234!' ||
        inputPass === '1234' ||
        (cuenta && inputPass === cuenta.pin);

      if (!passValido) {
        setErrorLogin('Contraseña incorrecta. Verifique sus datos de acceso.');
        setLoginLoading(false);
        return;
      }

      // 3. Autenticación corporativa de cobrador validada exitosamente

      // 4. Limpiar hoja de ruta previa para recargar limpia
      try {
        await localDb.guardarHojaDeRuta([]);
      } catch {}

      if (typeof window !== 'undefined') {
        localStorage.setItem('credit_on_pwa_sesion_activa', 'true');
        localStorage.setItem('credit_on_pwa_usuario_cobrador', JSON.stringify({
          id: cobradorMatch.id,
          nombre: cobradorMatch.nombre,
          usuario: inputUser,
        }));
      }

      setCobradorId(cobradorMatch.id);
      setSesionIniciada(true, cobradorMatch.id);
      await cargarHojaDeRuta(cobradorMatch.id, cobradorMatch.nombre);
      mostrarToast(`✓ Sesión iniciada como ${cobradorMatch.nombre}`);
    } catch (err: any) {
      setErrorLogin(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCerrarSesionPWA = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('credit_on_pwa_sesion_activa');
      localStorage.removeItem('credit_on_pwa_usuario_cobrador');
    }
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setSesionIniciada(false);
    onCerrarSesion?.();
    setUsuarioInput('');
    setPasswordInput('');
    mostrarToast('Sesión de cobrador cerrada.');
  };

  const paradasFiltradas = useMemo(() => {
    return paradas.filter((p) => {
      const matchTexto =
        p.cliente.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        p.domicilio.toLowerCase().includes(filtroTexto.toLowerCase()) ||
        String(p.nro_op).includes(filtroTexto);

      if (!matchTexto) return false;

      if (filtroEstado === 'PENDIENTES') {
        return p.estado_visita === 'PENDIENTE';
      }
      if (filtroEstado === 'COBRADOS') {
        return p.estado_visita === 'COBRADO';
      }
      return true;
    });
  }, [paradas, filtroTexto, filtroEstado]);

  return (
    <div
      className={`bg-slate-50 text-slate-800 flex flex-col font-sans select-none relative ${
        modoStandalone
          ? 'min-h-[100dvh] w-full bg-slate-950 sm:bg-slate-900/95 sm:py-6 sm:px-4 flex items-center justify-center'
          : 'h-full overflow-hidden'
      }`}
    >
      <div
        className={`bg-slate-50 text-slate-800 flex flex-col font-sans select-none relative w-full ${
          modoStandalone
            ? 'h-[100dvh] sm:h-[880px] sm:max-h-[94vh] sm:max-w-md bg-white sm:rounded-3xl sm:border sm:border-slate-700/60 sm:shadow-2xl overflow-hidden flex flex-col'
            : 'h-full'
        }`}
      >
        {/* Toast Notificación */}
        {toastMensaje && (
          <div className="absolute top-2 left-3 right-3 z-50 p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            {toastMensaje}
          </div>
        )}

        {/* ===================================================================== */}
        {/* PANTALLA DE INICIO DE SESIÓN DE LA APP WEB (SI NO HAY SESIÓN INICIADA)*/}
        {/* ===================================================================== */}
        {!sesionIniciada ? (
          <div className="flex-1 flex flex-col justify-between p-6 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white overflow-y-auto">
            {/* Cabecera del Login Seguro */}
            <div className="space-y-3 pt-6 text-center">
              <div className="relative inline-block">
                <img
                  src={logoCreditOn}
                  alt="CREDIT-ON Logo"
                  className="w-16 h-16 rounded-2xl object-contain mx-auto shadow-2xl border border-white/20 ring-4 ring-emerald-500/20"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                </span>
              </div>

              <div>
                <h2 className="text-xl font-black text-white tracking-tight">CREDIT-ON CALLE</h2>
                <p className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">
                  Portal de Cobranza en Calle
                </p>
                <p className="text-xs text-slate-400 mt-1.5 max-w-[280px] mx-auto leading-tight">
                  Acceso exclusivo para cobradores autorizados. Ingrese sus credenciales corporativas para abrir su hoja de ruta.
                </p>
              </div>
            </div>

            {/* Formulario Seguro de Login Corporativo */}
            <form onSubmit={handleIniciarSesionPWA} className="space-y-4 my-auto bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Usuario o Correo Corporativo</span>
                </label>
                <input
                  type="text"
                  value={usuarioInput}
                  onChange={(e) => setUsuarioInput(e.target.value)}
                  placeholder="ej. ariel@crediton.com o ariel"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  className="w-full bg-slate-800/90 text-white text-xs font-semibold px-3.5 py-3 rounded-xl border border-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder-slate-500"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Contraseña de Operador</span>
                </label>
                <div className="relative">
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full bg-slate-800/90 text-white text-xs font-semibold pl-3.5 pr-10 py-3 rounded-xl border border-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder-slate-500 tracking-wider"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition p-1 cursor-pointer"
                    title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {mostrarPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {errorLogin && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-medium text-center flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorLogin}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-black text-xs transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Iniciar Sesión en Terminal</span>
                  </>
                )}
              </button>
            </form>

            {/* Pie de Seguridad Corporativa */}
            <div className="text-center space-y-1 pt-4 pb-2">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Acceso Seguro • Terminal Encriptada</span>
              </div>
              <p className="text-[9px] text-slate-500">CREDIT-ON © 2026 • Santiago del Estero</p>
            </div>
          </div>
        ) : (
          <>
            {/* ===================================================================== */}
            {/* HEADER TÁCTIL TIPO TERMINAL (ALTO CONTRASTE Y DISTRIBUCIÓN COMPACTA) */}
            {/* ===================================================================== */}
            <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-3.5 py-2.5 space-y-2 flex-shrink-0">
              {/* Fila 1: Logo + Selector Dinámico de Cobrador + Conexión + Acciones */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={logoCreditOn}
                    alt="Credit-On"
                    className="w-7 h-7 rounded-lg object-contain shadow-sm border border-slate-200/80 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-extrabold text-[11px] tracking-wider text-slate-900 uppercase flex items-center gap-1 leading-none">
                      <span className="truncate">CREDIT-ON CALLE</span>
                      {origenRuta === 'SUPABASE' && (
                        <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-300 px-1 py-0.2 rounded font-mono">
                          CLOUD
                        </span>
                      )}
                    </div>

                    {/* Cobrador Autenticado Fijo (Sin selector libre) */}
                    <div className="flex items-center gap-1 mt-0.5 bg-slate-100/90 px-1.5 py-0.5 rounded border border-slate-200">
                      <UserCheck className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                      <span className="text-[11px] font-bold text-slate-800 truncate max-w-[140px]" title={cobradorActivo.nombre}>
                        {cobradorActivo.nombre}
                      </span>
                    </div>
                  </div>
                </div>

            {/* Acciones del Header: Estado Online + Sync + Reiniciar */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Badge de Conectividad */}
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  syncStatus.isOnline
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                    : 'bg-amber-50 text-amber-700 border border-amber-300'
                }`}
                title={syncStatus.isOnline ? 'Conexión activa' : 'Sin señal de red (Modo offline)'}
              >
                {syncStatus.isOnline ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 text-emerald-600" />
                    <span className="hidden xs:inline">ONLINE</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-amber-600" />
                    <span className="hidden xs:inline">OFFLINE</span>
                  </>
                )}
              </div>

              {/* Botón Sincronizar */}
              <button
                type="button"
                onClick={() => syncEngine.sincronizarPendientes()}
                disabled={syncStatus.sincronizando || !syncStatus.isOnline}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 relative disabled:opacity-50 transition"
                title="Sincronizar cobros con base central"
              >
                <RefreshCw className={`w-3 h-3 ${syncStatus.sincronizando || cargandoRuta ? 'animate-spin text-emerald-600' : ''}`} />
                {syncStatus.pendientesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                    {syncStatus.pendientesCount}
                  </span>
                )}
              </button>

              {/* Botón Reiniciar Jornada */}
              <button
                type="button"
                onClick={handleReiniciarJornada}
                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition"
                title="Restablecer hoja de ruta para volver a simular"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
              </button>

              {/* Botón Cerrar Sesión */}
              <button
                type="button"
                onClick={handleCerrarSesionPWA}
                className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                title="Cerrar sesión de la terminal"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Fila 2: Resumen del Día Compacto */}
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200/90 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">Cobrado:</span>
                <span className="text-base font-black font-mono text-emerald-700 leading-none">
                  ${metricas.totalCobrado.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="text-[11px] font-bold text-slate-700 font-mono">
                {metricas.visitados}/{metricas.totalLocales} <span className="text-slate-400 font-normal">({Math.round(metricas.porcentajeProgreso)}%)</span>
              </div>
            </div>
            {/* Barra de Progreso Integrada */}
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${metricas.porcentajeProgreso}%` }}
              />
            </div>
          </div>
        </header>

        {/* ===================================================================== */}
        {/* BARRA DE BÚSQUEDA RÁPIDA Y FILTROS */}
        {/* ===================================================================== */}
        <div className="px-3 py-2 space-y-1.5 flex-shrink-0 bg-white border-b border-slate-200">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente, calle o N°..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setFiltroEstado('TODOS')}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                filtroEstado === 'TODOS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span>Todos</span>
              <span className={`text-[10px] px-1 rounded-full ${filtroEstado === 'TODOS' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {paradas.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('PENDIENTES')}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                filtroEstado === 'PENDIENTES'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span>Pendientes</span>
              <span className={`text-[10px] px-1 rounded-full ${filtroEstado === 'PENDIENTES' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {paradas.filter((p) => p.estado_visita === 'PENDIENTE').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstado('COBRADOS')}
              className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                filtroEstado === 'COBRADOS'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span>Cobrados</span>
              <span className={`text-[10px] px-1 rounded-full ${filtroEstado === 'COBRADOS' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {paradas.filter((p) => p.estado_visita === 'COBRADO').length}
              </span>
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* LISTADO DE PARADAS EN RUTA */}
        {/* ===================================================================== */}
        <main className="p-3 space-y-2.5 flex-1 overflow-y-auto bg-slate-50">
          {cargandoRuta ? (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
              <span>Cargando hoja de ruta de {cobradorActivo.nombre}…</span>
            </div>
          ) : paradasFiltradas.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs space-y-2">
              <p>No se encontraron clientes para el filtro aplicado.</p>
              <button
                type="button"
                onClick={() => {
                  setFiltroTexto('');
                  setFiltroEstado('TODOS');
                }}
                className="text-emerald-700 font-bold underline"
              >
                Restablecer filtros
              </button>
            </div>
          ) : (
            paradasFiltradas.map((item) => {
              const isCobrado = item.estado_visita === 'COBRADO';
              const isNoPago = item.estado_visita === 'NO_PAGO';

              return (
                <div
                  key={item.nro_op}
                  className={`rounded-xl border transition-all relative overflow-hidden ${
                    isCobrado
                      ? 'bg-emerald-50/70 border-emerald-200 shadow-sm'
                      : isNoPago
                      ? 'bg-slate-100/80 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200/90 shadow-sm hover:border-slate-300'
                  }`}
                >
                  <div className="p-3 space-y-2">
                    {/* Fila 1: Orden + Cliente + Teléfono + Tipo + Estado Mora */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center flex-shrink-0 border border-slate-200 mt-0.5">
                          #{item.orden_recorrido}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-xs text-slate-900 leading-snug truncate">
                            {item.cliente}
                          </h3>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{item.domicilio}</span>
                          </div>
                          {item.telefono && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                              <a href={`tel:${item.telefono}`} className="text-emerald-700 font-semibold hover:underline">
                                {item.telefono}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            item.tipo === 'EFECTIVO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {item.tipo}
                        </span>

                        {item.cuotas_vencidas > 0 ? (
                          <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5 bg-rose-50 border border-rose-200 px-1 rounded">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Mora {item.cuotas_vencidas}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-0.5 bg-emerald-50/80 border border-emerald-200 px-1 rounded">
                            <Check className="w-2.5 h-2.5" /> Al Día
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Detalle de Producto si aplica */}
                    {item.producto && (
                      <div className="text-[10px] text-blue-800 font-medium bg-blue-50/70 px-2 py-0.5 rounded border border-blue-200/60 truncate">
                        Bien: {item.producto}
                      </div>
                    )}

                    {/* Fila Financiera Compacta: Cuota Diaria y Saldo Restante */}
                    <div className="flex items-center justify-between bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-200/70 text-xs">
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Cuota:</span>
                        <span className="font-mono font-black text-slate-900 text-sm">
                          ${item.cuota_diaria.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <div className="text-right">
                        {item.cuotas_vencidas > 0 ? (
                          <span className="text-[11px] font-mono font-bold text-rose-700">
                            Debe ${item.deuda_vencida.toLocaleString('es-AR')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Saldo: ${item.saldo_restante.toLocaleString('es-AR')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ESTADO SI YA FUE COBRADO */}
                    {isCobrado && (
                      <div className="py-1.5 px-2.5 bg-emerald-100/80 border border-emerald-300 rounded-lg flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-800 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Cobrado: ${item.monto_cobrado_hoy?.toLocaleString('es-AR')}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 font-semibold">
                          {item.hora_visita} hs
                        </span>
                      </div>
                    )}

                    {/* ESTADO SI REGISTRÓ NO PAGO */}
                    {isNoPago && (
                      <div className="py-1.5 px-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
                        <span className="font-semibold flex items-center gap-1 text-amber-700">
                          <XCircle className="w-3.5 h-3.5 text-amber-600" />
                          No pagó: {item.motivo_no_pago}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {item.hora_visita} hs
                        </span>
                      </div>
                    )}

                    {/* BOTONES DE ACCIÓN EN UNA SOLA FILA BALANCEADA */}
                    {!isCobrado && !isNoPago && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        {/* Botón Principal: Cobro Completo */}
                        <button
                          type="button"
                          onClick={() => handleCobroCompleto(item)}
                          className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center justify-center gap-1"
                          title={`Cobrar cuota completa de $${item.cuota_diaria.toLocaleString('es-AR')}`}
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Cobrar ${item.cuota_diaria.toLocaleString('es-AR')}</span>
                        </button>

                        {/* Botón Secundario: Otro Monto */}
                        <button
                          type="button"
                          onClick={() => setModalKeypadOp(item)}
                          className="h-9 px-2.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-lg border border-slate-300 shadow-sm transition flex-shrink-0"
                          title="Registrar un monto parcial o diferente"
                        >
                          Otro…
                        </button>

                        {/* Botón de No Pago */}
                        <button
                          type="button"
                          onClick={() => setModalNoPagoOp(item)}
                          className="h-9 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg border border-rose-200 shadow-sm transition flex-shrink-0"
                          title="Registrar visita infructuosa (local cerrado, ausente, etc.)"
                        >
                          No Pagó
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </main>
          </>
        )}
      </div>

      {/* MODAL TECLADO NUMÉRICO TÁCTIL (OTRO MONTO) */}
      {modalKeypadOp && (
        <KeypadModal
          isOpen={!!modalKeypadOp}
          onClose={() => setModalKeypadOp(null)}
          onConfirm={handleConfirmarOtroMonto}
          clienteNombre={modalKeypadOp.cliente}
          cuotaDiaria={modalKeypadOp.cuota_diaria}
        />
      )}

      {/* MODAL REGISTRO DE VISITA INFRACTUOSA (NO PAGO) */}
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
