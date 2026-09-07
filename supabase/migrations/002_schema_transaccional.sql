-- =============================================================================
-- CREDIT-ON — Migración 002: Tablas Transaccionales
-- Base de datos: PostgreSQL / Supabase
-- Versión: 1.0.0 | Fecha: 2026-09-04
-- Prerequisito: Ejecutar 001_schema_maestro.sql primero
-- =============================================================================

-- ===========================================================================
-- 1. OPERACIONES
--    Núcleo transaccional. Cada fila = un crédito o venta financiada.
--    Reemplaza la hoja "BASE DATOS" de BASE_DE_DATOS_OPERACIONES_A.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS operaciones (
    nro_op              SERIAL PRIMARY KEY,
    fecha               DATE        NOT NULL DEFAULT CURRENT_DATE,
    id_cliente          INT         NOT NULL REFERENCES clientes(id_cliente),
    tipo                VARCHAR(10) NOT NULL
        CONSTRAINT ck_operaciones_tipo CHECK (tipo IN ('EFECTIVO', 'PRODUCTO')),
    id_producto         INT         REFERENCES productos(id_producto),
    id_plan             INT         NOT NULL REFERENCES planes(id_plan),
    id_cobrador_actual  INT         REFERENCES cobradores(id_cobrador),
    id_zona             INT         REFERENCES zonas(id_zona),
    id_vendedor         INT         REFERENCES vendedores(id_vendedor),

    -- Montos (importe_cuota se congela del tarifario al momento del alta)
    monto_capital       DECIMAL(12,2) NOT NULL DEFAULT 0,   -- monto desembolsado / costo producto
    monto_total         DECIMAL(12,2) NOT NULL,             -- total a devolver (capital + intereses/margen)
    importe_cuota       DECIMAL(12,2) NOT NULL,             -- cuota diaria pactada
    saldo_restante      DECIMAL(12,2) NOT NULL,             -- se actualiza con cada pago

    -- Orden de visita del cobrador en el día
    orden_recorrido     INT DEFAULT 0,

    -- Estados del ciclo de vida:
    -- 'VIGENTE'   → operación activa, en cobro diario
    -- 'CANCELADO' → todas las cuotas pagadas
    -- 'RETIRADO'  → producto recuperado por falta de pago
    -- 'LEGALES'   → derivado a proceso legal / abogado
    -- 'REFINANCIADO' → renegociación de deuda
    estado              VARCHAR(20) DEFAULT 'VIGENTE'
        CONSTRAINT ck_operaciones_estado
            CHECK (estado IN ('VIGENTE','CANCELADO','RETIRADO','LEGALES','REFINANCIADO')),

    -- Domicilio snapshot (puede diferir del domicilio actual del cliente)
    domicilio_cobro     VARCHAR(200),

    -- Comisiones
    vend_pct            DECIMAL(5,2) DEFAULT 0,
    ganancia_estimada   DECIMAL(12,2) DEFAULT 0,   -- monto_total - monto_capital

    recibo              VARCHAR(30),
    notas               TEXT,
    fecha_cancelacion   DATE,
    creado_en           TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ DEFAULT NOW(),

    -- Validaciones cruzadas
    CONSTRAINT ck_op_producto_requerido
        CHECK (tipo = 'EFECTIVO' OR id_producto IS NOT NULL),
    CONSTRAINT ck_op_saldo_positivo
        CHECK (saldo_restante >= 0),
    CONSTRAINT ck_op_cuota_positiva
        CHECK (importe_cuota > 0)
);

COMMENT ON TABLE  operaciones IS 'Tabla central: cada fila es un crédito (EFECTIVO) o venta financiada (PRODUCTO). Reemplaza hoja "BASE DATOS".';
COMMENT ON COLUMN operaciones.saldo_restante IS 'Se actualiza por trigger o stored procedure con cada cobro registrado.';
COMMENT ON COLUMN operaciones.domicilio_cobro IS 'Snapshot del domicilio al momento del alta. El cobrador visita este domicilio, independientemente de cambios futuros en clientes.domicilio.';
COMMENT ON COLUMN operaciones.ganancia_estimada IS 'Precalculado: monto_total - monto_capital. Permite queries rápidas de rentabilidad.';

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_op_cobrador_estado  ON operaciones (id_cobrador_actual, estado);
CREATE INDEX IF NOT EXISTS idx_op_cliente          ON operaciones (id_cliente);
CREATE INDEX IF NOT EXISTS idx_op_estado           ON operaciones (estado);
CREATE INDEX IF NOT EXISTS idx_op_fecha            ON operaciones (fecha);
CREATE INDEX IF NOT EXISTS idx_op_zona             ON operaciones (id_zona);

-- ===========================================================================
-- 2. CUOTAS
--    Cronograma de vencimientos pre-generado (una fila por cuota de la op.).
--    Se genera al crear la operación usando la función fn_generar_cronograma().
--    Reemplaza la mecánica de "celda = día" de los Excel.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS cuotas (
    id_cuota          BIGSERIAL PRIMARY KEY,
    nro_op            INT         NOT NULL REFERENCES operaciones(nro_op) ON DELETE CASCADE,
    numero_cuota      INT         NOT NULL,   -- 1, 2, 3, ... N (N = plan.dias)
    fecha_vencimiento DATE        NOT NULL,
    monto_esperado    DECIMAL(12,2) NOT NULL,
    monto_pagado      DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado            VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
        CONSTRAINT ck_cuotas_estado
            CHECK (estado IN ('PENDIENTE','PARCIAL','PAGADA','CONDONADA')),
    fecha_pago_efectivo DATE,                -- cuándo se pagó realmente
    UNIQUE (nro_op, numero_cuota)
);

COMMENT ON TABLE  cuotas IS 'Cronograma de vencimientos de una operación. Una fila por día de cobro (lunes a sábado, sin feriados).';
COMMENT ON COLUMN cuotas.numero_cuota IS 'Número secuencial de la cuota dentro del plan (1 a N).';
COMMENT ON COLUMN cuotas.fecha_vencimiento IS 'Fecha hábil calculada por fn_generar_cronograma(): excluye domingos y feriados.';
COMMENT ON COLUMN cuotas.estado IS 'PENDIENTE → sin pago | PARCIAL → pago incompleto | PAGADA → cobro completo | CONDONADA → se perdonó.';

-- Índice crítico para queries de cobranza del día
CREATE INDEX IF NOT EXISTS idx_cuotas_op_vto     ON cuotas (nro_op, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado_vto ON cuotas (estado, fecha_vencimiento);

-- ===========================================================================
-- 3. COBROS
--    Registro de cada transacción de pago en campo.
--    Un cobrador puede registrar múltiples cobros en el día (adelantos, etc.).
--    Reemplaza la hoja "COBROS UNIFICADO".
-- ===========================================================================
CREATE TABLE IF NOT EXISTS cobros (
    id_cobro            BIGSERIAL PRIMARY KEY,
    nro_op              INT         NOT NULL REFERENCES operaciones(nro_op),
    id_cuota            BIGINT      REFERENCES cuotas(id_cuota),
    id_cobrador         INT         NOT NULL REFERENCES cobradores(id_cobrador),
    fecha_hora          TIMESTAMPTZ DEFAULT NOW(),
    monto_cobrado       DECIMAL(12,2) NOT NULL
        CONSTRAINT ck_cobros_monto CHECK (monto_cobrado > 0),
    -- Cuántas cuotas cubre este pago (puede ser fraccionario: 0.5, 1, 2.0, etc.)
    cuotas_equivalentes DECIMAL(10,4) NOT NULL DEFAULT 1.0
        CONSTRAINT ck_cobros_cuotas_eq CHECK (cuotas_equivalentes > 0),
    rendido_en_caja     BOOLEAN DEFAULT FALSE,
    -- Captura GPS opcional para auditoría de campo (formato: "lat,lng")
    coordenadas_gps     VARCHAR(50),
    -- Motivo de no-pago si se registra sin cobrar
    -- Ej: 'CERRADO', 'NO_TENIA_DINERO', 'PASAR_MAS_TARDE', 'AUSENTE'
    motivo_no_pago      VARCHAR(50),
    observacion         VARCHAR(200),
    -- UUID para deduplicación offline (generado en el cliente PWA)
    idempotency_key     UUID DEFAULT gen_random_uuid() UNIQUE,
    creado_en           TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  cobros IS 'Transacciones de cobro diario. Cada fila = un pago registrado por el cobrador (online o sincronizado desde IndexedDB).';
COMMENT ON COLUMN cobros.cuotas_equivalentes IS 'Fracción de cuota que cubre este pago: 1.0 = cuota completa, 0.5 = medio pago, 2.0 = dos cuotas adelantadas.';
COMMENT ON COLUMN cobros.rendido_en_caja IS 'TRUE una vez que el administrador cierra la caja del día y confirma la rendición del cobrador.';
COMMENT ON COLUMN cobros.idempotency_key IS 'UUID generado en el cliente PWA antes de enviar. Previene duplicaciones al re-sincronizar offline.';

-- Índices para reportes de caja y performance
CREATE INDEX IF NOT EXISTS idx_cobros_op           ON cobros (nro_op);
CREATE INDEX IF NOT EXISTS idx_cobros_cobrador_dia ON cobros (id_cobrador, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_cobros_rendicion    ON cobros (rendido_en_caja, id_cobrador);
CREATE INDEX IF NOT EXISTS idx_cobros_idempotency  ON cobros (idempotency_key);

-- ===========================================================================
-- 4. ASIGNACIONES_COBRADOR (Historial de cambios de cobrador)
--    Resuelve la relación N:M entre operación y cobrador a lo largo del tiempo.
--    Permite auditar quién cobró cada tramo del crédito.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS asignaciones_cobrador (
    id            SERIAL PRIMARY KEY,
    nro_op        INT  NOT NULL REFERENCES operaciones(nro_op) ON DELETE CASCADE,
    id_cobrador   INT  NOT NULL REFERENCES cobradores(id_cobrador),
    fecha_desde   DATE NOT NULL,
    fecha_hasta   DATE,                 -- NULL indica asignación vigente
    motivo        VARCHAR(100),
    CONSTRAINT ck_asig_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde)
);

CREATE INDEX IF NOT EXISTS idx_asig_op       ON asignaciones_cobrador (nro_op);
CREATE INDEX IF NOT EXISTS idx_asig_cobrador ON asignaciones_cobrador (id_cobrador, fecha_desde);

COMMENT ON TABLE asignaciones_cobrador IS 'Historial completo de asignaciones de cobrador por operación. Permite reasignar sin perder trazabilidad.';

-- ===========================================================================
-- 5. CAPITALIZACIONES
--    Aportes de capital de socios/inversores al pool de caja general.
--    Ej: "RECIBÍ JUANQUI $900.000", "RECIBÍ HERNAN $300.000"
-- ===========================================================================
CREATE TABLE IF NOT EXISTS capitalizaciones (
    id_capitalizacion SERIAL PRIMARY KEY,
    fecha             DATE          NOT NULL DEFAULT CURRENT_DATE,
    aportante         VARCHAR(100)  NOT NULL,
    monto             DECIMAL(14,2) NOT NULL
        CONSTRAINT ck_cap_monto CHECK (monto > 0),
    concepto          VARCHAR(200),
    comprobante       VARCHAR(80),
    creado_en         TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE capitalizaciones IS 'Aportes externos al pool de caja: capitalizaciones de socios o inversores.';

-- ===========================================================================
-- 6. COMPRAS_PRODUCTOS (Ingreso de mercadería)
--    Registra la compra al proveedor y actualiza el stock en depósito.
--    El trigger trg_compra_actualizar_stock incrementa productos.stock_deposito.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS compras_productos (
    id_compra       SERIAL PRIMARY KEY,
    fecha           DATE          NOT NULL DEFAULT CURRENT_DATE,
    id_producto     INT           REFERENCES productos(id_producto),
    descripcion     VARCHAR(200),
    cantidad        INT           NOT NULL DEFAULT 1
        CONSTRAINT ck_compra_cantidad CHECK (cantidad > 0),
    costo_unitario  DECIMAL(12,2) NOT NULL
        CONSTRAINT ck_compra_cu CHECK (costo_unitario >= 0),
    costo_total     DECIMAL(12,2) NOT NULL,  -- cantidad * costo_unitario (validado por trigger)
    proveedor       VARCHAR(150),
    factura         VARCHAR(80),
    -- 'PAGADO', 'PENDIENTE', 'SEÑADO'
    estado_pago     VARCHAR(30)  DEFAULT 'PAGADO'
        CONSTRAINT ck_compra_estado CHECK (estado_pago IN ('PAGADO','PENDIENTE','SEÑADO')),
    notas           TEXT,
    creado_en       TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE compras_productos IS 'Ingreso de mercadería al depósito. Dispara trigger que incrementa productos.stock_deposito.';

-- ===========================================================================
-- 7. RENDIMIENTO_DIARIO (Objetivo de cobro por cobrador)
--    Almacena el EXIG. DIARIO (objetivo) que complementa los cobros reales.
--    Solo se persiste si el objetivo se define manualmente. Si no, se calcula
--    desde operaciones activas (ver vw_rendimiento_calculado).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS rendimiento_diario (
    id            SERIAL PRIMARY KEY,
    id_cobrador   INT         NOT NULL REFERENCES cobradores(id_cobrador),
    fecha         DATE        NOT NULL,
    tipo          VARCHAR(10) NOT NULL
        CONSTRAINT ck_rend_tipo CHECK (tipo IN ('EFECTIVO','PRODUCTO')),
    exigible      DECIMAL(12,2) NOT NULL DEFAULT 0,
    UNIQUE (id_cobrador, fecha, tipo)
);

COMMENT ON TABLE rendimiento_diario IS 'Objetivo de cobro diario por cobrador y tipo. Complementa vw_rendimiento_calculado.';
