/**
 * CREDIT-ON — Motor de Calendario y Generador de Cronograma de Cuotas
 * =====================================================================
 * Implementa las reglas de negocio del cobro diario Lunes–Sábado:
 *
 *  1. Exclusión de domingos (DOW = 0).
 *  2. Exclusión de feriados (tabla parametrizable).
 *  3. Imputación de pagos en cascada (parciales, completos y adelantos).
 *
 * Este módulo es usado por:
 *  - Backend: confirmación del cronograma antes de persistir en Supabase.
 *  - Desktop Electron: preview del plan de cuotas en el formulario de alta.
 *  - PWA Cobrador: cálculo offline sin depender del servidor.
 *
 * @module calendar-engine
 */

// ============================================================================
// TIPOS
// ============================================================================

export type EstadoCuota = 'PENDIENTE' | 'PARCIAL' | 'PAGADA' | 'CONDONADA';
export type NivelMora   = 'AL_DIA' | 'ALERTA' | 'MORA_CRITICA' | 'EVALUAR_RETIRO';

export interface Cuota {
  numero_cuota:      number;       // 1-N
  fecha_vencimiento: Date;
  monto_esperado:    number;       // en pesos
  monto_pagado:      number;
  estado:            EstadoCuota;
  fecha_pago_efectivo?: Date;
}

export interface ResultadoCobro {
  cuotas_afectadas:    Cuota[];    // cuotas que se modificaron
  cuotas_equivalentes: number;     // cuántas cuotas cubre el pago (puede ser fraccionario)
  saldo_restante:      number;
  excedente:           number;     // si el cliente pagó de más
  operacion_cancelada: boolean;
}

export interface OpcionesCalendario {
  fechaInicio:  Date;
  numeroCuotas: number;
  importeCuota: number;
  feriados?:    Date[];            // si vacío, se usa el set por defecto
}

// ============================================================================
// SET DE FERIADOS POR DEFECTO (Argentina 2026 — actualizar anualmente)
// Formato: 'YYYY-MM-DD'
// ============================================================================

const FERIADOS_2026_DEFAULT = new Set<string>([
  '2026-01-01', // Año Nuevo
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-03-24', // Día de la Memoria
  '2026-04-02', // Día del Veterano
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajador
  '2026-05-25', // Día de la Patria
  '2026-06-15', // Güemes
  '2026-06-20', // Belgrano
  '2026-07-09', // Independencia
  '2026-08-17', // San Martín
  '2026-10-12', // Diversidad Cultural
  '2026-11-20', // Soberanía Nacional
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
]);

// ============================================================================
// UTILIDADES DE CALENDARIO
// ============================================================================

/**
 * Normaliza una fecha o string ISO al mediodía local (12:00:00).
 * Esto previene desfases de día calendario causados por UTC vs zona horaria local.
 */
export function parseLocalDate(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0);
  }
  const parts = input.split('T')[0].split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Formatea una fecha como 'YYYY-MM-DD' para comparación con el set de feriados.
 */
export function toISODate(date: Date): string {
  const normalized = parseLocalDate(date);
  const y = normalized.getFullYear();
  const m = String(normalized.getMonth() + 1).padStart(2, '0');
  const d = String(normalized.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Clona una fecha y suma N días (no muta el original).
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Retorna TRUE si la fecha es domingo (0 en JS, igual que PostgreSQL DOW).
 */
function esDomingo(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Retorna TRUE si la fecha es un feriado en el set provisto.
 */
function esFeriado(date: Date, feriadoSet: Set<string>): boolean {
  return feriadoSet.has(toISODate(date));
}

/**
 * Retorna TRUE si la fecha es un día hábil de cobro (Lunes–Sábado, no feriado).
 */
export function esDiaHabil(date: Date, feriadoSet: Set<string> = FERIADOS_2026_DEFAULT): boolean {
  return !esDomingo(date) && !esFeriado(date, feriadoSet);
}

/**
 * Dado un set de feriados personalizado (array de Date), crea el Set<string>.
 */
function buildFeriadoSet(feriados?: Date[]): Set<string> {
  if (!feriados || feriados.length === 0) return FERIADOS_2026_DEFAULT;
  return new Set(feriados.map(toISODate));
}

// ============================================================================
// ALGORITMO PRINCIPAL — GENERADOR DE CRONOGRAMA
// ============================================================================

/**
 * ## fn_generar_cronograma (TypeScript)
 *
 * Genera el array de cuotas con sus fechas de vencimiento respetando:
 *  - Lunes a Sábado únicamente (excluye domingos).
 *  - Feriados cargados en la tabla `feriados` (parámetro opcional).
 *
 * ### Complejidad
 * O(N + F) donde:
 *  - N = número de cuotas del plan
 *  - F = feriados que caen dentro del período
 *
 * ### Fórmula de estimación de días corridos
 * ```
 * Días corridos ≈ N + ⌊N / 6⌋ + Feriados_en_período
 * ```
 * (Por cada 6 días de cobro hay 1 domingo de descanso)
 *
 * @param opciones - Configuración del cronograma
 * @returns        - Array de Cuota con fechas_vencimiento calculadas
 *
 * @example
 * ```ts
 * const cuotas = generarCronograma({
 *   fechaInicio:  new Date('2026-09-04'),
 *   numeroCuotas: 26,
 *   importeCuota: 5000,
 * });
 * // cuota[0].fecha_vencimiento → lunes 2026-09-07
 * // cuota[25].fecha_vencimiento → último día hábil del plan
 * ```
 */
export function generarCronograma(opciones: OpcionesCalendario): Cuota[] {
  const { fechaInicio, numeroCuotas, importeCuota, feriados } = opciones;

  if (numeroCuotas <= 0) throw new Error('numeroCuotas debe ser mayor a 0');
  if (importeCuota <= 0)  throw new Error('importeCuota debe ser mayor a 0');

  const feriadoSet = buildFeriadoSet(feriados);
  const cuotas: Cuota[] = [];

  // Iteramos días corridos desde fechaInicio + 1 (el cobro empieza al día siguiente)
  let fechaActual  = parseLocalDate(fechaInicio);
  let cuotaNum     = 0;
  const maxIteraciones = numeroCuotas * 4; // tope de seguridad
  let iteraciones  = 0;

  while (cuotaNum < numeroCuotas) {
    iteraciones++;
    if (iteraciones > maxIteraciones) {
      throw new Error(
        `generarCronograma: límite de iteraciones alcanzado (${maxIteraciones}). ` +
        `Solo se generaron ${cuotaNum} de ${numeroCuotas} cuotas.`
      );
    }

    fechaActual = addDays(fechaActual, 1);

    // Saltar domingos y feriados
    if (!esDiaHabil(fechaActual, feriadoSet)) continue;

    cuotaNum++;
    cuotas.push({
      numero_cuota:      cuotaNum,
      fecha_vencimiento: new Date(fechaActual),
      monto_esperado:    importeCuota,
      monto_pagado:      0,
      estado:            'PENDIENTE',
    });
  }

  return cuotas;
}

/**
 * Calcula la fecha estimada de finalización de un plan sin generar el cronograma completo.
 * Útil para el preview en el formulario de alta ("Finaliza el dd/mm/yyyy").
 */
export function calcularFechaFin(
  fechaInicio:  Date,
  numeroCuotas: number,
  feriados?:    Date[]
): Date {
  const cuotas = generarCronograma({
    fechaInicio,
    numeroCuotas,
    importeCuota: 1, // dummy, solo nos interesa la fecha
    feriados,
  });
  return cuotas[cuotas.length - 1].fecha_vencimiento;
}

/**
 * Calcula cuántos días corridos (incluyendo domingos y feriados) tarda un plan.
 * Equivale a: dias_cuotas + ⌊dias_cuotas / 6⌋ + feriados_en_período
 */
export function calcularDiasCorridos(
  fechaInicio:  Date,
  numeroCuotas: number,
  feriados?:    Date[]
): number {
  const fechaFin = calcularFechaFin(fechaInicio, numeroCuotas, feriados);
  const diff = fechaFin.getTime() - fechaInicio.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ============================================================================
// MOTOR DE IMPUTACIÓN DE PAGOS EN CASCADA (versión TypeScript / offline)
// Espeja la lógica de fn_registrar_cobro (PL/pgSQL) para uso en la PWA.
// ============================================================================

/**
 * ## imputarPago
 *
 * Aplica un monto de pago sobre el array de cuotas de una operación
 * siguiendo la mecánica de cascada:
 *
 * 1. Busca cuotas PENDIENTE o PARCIAL ordenadas por fecha_vencimiento ASC.
 * 2. Por cada cuota:
 *    a. Si el disponible >= faltante → pago completo → avanzar a la siguiente.
 *    b. Si el disponible < faltante  → pago parcial  → parar.
 *    c. Si el disponible = 0         → parar.
 * 3. Retorna las cuotas modificadas (shallow copy para inmutabilidad).
 *
 * @param cuotas          - Array completo de cuotas de la operación
 * @param montoCobrado    - Monto efectivamente cobrado en este pago
 * @param importeCuota    - Cuota diaria pactada en la operación
 * @param saldoActual     - Saldo restante actual de la operación
 * @param fechaPago       - Fecha del cobro (default: hoy)
 * @returns ResultadoCobro con las cuotas modificadas y el nuevo saldo
 *
 * @example
 * ```ts
 * // Pago completo de cuota del día ($4.000)
 * const r1 = imputarPago(cuotas, 4000, 4000, 48000);
 * // r1.cuotas_equivalentes → 1
 * // r1.excedente           → 0
 *
 * // Pago parcial ($2.500 sobre cuota de $4.000)
 * const r2 = imputarPago(cuotas, 2500, 4000, 48000);
 * // r2.cuotas_equivalentes → 0.625
 * // Cuota 1 queda en estado PARCIAL con monto_pagado=2500
 *
 * // Pago adelantado ($9.000 = 2.25 cuotas de $4.000)
 * const r3 = imputarPago(cuotas, 9000, 4000, 48000);
 * // r3.cuotas_equivalentes → 2.25
 * // Cuota 1 y 2 → PAGADA, Cuota 3 → PARCIAL
 * ```
 */
export function imputarPago(
  cuotas:       Cuota[],
  montoCobrado: number,
  importeCuota: number,
  saldoActual:  number,
  fechaPago:    Date = new Date()
): ResultadoCobro {
  if (montoCobrado <= 0) {
    throw new Error(`imputarPago: montoCobrado debe ser > 0 (recibido: ${montoCobrado})`);
  }

  // Trabajamos con copias superficiales para no mutar el original
  const cuotasActualizadas: Cuota[] = cuotas.map(c => ({ ...c }));
  const cuotasAfectadas:    Cuota[] = [];

  // Solo procesamos cuotas PENDIENTE o PARCIAL, en orden cronológico
  const pendientes = cuotasActualizadas
    .filter(c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL')
    .sort((a, b) => a.fecha_vencimiento.getTime() - b.fecha_vencimiento.getTime());

  let disponible       = montoCobrado;
  let cuotasEquivalentes = 0;

  for (const cuota of pendientes) {
    if (disponible <= 0) break;

    const faltante = cuota.monto_esperado - cuota.monto_pagado;

    if (disponible >= faltante) {
      // ----------------------------------------------------------------
      // CASO A: Pago completo de esta cuota
      // ----------------------------------------------------------------
      cuota.monto_pagado       = cuota.monto_esperado;
      cuota.estado             = 'PAGADA';
      cuota.fecha_pago_efectivo = new Date(fechaPago);
      cuotasEquivalentes       += faltante / importeCuota;
      disponible               -= faltante;
      cuotasAfectadas.push(cuota);

    } else {
      // ----------------------------------------------------------------
      // CASO B: Pago parcial (no alcanza para cubrir esta cuota)
      // ----------------------------------------------------------------
      cuota.monto_pagado += disponible;
      cuota.estado        = 'PARCIAL';
      cuotasEquivalentes += disponible / importeCuota;
      cuotasAfectadas.push(cuota);
      disponible = 0;
    }
  }

  const nuevoSaldo = Math.max(saldoActual - montoCobrado, 0);

  // Verificar si la operación quedó cancelada (sin cuotas pendientes/parciales)
  const quedanPendientes = cuotasActualizadas.some(
    c => c.estado === 'PENDIENTE' || c.estado === 'PARCIAL'
  );

  return {
    cuotas_afectadas:    cuotasAfectadas,
    cuotas_equivalentes: parseFloat(cuotasEquivalentes.toFixed(4)),
    saldo_restante:      nuevoSaldo,
    excedente:           disponible,           // > 0 si pagó de más
    operacion_cancelada: !quedanPendientes,
  };
}

// ============================================================================
// CÁLCULO DE MORA (para la UI de la PWA — semáforo de alertas)
// ============================================================================

/**
 * Calcula el nivel de mora de una operación dado su array de cuotas.
 *
 * Niveles:
 *  - AL_DIA:         0 cuotas vencidas sin pagar
 *  - ALERTA:         1-2 cuotas vencidas
 *  - MORA_CRITICA:   3-5 cuotas vencidas
 *  - EVALUAR_RETIRO: 6+ cuotas vencidas (dispara alerta de recuperación de mercadería)
 */
export function calcularNivelMora(cuotas: Cuota[], hoy: Date = new Date()): {
  nivel:          NivelMora;
  cuotas_vencidas: number;
  monto_vencido:  number;
} {
  const inicio_hoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const vencidas = cuotas.filter(c =>
    (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') &&
    c.fecha_vencimiento < inicio_hoy
  );

  const cuotas_vencidas = vencidas.length;
  const monto_vencido   = vencidas.reduce(
    (sum, c) => sum + (c.monto_esperado - c.monto_pagado), 0
  );

  let nivel: NivelMora;
  if (cuotas_vencidas === 0)                      nivel = 'AL_DIA';
  else if (cuotas_vencidas <= 2)                  nivel = 'ALERTA';
  else if (cuotas_vencidas <= 5)                  nivel = 'MORA_CRITICA';
  else                                             nivel = 'EVALUAR_RETIRO';

  return { nivel, cuotas_vencidas, monto_vencido };
}

/**
 * Retorna el importe a exigir hoy a un cliente:
 *  - Si hay cuotas vencidas: suma el saldo de cuotas vencidas + cuota del día.
 *  - Si está al día: solo la cuota del día.
 */
export function calcularExigibleHoy(cuotas: Cuota[], hoy: Date = new Date()): {
  cuota_hoy:      Cuota | null;
  exigible_total: number;
  detalle:        string;
} {
  const inicio_hoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // Cuotas vencidas con saldo
  const vencidas = cuotas
    .filter(c =>
      (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') &&
      c.fecha_vencimiento < inicio_hoy
    )
    .sort((a, b) => a.fecha_vencimiento.getTime() - b.fecha_vencimiento.getTime());

  // Cuota del día (la próxima PENDIENTE/PARCIAL con fecha >= hoy)
  const cuota_hoy = cuotas.find(c =>
    (c.estado === 'PENDIENTE' || c.estado === 'PARCIAL') &&
    c.fecha_vencimiento >= inicio_hoy
  ) ?? null;

  const monto_vencido  = vencidas.reduce((s, c) => s + (c.monto_esperado - c.monto_pagado), 0);
  const monto_hoy      = cuota_hoy ? (cuota_hoy.monto_esperado - cuota_hoy.monto_pagado) : 0;
  const exigible_total = monto_vencido + monto_hoy;

  let detalle = '';
  if (vencidas.length > 0) {
    detalle = `Debe $${monto_vencido.toLocaleString('es-AR')} (${vencidas.length} cuota${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}) + cuota de hoy $${monto_hoy.toLocaleString('es-AR')}`;
  } else {
    detalle = `Cuota del día: $${monto_hoy.toLocaleString('es-AR')}`;
  }

  return { cuota_hoy, exigible_total, detalle };
}

// ============================================================================
// CÁLCULO DE CUOTA PARA PRÉSTAMOS EN EFECTIVO
// ============================================================================

/**
 * Dado un monto de capital y un plan de efectivo, calcula la cuota diaria.
 *
 * Fórmula: cuota_diaria = capital × (1 + tasa) / dias
 *
 * Ejemplo:
 *   capital=$100.000, tasa=30%, dias=26
 *   cuota = 100.000 × 1.30 / 26 = $5.000/día
 */
export function calcularCuotaEfectivo(
  capital:      number,
  tasaPctOrDias: number,   // ej. 30 para 30%, o 26 para 26 días si diasPlan es undefined
  diasPlan?:    number
): {
  cuota_diaria: number;
  cuotaDiaria: number;
  monto_total: number;
  montoTotal: number;
  total: number;
  interes_total: number;
  interes: number;
  dias: number;
  tasaPct: number;
} {
  let tasaPct = 30;
  let dias = 26;

  if (diasPlan !== undefined) {
    // Firma tradicional: (capital, tasaPct, diasPlan)
    tasaPct = tasaPctOrDias;
    dias = diasPlan;
  } else {
    // Firma simplificada: (capital, dias)
    dias = tasaPctOrDias;
    if (dias === 26) {
      tasaPct = 30;
    } else if (dias === 35) {
      tasaPct = 40;
    } else {
      tasaPct = Math.round(30 + ((dias - 26) * 10 / 9));
    }
  }

  const safeCapital = Math.max(0, capital || 0);
  const safeDias = Math.max(1, dias || 1);
  const safeTasa = Math.max(0, tasaPct || 0);

  const monto_total = Math.round(safeCapital * (1 + safeTasa / 100));
  const cuota_diaria = Math.round(monto_total / safeDias);
  const interes_total = monto_total - safeCapital;

  return {
    cuota_diaria,
    cuotaDiaria: cuota_diaria,
    monto_total,
    montoTotal: monto_total,
    total: monto_total,
    interes_total,
    interes: interes_total,
    dias: safeDias,
    tasaPct: safeTasa,
  };
}

// ============================================================================
// PLANES OFICIALES Y MATRIZ DE CUOTAS (LISTA DE PRECIO HISTÓRICA CREDIT-ON)
// ============================================================================

export interface PlanProductoDef {
  cuotas: number;
  semanas: number;
  recargoPct: number;
  recargoPorcentaje: string;
  coeficiente: number;
  label: string;
  descripcion: string;
}

export const PLANES_PRODUCTO_OFICIALES: PlanProductoDef[] = [
  { cuotas: 42,  semanas: 7,  recargoPct: 53, recargoPorcentaje: '+53%', coeficiente: 1.53, label: 'Plan 42 Cuotas',  descripcion: '7 Semanas (+53% recargo)' },
  { cuotas: 84,  semanas: 14, recargoPct: 63, recargoPorcentaje: '+63%', coeficiente: 1.63, label: 'Plan 84 Cuotas',  descripcion: '14 Semanas (+63% recargo)' },
  { cuotas: 135, semanas: 23, recargoPct: 73, recargoPorcentaje: '+73%', coeficiente: 1.73, label: 'Plan 135 Cuotas', descripcion: '23 Semanas (+73% recargo)' },
  { cuotas: 175, semanas: 30, recargoPct: 83, recargoPorcentaje: '+83%', coeficiente: 1.83, label: 'Plan 175 Cuotas', descripcion: '30 Semanas (+83% recargo)' },
  { cuotas: 220, semanas: 37, recargoPct: 93, recargoPorcentaje: '+93%', coeficiente: 1.93, label: 'Plan 220 Cuotas', descripcion: '37 Semanas (+93% recargo)' },
];

export interface PlanEfectivoDef {
  dias: number;
  tasaPct: number;
  tasaInteres: number;
  label: string;
  descripcion: string;
}

export const PLANES_EFECTIVO_OFICIALES: PlanEfectivoDef[] = [
  { dias: 26, tasaPct: 30, tasaInteres: 30, label: 'Plan 26 Días', descripcion: 'Tasa fija 30%' },
  { dias: 35, tasaPct: 40, tasaInteres: 40, label: 'Plan 35 Días', descripcion: 'Tasa fija 40%' },
];

/**
 * Calcula la cuota y total financiado de un producto según la matriz de la LISTA DE PRECIO.
 * Si el número de cuotas no es uno de los estándar (42, 84, 135, 175, 220), se interpola
 * o se aplica un recargo proporcional de referencia.
 */
export function calcularCuotaProducto(
  costoBase: number,
  cuotas: number
): {
  cuota_diaria: number;
  cuotaDiaria: number;
  cuota_semanal: number;
  cuotaSemanal: number;
  monto_total: number;
  montoTotal: number;
  total: number;
  recargo_monto: number;
  recargoMonto: number;
  recargo: number;
  interes: number;
  recargo_pct: number;
  recargoPct: number;
  recargoPorcentaje: string;
  semanas: number;
} {
  const safeCosto = Math.max(0, costoBase || 0);
  const safeCuotas = Math.max(1, cuotas || 1);

  const planOficial = PLANES_PRODUCTO_OFICIALES.find(p => p.cuotas === safeCuotas);
  let recargoPct = 63; // Default 84 cuotas
  let semanas = Math.max(1, Math.round(safeCuotas / 6));

  if (planOficial) {
    recargoPct = planOficial.recargoPct;
    semanas = planOficial.semanas;
  } else {
    // Estimación lineal basada en la progresión original: base 53% a las 42 cuotas + ~0.22% por cuota adicional
    recargoPct = Math.round(53 + ((safeCuotas - 42) * (40 / 178)));
  }

  const monto_total = Math.round(safeCosto * (1 + recargoPct / 100));
  const cuota_diaria = Math.round(monto_total / safeCuotas);
  const cuota_semanal = Math.round(monto_total / semanas);
  const recargo_monto = monto_total - safeCosto;
  const recargoPorcentaje = `+${recargoPct}%`;

  return {
    cuota_diaria,
    cuotaDiaria: cuota_diaria,
    cuota_semanal,
    cuotaSemanal: cuota_semanal,
    monto_total,
    montoTotal: monto_total,
    total: monto_total,
    recargo_monto,
    recargoMonto: recargo_monto,
    recargo: recargo_monto,
    interes: recargo_monto,
    recargo_pct: recargoPct,
    recargoPct,
    recargoPorcentaje,
    semanas,
  };
}


// ============================================================================
// TESTS UNITARIOS EMBEBIDOS (ejecutar con: npx ts-node calendar-engine.ts test)
// ============================================================================

export function runTests(): void {
  let ok = 0;
  let fail = 0;

  function assert(condition: boolean, msg: string): void {
    if (condition) { console.log(`  ✅ ${msg}`); ok++; }
    else           { console.error(`  ❌ ${msg}`); fail++; }
  }

  console.log('\n=== CREDIT-ON — Calendar Engine Tests ===\n');

  // ---- TEST 1: La primera cuota de un lunes cae el martes --------------------
  console.log('TEST 1: Primera cuota desde un lunes');
  {
    const cuotas = generarCronograma({
      fechaInicio: parseLocalDate('2026-09-07'), // lunes
      numeroCuotas: 1,
      importeCuota: 5000,
    });
    assert(cuotas[0].fecha_vencimiento.getDay() === 2, 'Primera cuota cae el martes');
    assert(toISODate(cuotas[0].fecha_vencimiento) === '2026-09-08', 'Primera cuota es 2026-09-08');
  }

  // ---- TEST 2: Se saltan domingos correctamente --------------------------------
  console.log('\nTEST 2: Exclusión de domingos');
  {
    const cuotas = generarCronograma({
      fechaInicio: parseLocalDate('2026-09-05'), // sábado
      numeroCuotas: 3,
      importeCuota: 4000,
    });
    const fechas = cuotas.map(c => toISODate(c.fecha_vencimiento));
    // Después del sábado viene el lunes (se salta el domingo)
    assert(fechas[0] === '2026-09-07', 'Primera cuota = lunes 07/09 (saltó el domingo 06/09)');
    assert(fechas[1] === '2026-09-08', 'Segunda cuota = martes 08/09');
    assert(fechas[2] === '2026-09-09', 'Tercera cuota = miércoles 09/09');
    assert(!fechas.some(f => parseLocalDate(f).getDay() === 0), 'Ninguna cuota cae en domingo');
  }

  // ---- TEST 3: Se saltan feriados ----------------------------------------------
  console.log('\nTEST 3: Exclusión de feriados');
  {
    // El 25/05/2026 es feriado nacional
    const cuotas = generarCronograma({
      fechaInicio: parseLocalDate('2026-05-23'), // sábado
      numeroCuotas: 3,
      importeCuota: 5000,
    });
    const fechas = cuotas.map(c => toISODate(c.fecha_vencimiento));
    assert(!fechas.includes('2026-05-24'), 'No aparece el domingo 24/05');
    assert(!fechas.includes('2026-05-25'), 'No aparece el feriado 25/05 (Día de la Patria)');
    assert(fechas[0] === '2026-05-26', 'Primera cuota cae el martes 26/05 (saltó domingo y feriado)');
  }

  // ---- TEST 4: Plan de 26 días — duración en días corridos --------------------
  console.log('\nTEST 4: Plan EFECTIVO 26 días');
  {
    const inicio = parseLocalDate('2026-09-04');
    const cuotas = generarCronograma({ fechaInicio: inicio, numeroCuotas: 26, importeCuota: 5000 });
    assert(cuotas.length === 26, '26 cuotas generadas');
    const diasCorridos = calcularDiasCorridos(inicio, 26);
    // 26 días de cobro + ~4 domingos + feriados ≈ 31 días corridos
    assert(diasCorridos >= 30 && diasCorridos <= 36,
      `Días corridos razonables: ${diasCorridos} (esperado 30-36)`);
    console.log(`    → Inicio: ${toISODate(inicio)} | Fin: ${toISODate(cuotas[25].fecha_vencimiento)} | Días corridos: ${diasCorridos}`);
  }

  // ---- TEST 5: Imputación de pago completo ------------------------------------
  console.log('\nTEST 5: Pago completo de cuota del día');
  {
    const cuotas = generarCronograma({ fechaInicio: new Date('2026-09-04'), numeroCuotas: 5, importeCuota: 4000 });
    const r = imputarPago(cuotas, 4000, 4000, 20000);
    assert(r.cuotas_afectadas.length === 1, '1 cuota afectada');
    assert(r.cuotas_afectadas[0].estado === 'PAGADA', 'Cuota 1 queda PAGADA');
    assert(r.cuotas_equivalentes === 1, 'cuotas_equivalentes = 1');
    assert(r.saldo_restante === 16000, 'Saldo restante = $16.000');
    assert(r.excedente === 0, 'Sin excedente');
  }

  // ---- TEST 6: Pago parcial ---------------------------------------------------
  console.log('\nTEST 6: Pago parcial ($2.500 sobre cuota de $4.000)');
  {
    const cuotas = generarCronograma({ fechaInicio: new Date('2026-09-04'), numeroCuotas: 5, importeCuota: 4000 });
    const r = imputarPago(cuotas, 2500, 4000, 20000);
    assert(r.cuotas_afectadas[0].estado === 'PARCIAL', 'Cuota 1 queda PARCIAL');
    assert(r.cuotas_afectadas[0].monto_pagado === 2500, 'monto_pagado = $2.500');
    assert(r.cuotas_equivalentes === 0.625, 'cuotas_equivalentes = 0.625');
    assert(r.saldo_restante === 17500, 'Saldo restante = $17.500');
    assert(r.excedente === 0, 'Sin excedente');
  }

  // ---- TEST 7: Pago adelantado (2+ cuotas) ------------------------------------
  console.log('\nTEST 7: Pago adelantado ($9.000 = 2.25 cuotas de $4.000)');
  {
    const cuotas = generarCronograma({ fechaInicio: new Date('2026-09-04'), numeroCuotas: 5, importeCuota: 4000 });
    const r = imputarPago(cuotas, 9000, 4000, 20000);
    assert(r.cuotas_afectadas.length === 3, '3 cuotas afectadas');
    assert(r.cuotas_afectadas[0].estado === 'PAGADA', 'Cuota 1 → PAGADA');
    assert(r.cuotas_afectadas[1].estado === 'PAGADA', 'Cuota 2 → PAGADA');
    assert(r.cuotas_afectadas[2].estado === 'PARCIAL', 'Cuota 3 → PARCIAL (solo $1.000)');
    assert(r.cuotas_equivalentes === 2.25, 'cuotas_equivalentes = 2.25');
    assert(r.excedente === 0, 'Sin excedente');
  }

  // ---- TEST 8: Pago que cancela la operación ----------------------------------
  console.log('\nTEST 8: Pago final cancela la operación');
  {
    const cuotas = generarCronograma({ fechaInicio: new Date('2026-09-04'), numeroCuotas: 2, importeCuota: 4000 });
    const r = imputarPago(cuotas, 8000, 4000, 8000);
    assert(r.operacion_cancelada === true, 'Operación marcada como cancelada');
    assert(r.saldo_restante === 0, 'Saldo restante = $0');
  }

  // ---- TEST 9: Cálculo de cuota efectivo --------------------------------------
  console.log('\nTEST 9: Cuota préstamo efectivo $100.000 / 26 días / 30%');
  {
    const { cuota_diaria, monto_total } = calcularCuotaEfectivo(100000, 30, 26);
    assert(cuota_diaria === 5000, `Cuota diaria = $${cuota_diaria} (esperado $5.000)`);
    assert(monto_total === 130000, `Monto total = $${monto_total} (esperado $130.000)`);
  }

  // ---- TEST 10: Cálculo de mora -----------------------------------------------
  console.log('\nTEST 10: Cálculo de nivel de mora');
  {
    const hoy   = new Date('2026-09-10');
    // Cuota del 05/09 (lunes) vencida y sin pagar
    const cuota_vencida: Cuota = {
      numero_cuota: 1,
      fecha_vencimiento: new Date('2026-09-07'),
      monto_esperado: 4000,
      monto_pagado: 0,
      estado: 'PENDIENTE',
    };
    const cuota_actual: Cuota = {
      numero_cuota: 2,
      fecha_vencimiento: new Date('2026-09-10'),
      monto_esperado: 4000,
      monto_pagado: 0,
      estado: 'PENDIENTE',
    };
    const { nivel, cuotas_vencidas } = calcularNivelMora([cuota_vencida, cuota_actual], hoy);
    assert(nivel === 'ALERTA', `Nivel de mora = ${nivel} (esperado ALERTA)`);
    assert(cuotas_vencidas === 1, `Cuotas vencidas = ${cuotas_vencidas}`);
  }

  // ---- Resumen ----------------------------------------------------------------
  console.log(`\n${'='.repeat(44)}`);
  console.log(`RESULTADO: ${ok} tests OK, ${fail} tests FALLIDOS`);
  console.log('='.repeat(44));

  if (fail > 0 && typeof process !== 'undefined') {
    process.exit(1);
  }
}

// Ejecutar tests solo en Node.js cuando se invoque con argumento test
if (typeof process !== 'undefined' && process.argv && process.argv.includes('test')) {
  runTests();
}
