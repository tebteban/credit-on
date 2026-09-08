/**
 * simulacion-kpi-helper.ts
 * =========================================================================
 * Generador y gestor de simulación operacional de cobranzas en calle para
 * alimentar los KPIs de rendimiento de cobradores, la cartera de clientes,
 * la terminal móvil y el arqueo de caja con datos de Santiago del Estero.
 */

import { armarOperacionConMora, OperacionConMora, CobradorInfo } from '../hooks/useClientesEnVivo';
import { supabase } from '../lib/supabase';
import { COBRADORES_CANONICOS } from './cobradores-catalogo';

export const COBRADORES_SIMULACION: CobradorInfo[] = COBRADORES_CANONICOS.map((c) => ({
  id_cobrador: c.id_cobrador,
  nombre: c.nombre,
  porcentaje_comision: c.porcentaje_comision,
  telefono: c.telefono,
}));

export interface CobroSimulado {
  id_cobro: number;
  nro_op: number;
  id_cobrador: number;
  fecha_hora: string;
  monto_cobrado: number;
  cuotas_equivalentes: number;
  motivo_no_pago?: string | null;
  observacion?: string | null;
  cobradores?: { nombre: string } | null;
}

export function generarDatosSimulacionOperacional(): {
  cobradores: CobradorInfo[];
  operaciones: OperacionConMora[];
  historialCobros: CobroSimulado[];
} {
  const hoyStr = new Date().toISOString().split('T')[0];
  const ahora = new Date();

  // Helper para crear hora exacta de hoy
  const crearHoraHoy = (hora: number, minuto: number) => {
    const d = new Date(ahora);
    d.setHours(hora, minuto, 0, 0);
    return d.toISOString();
  };

  const cAriel = COBRADORES_SIMULACION[0];
  const cCarlos = COBRADORES_SIMULACION[1];
  const cAlvaro = COBRADORES_SIMULACION[2];
  const cMauro = COBRADORES_SIMULACION[3];
  const cAntonela = COBRADORES_SIMULACION[4];

  const operaciones: OperacionConMora[] = [
    armarOperacionConMora(
      101, hoyStr, 'EFECTIVO', 100000, 26, 5000,
      { id_cliente: 1, nombre: 'PÉREZ JUAN CARLOS', dni: '28456123', domicilio: 'Av. Belgrano 1420 - Centro', telefono: '385-4123456', calificacion: 'BUENO' },
      cAriel, 2, 0
    ),
    armarOperacionConMora(
      102, hoyStr, 'EFECTIVO', 80000, 26, 4000,
      { id_cliente: 2, nombre: 'GÓMEZ MARÍA LAURA', dni: '33445566', domicilio: 'Roca Sur 245 - B° Cabildo', telefono: '385-6112233', calificacion: 'REGULAR' },
      cAriel, 0, 0
    ),
    armarOperacionConMora(
      103, hoyStr, 'PRODUCTO', 350000, 42, 12000,
      { id_cliente: 3, nombre: 'RODRÍGUEZ HUGO O.', dni: '25667788', domicilio: 'Av. Colón Sur 3100 - B° Ej. Argentino', telefono: '385-4889900', calificacion: 'BUENO' },
      cAriel, 4, 0
    ),
    armarOperacionConMora(
      104, hoyStr, 'EFECTIVO', 60000, 26, 3000,
      { id_cliente: 4, nombre: 'BENÍTEZ CLAUDIO A.', dni: '29887112', domicilio: 'Calle 12 N° 450 - B° Mishqui Mayu', telefono: '385-4771234', calificacion: 'REGULAR' },
      cCarlos, 0, 0
    ),
    armarOperacionConMora(
      105, hoyStr, 'PRODUCTO', 180000, 42, 13500,
      { id_cliente: 5, nombre: 'BAZÁN NORMA BEATRIZ', dni: '22334556', domicilio: 'Jujuy 560 - B° Centro', telefono: '385-5129988', calificacion: 'BUENO' },
      cAlvaro, 0, 0
    ),
    armarOperacionConMora(
      106, hoyStr, 'EFECTIVO', 120000, 26, 6000,
      { id_cliente: 6, nombre: 'CORVALÁN RAMÓN E.', dni: '24556778', domicilio: 'Pasaje 12 Casa 44 - B° Autonomía', telefono: '385-5334455', calificacion: 'BUENO' },
      cMauro, 0, 0
    ),
  ];

  // Generar cobros de la jornada actual ordenados DESCENDENTEMENTE (más nuevos arriba)
  const historialCobros: CobroSimulado[] = [
    {
      id_cobro: 1005,
      nro_op: 106,
      id_cobrador: cMauro.id_cobrador,
      fecha_hora: crearHoraHoy(11, 40),
      monto_cobrado: 6000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cMauro.nombre },
      observacion: 'Cobro cuota diaria en calle (PWA)'
    },
    {
      id_cobro: 1004,
      nro_op: 105,
      id_cobrador: cAlvaro.id_cobrador,
      fecha_hora: crearHoraHoy(11, 15),
      monto_cobrado: 13500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAlvaro.nombre },
      observacion: 'Cobro cuota Smart TV 43" 4K'
    },
    {
      id_cobro: 1003,
      nro_op: 104,
      id_cobrador: cCarlos.id_cobrador,
      fecha_hora: crearHoraHoy(10, 30),
      monto_cobrado: 3000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cCarlos.nombre },
      observacion: 'Cobro cuota préstamo en efectivo'
    },
    {
      id_cobro: 1002,
      nro_op: 103,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(9, 50),
      monto_cobrado: 12000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro cuota moto Corven'
    },
    {
      id_cobro: 1001,
      nro_op: 101,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(9, 10),
      monto_cobrado: 5000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro cuota diaria en circuito comercial'
    },
  ];

  return {
    cobradores: COBRADORES_SIMULACION,
    operaciones,
    historialCobros,
  };
}

/**
 * Inyecta la simulación completa en localStorage, actualiza Supabase (si está disponible)
 * y dispara el evento global para refrescar todas las vistas (Cobradores, Clientes, App Ticker).
 */
export async function aplicarSimulacionOperacionalCompleta(): Promise<{
  totalCobradores: number;
  totalOperaciones: number;
  totalCobrado: number;
  totalExigible: number;
}> {
  const { cobradores, operaciones, historialCobros } = generarDatosSimulacionOperacional();

  // 1. Guardar en almacenamiento local para acceso inmediato y offline
  try {
    localStorage.setItem('credit_on_cobradores', JSON.stringify(cobradores));
    localStorage.setItem('credit_on_cartera_operaciones', JSON.stringify(operaciones));
    historialCobros.sort((a, b) => new Date(b.fecha_hora || 0).getTime() - new Date(a.fecha_hora || 0).getTime());
    localStorage.setItem('credit_on_historial_cobros', JSON.stringify(historialCobros));
  } catch (e) {
    console.warn('Error guardando simulación local:', e);
  }

  // 2. Disparar evento para que todos los componentes reaccionen al instante
  window.dispatchEvent(new Event('credit_on_storage_update'));

  // 3. Sincronización en segundo plano con Supabase si está disponible
  if (supabase) {
    (async () => {
      try {
        // Asegurar cobradores en DB
        for (const c of cobradores) {
          await supabase.from('cobradores').upsert({
            id_cobrador: c.id_cobrador,
            nombre: c.nombre,
            telefono: c.telefono,
            porcentaje_comision: c.porcentaje_comision,
            activo: true,
          });
        }
      } catch (err) {
        console.warn('Sync Supabase simulación notice:', err);
      }
    })();
  }

  const totalExigible = operaciones.reduce((acc, o) => acc + o.importe_cuota, 0);
  const totalCobrado = historialCobros.reduce((acc, h) => acc + h.monto_cobrado, 0);

  return {
    totalCobradores: cobradores.length,
    totalOperaciones: operaciones.length,
    totalCobrado,
    totalExigible,
  };
}
