/**
 * CREDIT-ON — Base de Datos Local IndexedDB para la PWA Móvil
 * ==========================================================
 * Almacenamiento Offline-First:
 *  - 'hoja_ruta': listado de paradas y operaciones del cobrador.
 *  - 'cuotas_locales': cronogramas para imputación en cascada offline.
 *  - 'sync_queue': cola transaccional para sincronizar con Supabase.
 */

export interface ParadaHojaRuta {
  nro_op: number;
  orden_recorrido: number;
  id_cobrador: number;
  cliente: string;
  telefono?: string;
  domicilio: string;
  tipo: 'EFECTIVO' | 'PRODUCTO';
  producto?: string;
  cuota_diaria: number;
  saldo_restante: number;
  cuotas_vencidas: number;
  deuda_vencida: number;
  estado_visita: 'PENDIENTE' | 'COBRADO' | 'NO_PAGO';
  monto_cobrado_hoy?: number;
  motivo_no_pago?: string;
  hora_visita?: string;
}

export interface SyncQueueItem {
  idempotency_key: string;
  tipo_accion: 'COBRO' | 'NO_PAGO';
  nro_op: number;
  id_cobrador: number;
  monto?: number;
  motivo_no_pago?: string;
  observacion?: string;
  coordenadas_gps?: string | null;
  fecha_hora: string;
  estado_sync: 'PENDING' | 'SYNCED' | 'FAILED';
  intentos: number;
  error_mensaje?: string;
}

export class PwaIndexedDB {
  private dbName = 'credit_on_pwa_db';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  public async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para la hoja de ruta diaria
        if (!db.objectStoreNames.contains('hoja_ruta')) {
          const storeHoja = db.createObjectStore('hoja_ruta', { keyPath: 'nro_op' });
          storeHoja.createIndex('orden_recorrido', 'orden_recorrido', { unique: false });
          storeHoja.createIndex('estado_visita', 'estado_visita', { unique: false });
        }

        // Store para la cola de sincronización
        if (!db.objectStoreNames.contains('sync_queue')) {
          const storeSync = db.createObjectStore('sync_queue', { keyPath: 'idempotency_key' });
          storeSync.createIndex('estado_sync', 'estado_sync', { unique: false });
          storeSync.createIndex('fecha_hora', 'fecha_hora', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Error al abrir IndexedDB en PWA'));
      };
    });
  }

  // ---------------------------------------------------------------------------
  // HOJA DE RUTA
  // ---------------------------------------------------------------------------

  public async guardarHojaDeRuta(items: ParadaHojaRuta[]): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('hoja_ruta', 'readwrite');
      const store = tx.objectStore('hoja_ruta');
      store.clear(); // Limpia la jornada anterior
      items.forEach((item) => store.put(item));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async obtenerHojaDeRuta(): Promise<ParadaHojaRuta[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('hoja_ruta', 'readonly');
      const store = tx.objectStore('hoja_ruta');
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as ParadaHojaRuta[]).sort(
          (a, b) => a.orden_recorrido - b.orden_recorrido
        );
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async actualizarEstadoParada(
    nro_op: number,
    estado: 'COBRADO' | 'NO_PAGO',
    monto?: number,
    motivo?: string
  ): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('hoja_ruta', 'readwrite');
      const store = tx.objectStore('hoja_ruta');
      const getReq = store.get(nro_op);

      getReq.onsuccess = () => {
        const item: ParadaHojaRuta = getReq.result;
        if (!item) return resolve();

        item.estado_visita = estado;
        item.hora_visita = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        if (estado === 'COBRADO' && monto) {
          item.monto_cobrado_hoy = monto;
          item.saldo_restante = Math.max(item.saldo_restante - monto, 0);
        } else if (estado === 'NO_PAGO' && motivo) {
          item.motivo_no_pago = motivo;
        }

        store.put(item);
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------------------------------------------------------------------
  // COLA DE SINCRONIZACIÓN (SYNC QUEUE)
  // ---------------------------------------------------------------------------

  public async encolarAccion(item: SyncQueueItem): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.put(item);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async obtenerPendientesSync(): Promise<SyncQueueItem[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();

      request.onsuccess = () => {
        const pendientes = (request.result as SyncQueueItem[]).filter(
          (item) => item.estado_sync === 'PENDING'
        );
        resolve(pendientes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async marcarSincronizado(idempotency_key: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.get(idempotency_key);

      req.onsuccess = () => {
        const item = req.result as SyncQueueItem;
        if (item) {
          item.estado_sync = 'SYNCED';
          store.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public async marcarFalloSync(idempotency_key: string, error: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.get(idempotency_key);

      req.onsuccess = () => {
        const item = req.result as SyncQueueItem;
        if (item) {
          item.intentos = (item.intentos || 0) + 1;
          item.error_mensaje = error;
          store.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const localDb = new PwaIndexedDB();
