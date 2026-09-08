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
  const cOriana = COBRADORES_SIMULACION[5];

  const operaciones: OperacionConMora[] = [
    // ─── ARIEL GÓMEZ (4 operaciones) ───
    armarOperacionConMora(
      201, hoyStr, 'EFECTIVO', 100000, 20, 5000,
      { id_cliente: 201, nombre: 'PÉREZ JUAN CARLOS', dni: '28491203', domicilio: 'Av. Belgrano 1420 - Centro', telefono: '385-4123456', calificacion: 'BUENO' },
      cAriel, 13, 0
    ),
    armarOperacionConMora(
      202, hoyStr, 'PRODUCTO', 130000, 20, 6500,
      { id_cliente: 202, nombre: 'MERCERÍA LA ILUSIÓN', dni: '27889123', domicilio: 'Calle España 320 - La Banda', telefono: '385-4991122', calificacion: 'BUENO' },
      cAriel, 10, 0
    ),
    armarOperacionConMora(
      203, hoyStr, 'EFECTIVO', 90000, 20, 4500,
      { id_cliente: 203, nombre: 'GÓMEZ MARÍA LAURA', dni: '33445566', domicilio: 'Roca Sur 245 - Cabildo', telefono: '385-6112233', calificacion: 'BUENO' },
      cAriel, 15, 0
    ),
    armarOperacionConMora(
      204, hoyStr, 'PRODUCTO', 120000, 20, 6000,
      { id_cliente: 204, nombre: 'FARMACIA SAN ROQUE', dni: '30554433', domicilio: 'Mitre 620 - Centro', telefono: '385-4221199', calificacion: 'BUENO' },
      cAriel, 8, 0
    ),

    // ─── CARLOS MENDILAHARZU (4 operaciones) ───
    armarOperacionConMora(
      205, hoyStr, 'PRODUCTO', 180000, 24, 7500,
      { id_cliente: 205, nombre: 'TALLER MECÁNICO RODRÍGUEZ', dni: '25667788', domicilio: 'Av. Colón Sur 3100', telefono: '385-4889900', calificacion: 'BUENO' },
      cCarlos, 18, 0
    ),
    armarOperacionConMora(
      206, hoyStr, 'PRODUCTO', 192000, 24, 8000,
      { id_cliente: 206, nombre: 'COMERCIAL EL AMIGO', dni: '30112233', domicilio: 'Libertad 840 - Huaico Hondo', telefono: '385-5987654', calificacion: 'BUENO' },
      cCarlos, 16, 0
    ),
    armarOperacionConMora(
      207, hoyStr, 'EFECTIVO', 80000, 20, 4000,
      { id_cliente: 207, nombre: 'VERDULERÍA SAN CAYETANO', dni: '29881122', domicilio: 'Av. Aguirre 1150', telefono: '385-4778899', calificacion: 'BUENO' },
      cCarlos, 12, 0
    ),
    armarOperacionConMora(
      208, hoyStr, 'EFECTIVO', 70000, 20, 3500,
      { id_cliente: 208, nombre: 'KIOSCO EL PASO', dni: '32119944', domicilio: 'Pedro León Gallo 410', telefono: '385-4332211', calificacion: 'BUENO' },
      cCarlos, 9, 0
    ),

    // ─── ÁLVARO MORALES (4 operaciones) ───
    armarOperacionConMora(
      209, hoyStr, 'PRODUCTO', 110000, 20, 5500,
      { id_cliente: 209, nombre: 'BENÍTEZ CLAUDIO ANDRÉS', dni: '29887112', domicilio: 'Calle 12 N° 450 - Mishqui Mayu', telefono: '385-4771234', calificacion: 'BUENO' },
      cAlvaro, 7, 0
    ),
    armarOperacionConMora(
      210, hoyStr, 'PRODUCTO', 216000, 24, 9000,
      { id_cliente: 210, nombre: 'DISTRIBUIDORA NORTE', dni: '26441188', domicilio: 'Av. Solís Este 890', telefono: '385-4552233', calificacion: 'BUENO' },
      cAlvaro, 14, 0
    ),
    armarOperacionConMora(
      211, hoyStr, 'EFECTIVO', 140000, 20, 7000,
      { id_cliente: 211, nombre: 'CARNICERÍA LA TRADICIÓN', dni: '24991144', domicilio: 'Independencia 2100', telefono: '385-4663344', calificacion: 'BUENO' },
      cAlvaro, 11, 0
    ),
    armarOperacionConMora(
      212, hoyStr, 'EFECTIVO', 90000, 20, 4500,
      { id_cliente: 212, nombre: 'DESPENSA DOÑA ROSA', dni: '31882233', domicilio: 'B° San Fernando Mz 14 Lote 5', telefono: '385-4228877', calificacion: 'REGULAR' },
      cAlvaro, 4, 1 // Pendiente / mora leve
    ),

    // ─── MAURO SÁNCHEZ (4 operaciones) ───
    armarOperacionConMora(
      213, hoyStr, 'EFECTIVO', 120000, 20, 6000,
      { id_cliente: 213, nombre: 'BAZÁN NORMA BEATRIZ', dni: '22334556', domicilio: 'Jujuy 560 - Centro', telefono: '385-5129988', calificacion: 'BUENO' },
      cMauro, 16, 0
    ),
    armarOperacionConMora(
      214, hoyStr, 'PRODUCTO', 204000, 24, 8500,
      { id_cliente: 214, nombre: 'AUTOPARTES SANTIAGO', dni: '28114455', domicilio: 'Av. Moreno 1850', telefono: '385-4338877', calificacion: 'BUENO' },
      cMauro, 12, 0
    ),
    armarOperacionConMora(
      215, hoyStr, 'EFECTIVO', 100000, 20, 5000,
      { id_cliente: 215, nombre: 'PANADERÍA LA ESPIGA', dni: '25778899', domicilio: 'Av. Belgrano Sur 2400', telefono: '385-4881122', calificacion: 'BUENO' },
      cMauro, 11, 0
    ),
    armarOperacionConMora(
      216, hoyStr, 'EFECTIVO', 80000, 20, 4000,
      { id_cliente: 216, nombre: 'PELUQUERÍA ESTILO', dni: '34112233', domicilio: 'Sarmiento 180 - La Banda', telefono: '385-4993322', calificacion: 'BUENO' },
      cMauro, 6, 0 // Pendiente de visita
    ),

    // ─── ANTONELA ROSSI (4 operaciones) ───
    armarOperacionConMora(
      217, hoyStr, 'PRODUCTO', 130000, 20, 6500,
      { id_cliente: 217, nombre: 'ZAPATERÍA CALZADOS DANI', dni: '32556677', domicilio: 'Peatonal Tucumán 140', telefono: '385-4119900', calificacion: 'BUENO' },
      cAntonela, 15, 0
    ),
    armarOperacionConMora(
      218, hoyStr, 'PRODUCTO', 140000, 20, 7000,
      { id_cliente: 218, nombre: 'BOUTIQUE ELEGANTE', dni: '29443322', domicilio: '24 de Septiembre 350', telefono: '385-4667788', calificacion: 'BUENO' },
      cAntonela, 14, 0
    ),
    armarOperacionConMora(
      219, hoyStr, 'PRODUCTO', 100000, 20, 5000,
      { id_cliente: 219, nombre: 'LIBRERÍA NUEVO MUNDO', dni: '33118899', domicilio: 'Urquiza 290', telefono: '385-4554411', calificacion: 'REGULAR' },
      cAntonela, 5, 2 // Visita sin pago (local cerrado)
    ),
    armarOperacionConMora(
      220, hoyStr, 'EFECTIVO', 160000, 20, 8000,
      { id_cliente: 220, nombre: 'RESTAURANTE EL FOGÓN', dni: '26332211', domicilio: 'Av. Rivadavia 430', telefono: '385-4775533', calificacion: 'BUENO' },
      cAntonela, 8, 0 // Pendiente
    ),

    // ─── ORIANA PAZ (4 operaciones) ───
    armarOperacionConMora(
      221, hoyStr, 'PRODUCTO', 110000, 20, 5500,
      { id_cliente: 221, nombre: 'BAZAR SANTIAGUEÑO', dni: '27448833', domicilio: 'Av. Alsina 720', telefono: '385-4223366', calificacion: 'BUENO' },
      cOriana, 12, 0
    ),
    armarOperacionConMora(
      222, hoyStr, 'PRODUCTO', 90000, 20, 4500,
      { id_cliente: 222, nombre: 'DIETÉTICA VIDA SANA', dni: '35114422', domicilio: 'Av. Lugones 1100', telefono: '385-4997788', calificacion: 'BUENO' },
      cOriana, 10, 0
    ),
    armarOperacionConMora(
      223, hoyStr, 'PRODUCTO', 120000, 20, 6000,
      { id_cliente: 223, nombre: 'GIMNASIO IMPACTO', dni: '30229988', domicilio: 'Av. Belgrano 3400', telefono: '385-4441155', calificacion: 'BUENO' },
      cOriana, 9, 0
    ),
    armarOperacionConMora(
      224, hoyStr, 'PRODUCTO', 150000, 20, 7500,
      { id_cliente: 224, nombre: 'FERRETERÍA INDUSTRIAL', dni: '25117766', domicilio: 'Av. Madre de Ciudades 280', telefono: '385-4886633', calificacion: 'BUENO' },
      cOriana, 14, 0
    ),
  ];

  // Generar cobros e incidencias de la jornada actual (Hoy por la mañana)
  const historialCobros: CobroSimulado[] = [
    // Cobros de Ariel Gómez (4 de 4 cobrados - 100%)
    {
      id_cobro: 1001,
      nro_op: 201,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(8, 45),
      monto_cobrado: 5000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro asentado en calle — Terminal PWA'
    },
    {
      id_cobro: 1002,
      nro_op: 202,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(9, 20),
      monto_cobrado: 6500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro completo de cuota diaria'
    },
    {
      id_cobro: 1003,
      nro_op: 203,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(10, 15),
      monto_cobrado: 4500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro en efectivo recepcionado'
    },
    {
      id_cobro: 1004,
      nro_op: 204,
      id_cobrador: cAriel.id_cobrador,
      fecha_hora: crearHoraHoy(11, 10),
      monto_cobrado: 6000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAriel.nombre },
      observacion: 'Cobro cuota Smart TV 43"'
    },

    // Cobros de Carlos Mendilaharzu (4 de 4 cobrados - 100%)
    {
      id_cobro: 1005,
      nro_op: 205,
      id_cobrador: cCarlos.id_cobrador,
      fecha_hora: crearHoraHoy(9, 5),
      monto_cobrado: 7500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cCarlos.nombre },
      observacion: 'Cobro cuota taller mecánico'
    },
    {
      id_cobro: 1006,
      nro_op: 206,
      id_cobrador: cCarlos.id_cobrador,
      fecha_hora: crearHoraHoy(9, 40),
      monto_cobrado: 8000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cCarlos.nombre },
      observacion: 'Cobro cuota comercio'
    },
    {
      id_cobro: 1007,
      nro_op: 207,
      id_cobrador: cCarlos.id_cobrador,
      fecha_hora: crearHoraHoy(10, 30),
      monto_cobrado: 4000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cCarlos.nombre },
      observacion: 'Cobro en calle — Verdulería'
    },
    {
      id_cobro: 1008,
      nro_op: 208,
      id_cobrador: cCarlos.id_cobrador,
      fecha_hora: crearHoraHoy(11, 25),
      monto_cobrado: 3500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cCarlos.nombre },
      observacion: 'Cobro cuota Kiosco'
    },

    // Cobros de Álvaro Morales (3 cobrados, 1 pendiente - 82.7%)
    {
      id_cobro: 1009,
      nro_op: 209,
      id_cobrador: cAlvaro.id_cobrador,
      fecha_hora: crearHoraHoy(8, 55),
      monto_cobrado: 5500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAlvaro.nombre },
      observacion: 'Cobro cuota electrodoméstico'
    },
    {
      id_cobro: 1010,
      nro_op: 210,
      id_cobrador: cAlvaro.id_cobrador,
      fecha_hora: crearHoraHoy(9, 50),
      monto_cobrado: 9000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAlvaro.nombre },
      observacion: 'Cobro en distribuidora'
    },
    {
      id_cobro: 1011,
      nro_op: 211,
      id_cobrador: cAlvaro.id_cobrador,
      fecha_hora: crearHoraHoy(11, 40),
      monto_cobrado: 7000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAlvaro.nombre },
      observacion: 'Cobro cuota carnicería'
    },

    // Cobros de Mauro Sánchez (3 cobrados, 1 pendiente - 82.9%)
    {
      id_cobro: 1012,
      nro_op: 213,
      id_cobrador: cMauro.id_cobrador,
      fecha_hora: crearHoraHoy(9, 15),
      monto_cobrado: 6000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cMauro.nombre },
      observacion: 'Cobro préstamo efectivo'
    },
    {
      id_cobro: 1013,
      nro_op: 214,
      id_cobrador: cMauro.id_cobrador,
      fecha_hora: crearHoraHoy(10, 0),
      monto_cobrado: 8500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cMauro.nombre },
      observacion: 'Cobro cuota autopartes'
    },
    {
      id_cobro: 1014,
      nro_op: 215,
      id_cobrador: cMauro.id_cobrador,
      fecha_hora: crearHoraHoy(11, 5),
      monto_cobrado: 5000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cMauro.nombre },
      observacion: 'Cobro panadería'
    },

    // Cobros de Antonela Rossi (2 cobrados, 1 no-pago por cerrado, 1 pendiente - 50.9%)
    {
      id_cobro: 1015,
      nro_op: 217,
      id_cobrador: cAntonela.id_cobrador,
      fecha_hora: crearHoraHoy(8, 40),
      monto_cobrado: 6500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAntonela.nombre },
      observacion: 'Cobro zapatería peatonal'
    },
    {
      id_cobro: 1016,
      nro_op: 218,
      id_cobrador: cAntonela.id_cobrador,
      fecha_hora: crearHoraHoy(9, 30),
      monto_cobrado: 7000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cAntonela.nombre },
      observacion: 'Cobro boutique centro'
    },
    {
      id_cobro: 1017,
      nro_op: 219,
      id_cobrador: cAntonela.id_cobrador,
      fecha_hora: crearHoraHoy(10, 20),
      monto_cobrado: 0,
      cuotas_equivalentes: 0,
      motivo_no_pago: 'LOCAL_CERRADO',
      cobradores: { nombre: cAntonela.nombre },
      observacion: 'Visita sin pago: Local comercial cerrado por inventario matutino'
    },

    // Cobros de Oriana Paz (4 de 4 cobrados - 100%)
    {
      id_cobro: 1018,
      nro_op: 221,
      id_cobrador: cOriana.id_cobrador,
      fecha_hora: crearHoraHoy(9, 10),
      monto_cobrado: 5500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cOriana.nombre },
      observacion: 'Cobro bazar calle Alsina'
    },
    {
      id_cobro: 1019,
      nro_op: 222,
      id_cobrador: cOriana.id_cobrador,
      fecha_hora: crearHoraHoy(9, 45),
      monto_cobrado: 4500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cOriana.nombre },
      observacion: 'Cobro dietética'
    },
    {
      id_cobro: 1020,
      nro_op: 223,
      id_cobrador: cOriana.id_cobrador,
      fecha_hora: crearHoraHoy(10, 35),
      monto_cobrado: 6000,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cOriana.nombre },
      observacion: 'Cobro cuota gimnasio'
    },
    {
      id_cobro: 1021,
      nro_op: 224,
      id_cobrador: cOriana.id_cobrador,
      fecha_hora: crearHoraHoy(11, 50),
      monto_cobrado: 7500,
      cuotas_equivalentes: 1,
      cobradores: { nombre: cOriana.nombre },
      observacion: 'Cobro ferretería industrial'
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
