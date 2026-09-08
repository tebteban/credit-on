/**
 * schedule-engine.ts — Generación de cronogramas de cuotas y fechas hábiles
 * =========================================================================
 * Módulo puro sin dependencias de React para cálculo de cronogramas de pago
 * de lunes a sábado (excluyendo domingos). Compatible con Desktop y PWA Móvil.
 */
import type { CuotaModel } from '../types/payment';

/**
 * Genera el cronograma de cuotas (Lunes a Sábado, excluyendo domingos)
 */
export function generarCuotasSchedule(
  nro_op: number,
  valorCuota: number,
  totalCuotas: number,
  pagadasCount: number = 0,
  vencidasImpagas: number = 0
): CuotaModel[] {
  const cuotas: CuotaModel[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Retroceder días hábiles para simular historial pasado si aplica
  const totalPasadas = pagadasCount + vencidasImpagas;
  let cursor = new Date(hoy);
  let diasAtras = 0;
  let habiles = 0;
  while (habiles < totalPasadas) {
    diasAtras++;
    const testDate = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    if (testDate.getDay() !== 0) {
      habiles++;
    }
  }
  cursor = new Date(hoy.getTime() - diasAtras * 24 * 60 * 60 * 1000);

  let cuotaIdx = 1;
  while (cuotaIdx <= totalCuotas) {
    if (cursor.getDay() !== 0) {
      const fechaIso = cursor.toISOString().split('T')[0];
      let estado: CuotaModel['estado'] = 'PENDIENTE';
      let montoPagado = 0;
      let fechaPago: string | null = null;

      if (cuotaIdx <= pagadasCount) {
        estado = 'PAGADA';
        montoPagado = valorCuota;
        fechaPago = fechaIso;
      }

      cuotas.push({
        id_cuota: nro_op * 100 + cuotaIdx,
        nro_op,
        numero_cuota: cuotaIdx,
        fecha_vencimiento: fechaIso,
        monto_esperado: valorCuota,
        monto_pagado: montoPagado,
        estado,
        fecha_pago_efectivo: fechaPago,
      });
      cuotaIdx++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return cuotas;
}
