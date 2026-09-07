-- =============================================================================
-- CREDIT-ON — Migración 001: Tablas Maestras (Catálogos)
-- Base de datos: PostgreSQL / Supabase
-- Versión: 1.0.0 | Fecha: 2026-09-04
-- =============================================================================
-- Ejecutar en Supabase SQL Editor en el ORDEN indicado.
-- Las foreign keys imponen el orden: primero tablas sin dependencias.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIÓN: pgcrypto — para uuid_generate_v4() si se necesita en futuras
-- tablas. Supabase ya la tiene habilitada por defecto.
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================================================
-- 1. ZONAS DE COBRO
--    Representa la división geográfica / lógica del recorrido.
--    Un cobrador puede tener una o varias zonas asignadas.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS zonas (
    id_zona     SERIAL PRIMARY KEY,
    nombre      VARCHAR(80)  NOT NULL,
    descripcion TEXT,
    activo      BOOLEAN DEFAULT TRUE,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  zonas IS 'División geográfica/lógica del circuito de cobro (ej. Norte, Centro, Barrio Belgrano).';
COMMENT ON COLUMN zonas.nombre IS 'Nombre descriptivo de la zona, p. ej. "Zona Ariel - Efectivo Norte".';

-- ===========================================================================
-- 2. COBRADORES
--    Soporta jerarquía de supervisión (cobrador → sub-cobrador).
--    id_supervisor NULL indica que es un cobrador raíz (no tiene superior).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS cobradores (
    id_cobrador          SERIAL PRIMARY KEY,
    nombre               VARCHAR(100) NOT NULL,
    telefono             VARCHAR(30),
    id_supervisor        INT REFERENCES cobradores(id_cobrador) ON DELETE SET NULL,
    porcentaje_comision  DECIMAL(5,2)  DEFAULT 10.00
        CONSTRAINT ck_cobradores_pct CHECK (porcentaje_comision BETWEEN 0 AND 100),
    activo               BOOLEAN DEFAULT TRUE,
    creado_en            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  cobradores IS 'Cobradores de campo (Ariel, Álvaro, Antonela, Oriana) y sub-cobradores (Emanuel, Walter → Oriana).';
COMMENT ON COLUMN cobradores.id_supervisor IS 'FK auto-referencial: NULL en cobradores principales, id del supervisor en sub-cobradores.';
COMMENT ON COLUMN cobradores.porcentaje_comision IS 'Porcentaje de comisión sobre el total recaudado en el día (ej. 10.00 = 10%).';

-- ===========================================================================
-- 3. VENDEDORES
--    Originan la operación. Perciben una comisión porcentual (vend_pct).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS vendedores (
    id_vendedor SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    activo      BOOLEAN DEFAULT TRUE,
    creado_en   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendedores IS 'Agentes de ventas que originan créditos/operaciones y cobran comisión.';

-- ===========================================================================
-- 4. CLIENTES
--    DNI con restricción UNIQUE nullable: se aplica solo cuando el valor no
--    es NULL para permitir clientes sin DNI cargado (migración histórica).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente     SERIAL PRIMARY KEY,
    nombre         VARCHAR(150) NOT NULL,
    -- Se normaliza a UPPER(TRIM()) en la capa de aplicación antes de insertar.
    dni            VARCHAR(20),
    domicilio      VARCHAR(200) NOT NULL DEFAULT '',
    telefono       VARCHAR(30),
    telefono_fijo  VARCHAR(30),
    -- Ej: 'BUENO', 'REGULAR', 'MOROSO', 'LEGALES', 'INHABILITADO'
    calificacion   VARCHAR(50)  DEFAULT 'BUENO',
    notas          TEXT,
    fecha_alta     DATE DEFAULT CURRENT_DATE,
    creado_en      TIMESTAMPTZ DEFAULT NOW(),
    -- Índice único parcial: unicidad solo cuando dni NO es NULL
    CONSTRAINT uq_clientes_dni UNIQUE (dni)
);

COMMENT ON TABLE  clientes IS 'Personas o comercios que reciben préstamos o productos en cuotas.';
COMMENT ON COLUMN clientes.calificacion IS 'Historial crediticio interno: BUENO, REGULAR, MOROSO, LEGALES, INHABILITADO.';
COMMENT ON COLUMN clientes.nombre IS 'Siempre almacenar en UPPER(TRIM(nombre)) desde la app para evitar duplicados.';

-- Índice de búsqueda por nombre (ILIKE-friendly)
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes USING gin (to_tsvector('spanish', nombre));
-- Índice secundario para búsqueda por DNI parcial
CREATE INDEX IF NOT EXISTS idx_clientes_dni    ON clientes (dni);

-- ===========================================================================
-- 5. PRODUCTOS (Catálogo de Mercadería)
--    Incluye control de inventario integrado: stock en depósito y en la calle.
--    El estado del stock se actualiza vía triggers al crear/cancelar operaciones.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS productos (
    id_producto      SERIAL PRIMARY KEY,
    nombre           VARCHAR(150) NOT NULL,
    -- Ej: 'AIRE ACONDICIONADO', 'FREEZER', 'HELADERA', 'TV', 'CELULAR', 'MUEBLE'
    categoria        VARCHAR(80),
    descripcion      TEXT,
    costo            DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_deposito   INT NOT NULL DEFAULT 0
        CONSTRAINT ck_productos_stock_deposito CHECK (stock_deposito >= 0),
    -- Unidades actualmente financiadas en la calle (estado EN_CALLE_FINANCIADO)
    stock_calle      INT NOT NULL DEFAULT 0
        CONSTRAINT ck_productos_stock_calle CHECK (stock_calle >= 0),
    activo           BOOLEAN DEFAULT TRUE,
    creado_en        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  productos IS 'Catálogo de mercadería con control de stock físico (depósito) y financiado (calle).';
COMMENT ON COLUMN productos.costo IS 'Precio de costo de adquisición. Se usa para calcular el valor del stock en depósito.';
COMMENT ON COLUMN productos.stock_deposito IS 'Unidades disponibles físicamente para vender.';
COMMENT ON COLUMN productos.stock_calle IS 'Unidades entregadas en operaciones vigentes (estado EN_CALLE_FINANCIADO).';

-- ===========================================================================
-- 6. PLANES DE CUOTAS
--    EFECTIVO: 26 días / 30%, 35 días / 40%
--    PRODUCTO:  42, 84, 135, 175, 220 días (tasa_interes = NULL)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS planes (
    id_plan          SERIAL PRIMARY KEY,
    tipo             VARCHAR(10) NOT NULL
        CONSTRAINT ck_planes_tipo CHECK (tipo IN ('EFECTIVO', 'PRODUCTO')),
    dias             INT NOT NULL
        CONSTRAINT ck_planes_dias CHECK (dias > 0),
    tasa_interes     DECIMAL(5,2)
        CONSTRAINT ck_planes_tasa CHECK (tasa_interes IS NULL OR tasa_interes >= 0),
    descripcion      VARCHAR(100),
    activo           BOOLEAN DEFAULT TRUE
);

COMMENT ON TABLE  planes IS 'Planes de financiación disponibles: EFECTIVO (26/35 días) y PRODUCTO (42/84/135/175/220 días).';
COMMENT ON COLUMN planes.tasa_interes IS 'Solo aplica a planes EFECTIVO. Para PRODUCTO es NULL (el precio de lista ya incluye el margen).';

-- ===========================================================================
-- 7. PRECIOS_PLAN (Tabla puente Producto × Plan)
--    Reemplaza la "matriz de cuotas" de LISTA_DE_PRECIO.
--    La cuota_diaria se congela en operaciones.importe_cuota al dar de alta.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS precios_plan (
    id_producto   INT NOT NULL REFERENCES productos(id_producto) ON DELETE CASCADE,
    id_plan       INT NOT NULL REFERENCES planes(id_plan) ON DELETE RESTRICT,
    cuota_diaria  DECIMAL(12,2) NOT NULL
        CONSTRAINT ck_precios_plan_cuota CHECK (cuota_diaria > 0),
    monto_total   DECIMAL(12,2) NOT NULL
        CONSTRAINT ck_precios_plan_total CHECK (monto_total > 0),
    vigente_desde DATE DEFAULT CURRENT_DATE,
    PRIMARY KEY (id_producto, id_plan)
);

COMMENT ON TABLE  precios_plan IS 'Matriz tarifaria: cuánto se cobra por día y en total para cada producto × plan combinado.';
COMMENT ON COLUMN precios_plan.cuota_diaria IS 'Importe diario que paga el cliente. Se copia y congela en operaciones.importe_cuota.';

-- ===========================================================================
-- 8. FERIADOS
--    Tabla parametrizable de días inhábiles de cobro.
--    El motor de calendario consulta esta tabla al generar el cronograma.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS feriados (
    fecha       DATE PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    -- 'NACIONAL', 'PROVINCIAL', 'LOCAL', 'PUENTE'
    tipo        VARCHAR(20) DEFAULT 'NACIONAL'
);

COMMENT ON TABLE feriados IS 'Días inhábiles de cobro. El generador de cronograma salta estas fechas al siguiente día hábil.';

-- Semilla inicial: feriados nacionales Argentina 2026
INSERT INTO feriados (fecha, descripcion, tipo) VALUES
    ('2026-01-01', 'Año Nuevo',                          'NACIONAL'),
    ('2026-02-16', 'Carnaval',                           'NACIONAL'),
    ('2026-02-17', 'Carnaval',                           'NACIONAL'),
    ('2026-03-24', 'Día de la Memoria',                  'NACIONAL'),
    ('2026-04-02', 'Día del Veterano y Caídos',          'NACIONAL'),
    ('2026-04-03', 'Viernes Santo',                      'NACIONAL'),
    ('2026-05-01', 'Día del Trabajador',                 'NACIONAL'),
    ('2026-05-25', 'Día de la Patria',                   'NACIONAL'),
    ('2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes', 'NACIONAL'),
    ('2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', 'NACIONAL'),
    ('2026-07-09', 'Día de la Independencia',            'NACIONAL'),
    ('2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín', 'NACIONAL'),
    ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'NACIONAL'),
    ('2026-11-20', 'Día de la Soberanía Nacional',       'NACIONAL'),
    ('2026-12-08', 'Inmaculada Concepción de María',     'NACIONAL'),
    ('2026-12-25', 'Navidad',                            'NACIONAL')
ON CONFLICT (fecha) DO NOTHING;
