/**
 * CREDIT-ON — Servicio Transaccional de Pagos e Imputación en Cascada
 * ===================================================================
 * 
 * Responsabilidades:
 *  1. Imputación en cascada de pagos parciales, completos y adelantados.
 *  2. Validación estricta de reglas de negocio y consistencia financiera.
 *  3. Garantía de idempotencia (prevención de dobles cobros por timeout o retry).
 *  4. Recálculo en tiempo real de atraso, semáforo de mora y alerta de retiro.
 *  5. Integración con Supabase RPC ('fn_registrar_cobro') y modo local/offline.
 */

import type {
  OperacionModel,
  CuotaModel,
  RegistrarCobroDTO,
  ResultadoTransaccionCobro,
  DesgloseCuotaAfectada,
  AlertaMora,
  NivelMora,
  RegistrarNoPagoDTO,
} from '../types/payment';

export interface SupabaseClientLike {
  rpc: (
    functionName: string,
    params: Record<string, any>
  ) => Promise<{ data: any; error: any }>;
  from: (table: string) => {
    insert: (values: any) => Promise<{ data: any; error: any }>;
    select: (columns?: string) => any;
  };
}

export class PaymentCascadeService {
  private supabaseClient?: SupabaseClientLike;

  constructor(supabaseClient?: SupabaseClientLike) {
    this.supabaseClient = supabaseClient;
  }

  /**
   * Genera un UUID v4 compatible con navegadores, Node y entornos Edge
   */
  public static generarIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback estándar RFC4122
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Evalúa el nivel de mora y genera la alerta correspondiente para una operación.
   * 
   * Criterios:
   *  - AL_DIA: 0 cuotas vencidas impagas.
   *  - ALERTA: 1 a 2 cuotas vencidas.
   *  - MORA_CRITICA: 3 a 5 cuotas vencidas.
   *  - EVALUAR_RETIRO: 6 o más cuotas vencidas (o ≥ 3 cuotas con producto financiado en riesgo).
   */
  public static evaluarMora(
    tipo: 'EFECTIVO' | 'PRODUCTO',
    cuotas: CuotaModel[],
    fechaReferencia: string = new Date().toISOString().split('T')[0]
  ): AlertaMora {
    const refDate = new Date(fechaReferencia);

    const cuotasVencidas = cuotas.filter((c) => {
      const esImpaga = c.estado === 'PENDIENTE' || c.estado === 'PARCIAL';
      const estaVencida = new Date(c.fecha_vencimiento) < refDate;
      return esImpaga && estaVencida;
    });

    const cantidadVencidas = cuotasVencidas.length;
    const deudaVencida = cuotasVencidas.reduce(
      (sum, c) => sum + (c.monto_esperado - c.monto_pagado),
      0
    );

    let nivel: NivelMora = 'AL_DIA';
    let mensaje = 'Cliente al día con sus pagos.';
    let requiereAccion = false;
    let sugerenciaRetiro = false;

    if (cantidadVencidas >= 1 && cantidadVencidas <= 2) {
      nivel = 'ALERTA';
      mensaje = `Cliente presenta ${cantidadVencidas} cuota(s) impaga(s) vencida(s). Notificar al cobrador.`;
      requiereAccion = false;
    } else if (cantidadVencidas >= 3 && cantidadVencidas <= 5) {
      nivel = 'MORA_CRITICA';
      mensaje = `¡ATENCIÓN! Cliente con ${cantidadVencidas} cuotas vencidas ($${deudaVencida.toLocaleString('es-AR')}). Priorizar visita.`;
      requiereAccion = true;
      if (tipo === 'PRODUCTO' && cantidadVencidas >= 4) {
        sugerenciaRetiro = true;
        mensaje += ' [Evaluar recuperación del bien si no regulariza en 24hs]';
      }
    } else if (cantidadVencidas >= 6) {
      nivel = 'EVALUAR_RETIRO';
      mensaje = `ALERTA CRÍTICA: ${cantidadVencidas} cuotas impagas ($${deudaVencida.toLocaleString('es-AR')}). Iniciar retiro de mercadería o derivar a legales.`;
      requiereAccion = true;
      sugerenciaRetiro = tipo === 'PRODUCTO';
    }

    return {
      nivel,
      cuotas_vencidas_impagas: cantidadVencidas,
      deuda_vencida_total: parseFloat(deudaVencida.toFixed(2)),
      mensaje,
      requiere_accion_inmediata: requiereAccion,
      sugerencia_retiro_mercaderia: sugerenciaRetiro,
    };
  }

  /**
   * Ejecuta la lógica transaccional de imputación en cascada en memoria.
   * Se utiliza directamente para testing unitario, procesamiento local offline (PWA)
   * y cálculo predictivo antes del commit en backend.
   * 
   * Algoritmo:
   *  1. Valida estado VIGENTE y monto > 0.
   *  2. Ordena cuotas por vencimiento cronológico ASC.
   *  3. Recorre cuotas pendientes/parciales:
   *     - Si monto_disponible >= faltante -> Cuota PAGADA, avanza con remanente.
   *     - Si monto_disponible < faltante -> Cuota PARCIAL, disponible = 0.
   *  4. Actualiza saldo restante de la operación.
   *  5. Si saldo_restante <= 0 -> Operación CANCELADA.
   *  6. Evalúa mora resultante tras el cobro.
   */
  public procesarCascadaEnMemoria(
    operacion: OperacionModel,
    cuotas: CuotaModel[],
    dto: RegistrarCobroDTO
  ): ResultadoTransaccionCobro {
    const idempotencyKey = dto.idempotency_key || PaymentCascadeService.generarIdempotencyKey();

    // 1. Validaciones previas
    if (operacion.estado !== 'VIGENTE') {
      return {
        exito: false,
        status: 'REJECTED',
        idempotency_key: idempotencyKey,
        nro_op: operacion.nro_op,
        monto_recibido: dto.monto,
        monto_efectivamente_aplicado: 0,
        cuotas_equivalentes: 0,
        saldo_anterior: operacion.saldo_restante,
        nuevo_saldo: operacion.saldo_restante,
        estado_operacion_anterior: operacion.estado,
        nuevo_estado_operacion: operacion.estado,
        cuotas_totalmente_canceladas: [],
        cuotas_parcialmente_pagadas: [],
        detalle_completo_imputacion: [],
        excedente_a_favor: 0,
        alerta_mora_actualizada: PaymentCascadeService.evaluarMora(operacion.tipo, cuotas),
        mensaje: `No se pueden registrar cobros en una operación con estado ${operacion.estado}.`,
      };
    }

    if (dto.monto <= 0) {
      throw new Error(`El monto a cobrar debe ser estrictamente mayor a 0 (recibido: ${dto.monto})`);
    }

    // 2. Preparar cuotas ordenadas cronológicamente
    const cuotasCopia: CuotaModel[] = cuotas.map((c) => ({ ...c }));
    const cuotasPendientes = cuotasCopia
      .filter((c) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
      .sort((a, b) => {
        const fechaDiff = new Date(a.fecha_vencimiento).getTime() - new Date(b.fecha_vencimiento).getTime();
        return fechaDiff !== 0 ? fechaDiff : a.numero_cuota - b.numero_cuota;
      });

    let disponible = dto.monto;
    let montoAplicado = 0;
    const canceladas: number[] = [];
    const parciales: DesgloseCuotaAfectada[] = [];
    const detalleCompleto: DesgloseCuotaAfectada[] = [];
    const fechaPago = dto.fecha_hora ? dto.fecha_hora.split('T')[0] : new Date().toISOString().split('T')[0];

    // 3. Imputación en Cascada
    for (const cuota of cuotasPendientes) {
      if (disponible <= 0) break;

      const faltante = cuota.monto_esperado - cuota.monto_pagado;
      const estadoAnterior = cuota.estado;
      const montoAntPagado = cuota.monto_pagado;

      if (disponible >= faltante) {
        // PAGO COMPLETO DE LA CUOTA
        cuota.monto_pagado = cuota.monto_esperado;
        cuota.estado = 'PAGADA';
        cuota.fecha_pago_efectivo = fechaPago;

        disponible -= faltante;
        montoAplicado += faltante;
        canceladas.push(cuota.numero_cuota);

        const desglose: DesgloseCuotaAfectada = {
          id_cuota: cuota.id_cuota,
          numero_cuota: cuota.numero_cuota,
          fecha_vencimiento: cuota.fecha_vencimiento,
          monto_anterior_pagado: montoAntPagado,
          monto_imputado: faltante,
          nuevo_monto_pagado: cuota.monto_esperado,
          saldo_cuota_remanente: 0,
          estado_anterior: estadoAnterior,
          nuevo_estado: 'PAGADA',
        };
        detalleCompleto.push(desglose);
      } else {
        // PAGO PARCIAL
        cuota.monto_pagado += disponible;
        cuota.estado = 'PARCIAL';
        cuota.fecha_pago_efectivo = fechaPago;

        montoAplicado += disponible;
        const saldoRemanenteCuota = cuota.monto_esperado - cuota.monto_pagado;

        const desglose: DesgloseCuotaAfectada = {
          id_cuota: cuota.id_cuota,
          numero_cuota: cuota.numero_cuota,
          fecha_vencimiento: cuota.fecha_vencimiento,
          monto_anterior_pagado: montoAntPagado,
          monto_imputado: disponible,
          nuevo_monto_pagado: cuota.monto_pagado,
          saldo_cuota_remanente: parseFloat(saldoRemanenteCuota.toFixed(2)),
          estado_anterior: estadoAnterior,
          nuevo_estado: 'PARCIAL',
        };
        parciales.push(desglose);
        detalleCompleto.push(desglose);

        disponible = 0;
      }
    }

    // 4. Cálculos finales de saldo y estado
    const excedente = disponible; // Dinero sobrante si el cliente pagó más de lo adeudado
    const nuevoSaldo = Math.max(operacion.saldo_restante - montoAplicado, 0);
    const cuotasEquivalentes = parseFloat((montoAplicado / operacion.importe_cuota).toFixed(4));

    const quedanCuotasImpagas = cuotasCopia.some(
      (c) => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL'
    );

    const nuevoEstadoOperacion = !quedanCuotasImpagas || nuevoSaldo === 0 ? 'CANCELADO' : 'VIGENTE';

    // 5. Recalcular nivel de mora post-cobro
    const alertaMora = PaymentCascadeService.evaluarMora(
      operacion.tipo,
      cuotasCopia,
      fechaPago
    );

    let mensajeExito = `Cobro de $${dto.monto.toLocaleString('es-AR')} aplicado con éxito.`;
    if (canceladas.length > 0) {
      mensajeExito += ` ${canceladas.length} cuota(s) cancelada(s) (N° ${canceladas.join(', ')}).`;
    }
    if (parciales.length > 0) {
      mensajeExito += ` 1 cuota parcializada (N° ${parciales[0].numero_cuota}, resta $${parciales[0].saldo_cuota_remanente.toLocaleString('es-AR')}).`;
    }
    if (nuevoEstadoOperacion === 'CANCELADO') {
      mensajeExito += ' ¡Operación COMPLETAMENTE CANCELADA!';
    }
    if (excedente > 0) {
      mensajeExito += ` Excedente a favor del cliente: $${excedente.toLocaleString('es-AR')}.`;
    }

    return {
      exito: true,
      status: 'OK',
      idempotency_key: idempotencyKey,
      nro_op: operacion.nro_op,
      monto_recibido: dto.monto,
      monto_efectivamente_aplicado: parseFloat(montoAplicado.toFixed(2)),
      cuotas_equivalentes: cuotasEquivalentes,
      saldo_anterior: operacion.saldo_restante,
      nuevo_saldo: parseFloat(nuevoSaldo.toFixed(2)),
      estado_operacion_anterior: operacion.estado,
      nuevo_estado_operacion: nuevoEstadoOperacion,
      cuotas_totalmente_canceladas: canceladas,
      cuotas_parcialmente_pagadas: parciales,
      detalle_completo_imputacion: detalleCompleto,
      excedente_a_favor: parseFloat(excedente.toFixed(2)),
      alerta_mora_actualizada: alertaMora,
      mensaje: mensajeExito,
    };
  }

  /**
   * Ejecuta el cobro de manera transaccional y atómica en Supabase llamando
   * al stored procedure 'fn_registrar_cobro' (con lock FOR UPDATE e Idempotencia).
   */
  public async registrarCobroEnSupabase(dto: RegistrarCobroDTO): Promise<ResultadoTransaccionCobro> {
    if (!this.supabaseClient) {
      throw new Error('PaymentCascadeService: Cliente de Supabase no configurado.');
    }

    const idempotencyKey = dto.idempotency_key || PaymentCascadeService.generarIdempotencyKey();

    try {
      const { data, error } = await this.supabaseClient.rpc('fn_registrar_cobro', {
        p_nro_op: dto.nro_op,
        p_id_cobrador: dto.id_cobrador,
        p_monto: dto.monto,
        p_fecha: dto.fecha_hora || new Date().toISOString(),
        p_gps: dto.coordenadas_gps || null,
        p_observacion: dto.observacion || null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        throw new Error(`Error en Supabase RPC fn_registrar_cobro: ${error.message || JSON.stringify(error)}`);
      }

      // Si fue una respuesta por idempotencia duplicada
      if (data?.status === 'DUPLICATE') {
        return {
          exito: true,
          status: 'DUPLICATE',
          id_cobro: data.cobro?.id_cobro,
          idempotency_key: idempotencyKey,
          nro_op: dto.nro_op,
          monto_recibido: dto.monto,
          monto_efectivamente_aplicado: data.cobro?.monto_cobrado || dto.monto,
          cuotas_equivalentes: data.cobro?.cuotas_equivalentes || 1,
          saldo_anterior: 0,
          nuevo_saldo: 0,
          estado_operacion_anterior: 'VIGENTE',
          nuevo_estado_operacion: 'VIGENTE',
          cuotas_totalmente_canceladas: [],
          cuotas_parcialmente_pagadas: [],
          detalle_completo_imputacion: [],
          excedente_a_favor: 0,
          alerta_mora_actualizada: {
            nivel: 'AL_DIA',
            cuotas_vencidas_impagas: 0,
            deuda_vencida_total: 0,
            mensaje: 'Transacción previamente procesada (Idempotente).',
            requiere_accion_inmediata: false,
            sugerencia_retiro_mercaderia: false,
          },
          mensaje: 'Transacción idempotente: el cobro ya había sido registrado previamente.',
        };
      }

      return {
        exito: true,
        status: 'OK',
        id_cobro: data?.id_cobro,
        idempotency_key: idempotencyKey,
        nro_op: dto.nro_op,
        monto_recibido: dto.monto,
        monto_efectivamente_aplicado: dto.monto - (data?.excedente || 0),
        cuotas_equivalentes: data?.cuotas_equivalentes || 1,
        saldo_anterior: 0,
        nuevo_saldo: data?.saldo_restante || 0,
        estado_operacion_anterior: 'VIGENTE',
        nuevo_estado_operacion: data?.operacion_estado || 'VIGENTE',
        cuotas_totalmente_canceladas: [],
        cuotas_parcialmente_pagadas: [],
        detalle_completo_imputacion: [],
        excedente_a_favor: data?.excedente || 0,
        alerta_mora_actualizada: {
          nivel: 'AL_DIA',
          cuotas_vencidas_impagas: 0,
          deuda_vencida_total: 0,
          mensaje: 'Cobro sincronizado exitosamente con la base de datos cloud.',
          requiere_accion_inmediata: false,
          sugerencia_retiro_mercaderia: false,
        },
        mensaje: 'Cobro asentado en base de datos cloud satisfactoriamente.',
      };
    } catch (err: any) {
      return {
        exito: false,
        status: 'REJECTED',
        idempotency_key: idempotencyKey,
        nro_op: dto.nro_op,
        monto_recibido: dto.monto,
        monto_efectivamente_aplicado: 0,
        cuotas_equivalentes: 0,
        saldo_anterior: 0,
        nuevo_saldo: 0,
        estado_operacion_anterior: 'VIGENTE',
        nuevo_estado_operacion: 'VIGENTE',
        cuotas_totalmente_canceladas: [],
        cuotas_parcialmente_pagadas: [],
        detalle_completo_imputacion: [],
        excedente_a_favor: 0,
        alerta_mora_actualizada: {
          nivel: 'ALERTA',
          cuotas_vencidas_impagas: 0,
          deuda_vencida_total: 0,
          mensaje: err.message,
          requiere_accion_inmediata: false,
          sugerencia_retiro_mercaderia: false,
        },
        mensaje: `Fallo al registrar cobro: ${err.message}`,
      };
    }
  }

  /**
   * Registra un intento de cobro infructuoso (visita de campo sin pago:
   * cerrado, ausente, sin dinero, pasar más tarde).
   */
  public async registrarVisitaSinPago(dto: RegistrarNoPagoDTO): Promise<{ exito: boolean; mensaje: string }> {
    const idempotencyKey = dto.idempotency_key || PaymentCascadeService.generarIdempotencyKey();

    if (!this.supabaseClient) {
      // Registro local
      return {
        exito: true,
        mensaje: `Visita sin cobro registrada localmente (${dto.motivo}).`,
      };
    }

    try {
      const { error } = await this.supabaseClient.from('cobros').insert({
        nro_op: dto.nro_op,
        id_cobrador: dto.id_cobrador,
        monto_cobrado: 0.0001, // Marcador simbólico auditado
        cuotas_equivalentes: 0.0001,
        motivo_no_pago: dto.motivo,
        observacion: dto.observacion || `Visita sin pago: ${dto.motivo}`,
        coordenadas_gps: dto.coordenadas_gps || null,
        fecha_hora: dto.fecha_hora || new Date().toISOString(),
        idempotency_key: idempotencyKey,
      });

      if (error) throw error;

      return {
        exito: true,
        mensaje: `Registro de no-pago asentado en auditoría (${dto.motivo}).`,
      };
    } catch (err: any) {
      return {
        exito: false,
        mensaje: `Error al asentar no-pago: ${err.message}`,
      };
    }
  }
}
