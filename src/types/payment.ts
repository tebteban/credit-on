/**
 * CREDIT-ON — Definiciones de Tipos para el Módulo Transaccional de Pagos
 * =======================================================================
 * Modelos para operaciones, cuotas, cobros, estados de mora y DTOs de pago.
 */

export type TipoOperacion = 'EFECTIVO' | 'PRODUCTO';

export type EstadoOperacion = 
  | 'VIGENTE' 
  | 'CANCELADO' 
  | 'RETIRADO' 
  | 'LEGALES' 
  | 'REFINANCIADO';

export type EstadoCuota = 
  | 'PENDIENTE' 
  | 'PARCIAL' 
  | 'PAGADA' 
  | 'CONDONADA';

export type MotivoNoPago = 
  | 'CERRADO' 
  | 'NO_TENIA_DINERO' 
  | 'PASAR_MAS_TARDE' 
  | 'AUSENTE' 
  | 'OTRO';

export type NivelMora = 
  | 'AL_DIA' 
  | 'ALERTA' 
  | 'MORA_CRITICA' 
  | 'EVALUAR_RETIRO';

export interface CuotaModel {
  id_cuota: number;
  nro_op: number;
  numero_cuota: number;
  fecha_vencimiento: string; // ISO 'YYYY-MM-DD'
  monto_esperado: number;
  monto_pagado: number;
  estado: EstadoCuota;
  fecha_pago_efectivo?: string | null;
}

export interface OperacionModel {
  nro_op: number;
  fecha: string;
  id_cliente: number;
  tipo: TipoOperacion;
  id_producto?: number | null;
  id_plan: number;
  id_cobrador_actual: number;
  id_zona?: number | null;
  id_vendedor?: number | null;
  monto_capital: number;
  monto_total: number;
  importe_cuota: number;
  saldo_restante: number;
  orden_recorrido: number;
  estado: EstadoOperacion;
  domicilio_cobro?: string;
  vend_pct?: number;
  ganancia_estimada?: number;
  recibo?: string;
  notas?: string;
  fecha_cancelacion?: string | null;
}

export interface RegistrarCobroDTO {
  nro_op: number;
  id_cobrador: number;
  monto: number;
  fecha_hora?: string; // ISO String
  coordenadas_gps?: string | null;
  observacion?: string | null;
  motivo_no_pago?: MotivoNoPago | null;
  idempotency_key?: string; // UUID v4
}

export interface DesgloseCuotaAfectada {
  id_cuota: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_anterior_pagado: number;
  monto_imputado: number;
  nuevo_monto_pagado: number;
  saldo_cuota_remanente: number;
  estado_anterior: EstadoCuota;
  nuevo_estado: EstadoCuota;
}

export interface AlertaMora {
  nivel: NivelMora;
  cuotas_vencidas_impagas: number;
  deuda_vencida_total: number;
  mensaje: string;
  requiere_accion_inmediata: boolean;
  sugerencia_retiro_mercaderia: boolean;
}

export interface ResultadoTransaccionCobro {
  exito: boolean;
  status: 'OK' | 'DUPLICATE' | 'REJECTED';
  id_cobro?: number;
  idempotency_key: string;
  nro_op: number;
  monto_recibido: number;
  monto_efectivamente_aplicado: number;
  cuotas_equivalentes: number;
  saldo_anterior: number;
  nuevo_saldo: number;
  estado_operacion_anterior: EstadoOperacion;
  nuevo_estado_operacion: EstadoOperacion;
  cuotas_totalmente_canceladas: number[];
  cuotas_parcialmente_pagadas: DesgloseCuotaAfectada[];
  detalle_completo_imputacion: DesgloseCuotaAfectada[];
  excedente_a_favor: number;
  alerta_mora_actualizada: AlertaMora;
  mensaje: string;
}

export interface RegistrarNoPagoDTO {
  nro_op: number;
  id_cobrador: number;
  motivo: MotivoNoPago;
  observacion?: string;
  coordenadas_gps?: string | null;
  fecha_hora?: string;
  idempotency_key?: string;
}
