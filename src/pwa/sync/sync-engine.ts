/**
 * CREDIT-ON — Motor de Sincronización en Segundo Plano (Offline-to-Cloud)
 * ========================================================================
 * Gestiona el envío de transacciones desde IndexedDB hacia Supabase cuando
 * se recupera la conectividad 4G en la calle.
 */

import { localDb, SyncQueueItem, ParadaHojaRuta } from '../db/pwa-db';
import { PaymentCascadeService } from '../../services/payment-service';
import { isSupabaseConfigured, supabase } from '../../renderer/src/lib/supabase';

export type SyncStatusListener = (status: {
  isOnline: boolean;
  pendientesCount: number;
  sincronizando: boolean;
  ultimoSync?: string;
}) => void;

export class PwaSyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private sincronizando: boolean = false;
  private listeners: SyncStatusListener[] = [];
  private paymentService: PaymentCascadeService;

  constructor(paymentService?: PaymentCascadeService) {
    this.paymentService = paymentService || new PaymentCascadeService(supabase || undefined);
    this.initNetworkListeners();
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notificarEstado();
      this.sincronizarPendientes();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notificarEstado();
    });
  }

  public suscribir(listener: SyncStatusListener): () => void {
    this.listeners.push(listener);
    this.notificarEstado();
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private async notificarEstado(): Promise<void> {
    const pendientes = await localDb.obtenerPendientesSync().catch(() => []);
    this.listeners.forEach((l) =>
      l({
        isOnline: this.isOnline,
        pendientesCount: pendientes.length,
        sincronizando: this.sincronizando,
        ultimoSync: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      })
    );
  }

  /**
   * Obtiene la posición GPS actual del dispositivo (si está disponible)
   */
  public async obtenerGpsActual(): Promise<string | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(`${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`),
        () => resolve(null),
        { timeout: 4000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Registra un cobro en la calle (funciona online u offline sin trabar al cobrador).
   */
  public async registrarCobroEnRuta(
    nro_op: number,
    id_cobrador: number,
    monto: number,
    observacion?: string
  ): Promise<{ idempotency_key: string }> {
    const key = PaymentCascadeService.generarIdempotencyKey();
    const gps = await this.obtenerGpsActual();
    const fechaHora = new Date().toISOString();

    // 1. Guardar de inmediato en la base de datos local
    await localDb.actualizarEstadoParada(nro_op, 'COBRADO', monto);

    // 2. Encolar para sincronización
    const itemQueue: SyncQueueItem = {
      idempotency_key: key,
      tipo_accion: 'COBRO',
      nro_op,
      id_cobrador,
      monto,
      observacion,
      coordenadas_gps: gps,
      fecha_hora: fechaHora,
      estado_sync: 'PENDING',
      intentos: 0,
    };

    await localDb.encolarAccion(itemQueue);
    this.notificarEstado();

    // 3. Si hay internet, disparar la sincronización en segundo plano
    if (this.isOnline) {
      this.sincronizarPendientes().catch((err) =>
        console.warn('[SyncEngine] Sincronización en segundo plano falló, reintentará luego:', err)
      );
    }

    return { idempotency_key: key };
  }

  /**
   * Registra una visita sin pago (local cerrado, ausente, sin dinero)
   */
  public async registrarNoPagoEnRuta(
    nro_op: number,
    id_cobrador: number,
    motivo: string,
    observacion?: string
  ): Promise<{ idempotency_key: string }> {
    const key = PaymentCascadeService.generarIdempotencyKey();
    const gps = await this.obtenerGpsActual();
    const fechaHora = new Date().toISOString();

    await localDb.actualizarEstadoParada(nro_op, 'NO_PAGO', undefined, motivo);

    const itemQueue: SyncQueueItem = {
      idempotency_key: key,
      tipo_accion: 'NO_PAGO',
      nro_op,
      id_cobrador,
      motivo_no_pago: motivo,
      observacion: observacion || `No pagó: ${motivo}`,
      coordenadas_gps: gps,
      fecha_hora: fechaHora,
      estado_sync: 'PENDING',
      intentos: 0,
    };

    await localDb.encolarAccion(itemQueue);
    this.notificarEstado();

    if (this.isOnline) {
      this.sincronizarPendientes().catch(() => {});
    }

    return { idempotency_key: key };
  }

  /**
   * Recorre la cola y envía cada transacción a Supabase
   */
  public async sincronizarPendientes(): Promise<void> {
    // Conserva la cola local hasta que exista una conexión configurada. Nunca
    // debemos marcar una cobranza como enviada sin una confirmación del servidor.
    if (this.sincronizando || !this.isOnline || !isSupabaseConfigured) return;

    this.sincronizando = true;
    this.notificarEstado();

    try {
      const pendientes = await localDb.obtenerPendientesSync();

      for (const item of pendientes) {
        try {
          if (item.tipo_accion === 'COBRO' && item.monto) {
            const resultado = await this.paymentService.registrarCobroEnSupabase({
              nro_op: item.nro_op,
              id_cobrador: item.id_cobrador,
              monto: item.monto,
              fecha_hora: item.fecha_hora,
              coordenadas_gps: item.coordenadas_gps,
              observacion: item.observacion,
              idempotency_key: item.idempotency_key,
            });
            if (!resultado.exito) throw new Error(resultado.mensaje);
          } else if (item.tipo_accion === 'NO_PAGO') {
            const resultado = await this.paymentService.registrarVisitaSinPago({
              nro_op: item.nro_op,
              id_cobrador: item.id_cobrador,
              motivo: (item.motivo_no_pago as any) || 'OTRO',
              observacion: item.observacion,
              coordenadas_gps: item.coordenadas_gps,
              fecha_hora: item.fecha_hora,
              idempotency_key: item.idempotency_key,
            });
            if (!resultado.exito) throw new Error(resultado.mensaje);
          }

          await localDb.marcarSincronizado(item.idempotency_key);
        } catch (err: any) {
          console.error(`[SyncEngine] Error en transacción ${item.idempotency_key}:`, err);
          await localDb.marcarFalloSync(item.idempotency_key, err.message || 'Error desconocido');
        }
      }
    } finally {
      this.sincronizando = false;
      this.notificarEstado();
    }
  }
}

export const syncEngine = new PwaSyncEngine();
