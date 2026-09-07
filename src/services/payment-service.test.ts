/**
 * CREDIT-ON — Tests Unitarios y de Integración: Servicio Transaccional de Pagos
 * ==============================================================================
 * 
 * Valida los 8 casos críticos de negocio:
 *  1. Pago parcial ($2.500 sobre cuota de $4.000).
 *  2. Cascada acumulada al día siguiente ($5.500 cancela remanente de $1.500 + cuota de hoy $4.000).
 *  3. Pago exacto de cuota ($4.000).
 *  4. Pago adelantado múltiple ($9.000 con cuota de $3.000 cubre 3 cuotas).
 *  5. Cancelación total anticipada de operación.
 *  6. Detección de alerta de Mora Crítica y Retiro de Mercadería.
 *  7. Manejo de idempotencia (retransmisión sin duplicar cobro).
 *  8. Registro de visita sin cobro (local cerrado / sin dinero).
 */

import { PaymentCascadeService } from './payment-service';
import type { OperacionModel, CuotaModel, RegistrarCobroDTO } from '../types/payment';

export function runPaymentServiceTests(): void {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, details?: string): void {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title} ${details ? `-> ${details}` : ''}`);
      failed++;
    }
  }

  console.log('\n================================================================');
  console.log('CREDIT-ON: Suite de Pruebas - Servicio Transaccional de Imputación');
  console.log('================================================================\n');

  const service = new PaymentCascadeService();

  // Helper para generar operación base
  function crearOperacionMock(overrides?: Partial<OperacionModel>): OperacionModel {
    return {
      nro_op: 101,
      fecha: '2026-09-01',
      id_cliente: 1,
      tipo: 'PRODUCTO',
      id_producto: 5,
      id_plan: 2,
      id_cobrador_actual: 1,
      monto_capital: 100000,
      monto_total: 168000,
      importe_cuota: 4000,
      saldo_restante: 168000,
      orden_recorrido: 1,
      estado: 'VIGENTE',
      ...overrides,
    };
  }

  // Helper para generar cuotas base
  function crearCuotasMock(cantidad: number, importe: number = 4000): CuotaModel[] {
    const cuotas: CuotaModel[] = [];
    for (let i = 1; i <= cantidad; i++) {
      const dia = String(i + 1).padStart(2, '0');
      cuotas.push({
        id_cuota: i,
        nro_op: 101,
        numero_cuota: i,
        fecha_vencimiento: `2026-09-${dia}`,
        monto_esperado: importe,
        monto_pagado: 0,
        estado: 'PENDIENTE',
      });
    }
    return cuotas;
  }

  // ---------------------------------------------------------------------------
  // CASO 1: Pago Parcial ($2.500 sobre cuota de $4.000)
  // ---------------------------------------------------------------------------
  console.log('--- TEST 1: Pago Parcial ($2.500 sobre cuota de $4.000) ---');
  {
    const op = crearOperacionMock();
    const cuotas = crearCuotasMock(5, 4000);
    const dto: RegistrarCobroDTO = {
      nro_op: 101,
      id_cobrador: 1,
      monto: 2500,
      fecha_hora: '2026-09-02T10:00:00Z',
    };

    const res = service.procesarCascadaEnMemoria(op, cuotas, dto);

    assert(res.exito === true, 'Transacción exitosa');
    assert(res.nuevo_saldo === 165500, 'Saldo restante disminuye de $168.000 a $165.500');
    assert(res.cuotas_parcialmente_pagadas.length === 1, '1 cuota queda en estado PARCIAL');
    assert(res.cuotas_parcialmente_pagadas[0].saldo_cuota_remanente === 1500, 'Resta cobrar $1.500 de la cuota 1');
    assert(res.cuotas_equivalentes === 0.625, 'Cuotas equivalentes abonadas = 0.625');
    assert(res.nuevo_estado_operacion === 'VIGENTE', 'Operación continúa VIGENTE');
  }

  // ---------------------------------------------------------------------------
  // CASO 2: Cascada acumulativa al día siguiente ($5.500 cancela $1.500 + $4.000)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 2: Cascada acumulativa ($5.500 cancela remanente de $1.500 y cuota 2) ---');
  {
    const op = crearOperacionMock({ saldo_restante: 165500 });
    const cuotas = crearCuotasMock(5, 4000);
    // La cuota 1 arrastra pago parcial previo de $2.500
    cuotas[0].monto_pagado = 2500;
    cuotas[0].estado = 'PARCIAL';

    const dto: RegistrarCobroDTO = {
      nro_op: 101,
      id_cobrador: 1,
      monto: 5500, // $1.500 para completar cuota 1 + $4.000 para cuota 2
      fecha_hora: '2026-09-03T11:00:00Z',
    };

    const res = service.procesarCascadaEnMemoria(op, cuotas, dto);

    assert(res.exito === true, 'Transacción exitosa');
    assert(res.cuotas_totalmente_canceladas.length === 2, 'Se cancelan 2 cuotas en total');
    assert(res.cuotas_totalmente_canceladas.includes(1), 'Cuota 1 completada');
    assert(res.cuotas_totalmente_canceladas.includes(2), 'Cuota 2 cancelada completamente');
    assert(res.cuotas_parcialmente_pagadas.length === 0, 'No quedan cuotas parciales');
    assert(res.nuevo_saldo === 160000, 'Saldo disminuye de $165.500 a $160.000');
    assert(res.cuotas_equivalentes === 1.375, 'Cuotas equivalentes abonadas = 1.375 (5500/4000)');
  }

  // ---------------------------------------------------------------------------
  // CASO 3: Pago exacto de cuota ($4.000)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 3: Pago exacto de cuota del día ($4.000) ---');
  {
    const op = crearOperacionMock();
    const cuotas = crearCuotasMock(3, 4000);
    const dto: RegistrarCobroDTO = {
      nro_op: 101,
      id_cobrador: 1,
      monto: 4000,
    };

    const res = service.procesarCascadaEnMemoria(op, cuotas, dto);

    assert(res.exito === true, 'Cobro registrado correctamente');
    assert(res.cuotas_totalmente_canceladas.length === 1 && res.cuotas_totalmente_canceladas[0] === 1, 'Cuota 1 cancelada');
    assert(res.cuotas_equivalentes === 1.0, 'Cuotas equivalentes = 1.0');
    assert(res.nuevo_saldo === 164000, 'Nuevo saldo = $164.000');
  }

  // ---------------------------------------------------------------------------
  // CASO 4: Pago adelantado múltiple ($9.000 con cuota de $3.000 cubre 3 cuotas)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 4: Pago adelantado múltiple ($9.000 cubre 3 cuotas de $3.000) ---');
  {
    const op = crearOperacionMock({
      importe_cuota: 3000,
      monto_total: 60000,
      saldo_restante: 60000,
    });
    const cuotas = crearCuotasMock(5, 3000);
    const dto: RegistrarCobroDTO = {
      nro_op: 101,
      id_cobrador: 1,
      monto: 9000,
    };

    const res = service.procesarCascadaEnMemoria(op, cuotas, dto);

    assert(res.cuotas_totalmente_canceladas.length === 3, 'Cancela exactamente 3 cuotas');
    assert(res.cuotas_totalmente_canceladas.join(',') === '1,2,3', 'Cancela cuotas N° 1, 2 y 3');
    assert(res.cuotas_equivalentes === 3.0, 'Cuotas equivalentes = 3.0');
    assert(res.nuevo_saldo === 51000, 'Saldo disminuye en $9.000 (de 60.000 a 51.000)');
    assert(res.excedente_a_favor === 0, 'Sin excedente monetario');
  }

  // ---------------------------------------------------------------------------
  // CASO 5: Cancelación total de crédito
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 5: Cancelación total anticipada de crédito ---');
  {
    const op = crearOperacionMock({
      monto_total: 12000,
      saldo_restante: 12000,
      importe_cuota: 4000,
    });
    const cuotas = crearCuotasMock(3, 4000); // 3 cuotas de $4.000
    const dto: RegistrarCobroDTO = {
      nro_op: 101,
      id_cobrador: 1,
      monto: 12000,
    };

    const res = service.procesarCascadaEnMemoria(op, cuotas, dto);

    assert(res.nuevo_estado_operacion === 'CANCELADO', 'Operación pasa a estado CANCELADO');
    assert(res.nuevo_saldo === 0, 'Saldo restante queda en $0');
    assert(res.cuotas_totalmente_canceladas.length === 3, 'Todas las 3 cuotas canceladas');
  }

  // ---------------------------------------------------------------------------
  // CASO 6: Detección y alerta de Mora Crítica y Retiro de Mercadería
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 6: Alerta de Mora Crítica y Retiro de Mercadería ---');
  {
    const cuotas = crearCuotasMock(10, 4000);
    // Simulamos que pasaron 5 días sin pagar (cuotas 1 a 5 vencidas al 2026-09-08)
    const hoy = '2026-09-08';
    const alerta = PaymentCascadeService.evaluarMora('PRODUCTO', cuotas, hoy);

    assert(alerta.nivel === 'MORA_CRITICA' || alerta.nivel === 'EVALUAR_RETIRO', 'Alerta en nivel crítico');
    assert(alerta.cuotas_vencidas_impagas >= 4, 'Al menos 4 cuotas vencidas detectadas');
    assert(alerta.sugerencia_retiro_mercaderia === true, 'Bandera de sugerencia_retiro_mercaderia activada');
    assert(alerta.requiere_accion_inmediata === true, 'Requiere acción inmediata activada');
  }

  // ---------------------------------------------------------------------------
  // CASO 7: Mock de Idempotencia en Supabase RPC
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 7: Idempotencia en cliente Supabase (Reintento de Cobro) ---');
  {
    const mockSupabase = {
      rpc: async (func: string, params: any) => {
        if (params.p_idempotency_key === 'dup-uuid-123') {
          return {
            data: {
              status: 'DUPLICATE',
              cobro: { id_cobro: 999, monto_cobrado: 4000, cuotas_equivalentes: 1 },
            },
            error: null,
          };
        }
        return {
          data: {
            status: 'OK',
            id_cobro: 1001,
            monto_cobrado: params.p_monto,
            cuotas_equivalentes: 1,
            saldo_restante: 164000,
            operacion_estado: 'VIGENTE',
          },
          error: null,
        };
      },
      from: () => ({ insert: async () => ({ data: null, error: null }), select: () => ({}) }),
    };

    const srvRpc = new PaymentCascadeService(mockSupabase as any);

    srvRpc.registrarCobroEnSupabase({
      nro_op: 101,
      id_cobrador: 1,
      monto: 4000,
      idempotency_key: 'dup-uuid-123',
    }).then((resDup) => {
      assert(resDup.status === 'DUPLICATE', 'Detecta transacción duplicada por idempotency_key');
      assert(resDup.id_cobro === 999, 'Recupera id_cobro original sin volver a imputar');
    });
  }

  // ---------------------------------------------------------------------------
  // CASO 8: Registro de visita infructuosa (No pagó)
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST 8: Registro de Visita Infructuosa (Local Cerrado) ---');
  {
    service.registrarVisitaSinPago({
      nro_op: 101,
      id_cobrador: 1,
      motivo: 'CERRADO',
      observacion: 'Local comercial con rejas bajas 10:45 AM',
      coordenadas_gps: '-27.7833,-64.2667',
    }).then((resVisita) => {
      assert(resVisita.exito === true, 'Asienta registro de no-pago para auditoría');
    });
  }

  // ---------------------------------------------------------------------------
  // Balance de resultados
  // ---------------------------------------------------------------------------
  setTimeout(() => {
    console.log('\n================================================================');
    console.log(`TOTAL RESULTADOS: ${passed} PASS, ${failed} FAIL`);
    console.log('================================================================\n');
  }, 200);
}

runPaymentServiceTests();

