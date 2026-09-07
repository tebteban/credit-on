# Esquema de base de datos relacional — Sistema de cobros CREDIT-ON

Basado en el análisis de los 6 archivos Excel actuales (`Informe_Sistema_de_Cobros.md`). Propone las tablas necesarias para reemplazar `LISTA_DE_PRECIO`, `BASE_DE_DATOS_OPERACIONES_A`, `PLANILLA_DE_COBRO_*` y `ARIEL_PORCENTAJE` por una única base de datos normalizada.

---

## 1. Tablas maestras (catálogos)

### `clientes`
| Campo | Tipo | Notas |
|---|---|---|
| id_cliente | INT PK | |
| nombre | VARCHAR(150) | ⚠️ normalizar (trim, mayúsculas) para evitar duplicados por doble espacio |
| dni | VARCHAR(20) | idealmente UNIQUE, hoy no siempre está cargado |
| domicilio | VARCHAR(200) | |
| telefono | VARCHAR(30) | |
| telefono_fijo | VARCHAR(30) | |
| calificacion | VARCHAR(50) | historial de comportamiento de pago |
| fecha_alta | DATE | |

### `vendedores`
| Campo | Tipo |
|---|---|
| id_vendedor PK | INT |
| nombre | VARCHAR(100) |
| activo | BOOLEAN |

### `cobradores`
| Campo | Tipo | Notas |
|---|---|---|
| id_cobrador PK | INT | |
| nombre | VARCHAR(100) | |
| id_supervisor | INT FK → cobradores.id_cobrador (NULL) | resuelve los "sub-cobradores" (Emanuel/Walter → Oriana) |
| activo | BOOLEAN | |

### `productos`
| Campo | Tipo |
|---|---|
| id_producto PK | INT |
| nombre | VARCHAR(150) |
| categoria | VARCHAR(80) — aire ac., freezer, heladera, TV, celular, mueble... |
| costo | DECIMAL(12,2) |

### `planes`
Reemplaza la matriz de la `LISTA_DE_PRECIO` (planes de 26/35 días para efectivo, 42/84/135/175/220 para productos).

| Campo | Tipo |
|---|---|
| id_plan PK | INT |
| tipo | ENUM('EFECTIVO','PRODUCTO') |
| dias | INT |
| tasa_interes | DECIMAL(5,2) — solo aplica a EFECTIVO (30%, 40%) |

### `precios_plan`
Tabla puente producto × plan → resuelve la "matriz de cuotas" de `LISTA_DE_PRECIO`, conectada por relación en vez de copiada a mano.

| Campo | Tipo |
|---|---|
| id_producto FK | INT |
| id_plan FK | INT |
| cuota_diaria | DECIMAL(12,2) |
| monto_total | DECIMAL(12,2) |
| PK compuesta | (id_producto, id_plan) |

---

## 2. Tablas transaccionales

### `operaciones` (reemplaza hoja `BASE DATOS`)
| Campo | Tipo | Notas |
|---|---|---|
| nro_op PK | INT | = "N° OP" actual |
| fecha | DATE | fecha de alta |
| id_cliente FK | INT | |
| tipo | ENUM('EFECTIVO','PRODUCTO') | |
| id_producto FK | INT NULL | NULL si es préstamo en efectivo |
| id_plan FK | INT | |
| importe_cuota | DECIMAL(12,2) | cuota diaria (se puede traer de `precios_plan` pero se congela acá por si cambia el tarifario) |
| monto_total | DECIMAL(12,2) | |
| estado | VARCHAR(30) | vacío / "CANCELADO" / "RETIRADO" / "ABOGADO"... |
| id_cobrador_actual FK | INT | cobrador vigente (ver `asignaciones_cobrador` para el histórico) |
| id_vendedor FK | INT | |
| recibo | VARCHAR(30) | |
| vend_pct | DECIMAL(5,2) | comisión del vendedor |
| ganancia | DECIMAL(12,2) | |
| domicilio | VARCHAR(200) | snapshot al momento del alta (puede diferir del domicilio actual del cliente) |

### `cobros` (reemplaza hoja `COBROS UNIFICADO`)
Una fila por jornada de cobro por operación.

| Campo | Tipo | Notas |
|---|---|---|
| id_cobro PK | BIGINT | |
| nro_op FK | INT | |
| fecha | DATE | |
| cuotas_pagadas | DECIMAL(10,4) | "PAGA" — puede ser fraccionario |
| importe_cuota | DECIMAL(12,2) | valor de la cuota ese día |
| monto_cobrado | DECIMAL(12,2) | "TOTAL" cobrado ese día |
| id_cobrador FK | INT | quien cobró ese día (puede diferir del cobrador_actual de la operación) |
| estado | VARCHAR(30) | p.ej. "CANCELADO" |
| UNIQUE | (nro_op, fecha) | evita cargar dos veces el mismo día |

### `asignaciones_cobrador`
Resuelve la relación N:N entre operación y cobrador a lo largo del tiempo (un crédito puede cambiar de cobrador a mitad de camino).

| Campo | Tipo |
|---|---|
| id PK | INT |
| nro_op FK | INT |
| id_cobrador FK | INT |
| fecha_desde | DATE |
| fecha_hasta | DATE NULL (NULL = asignación vigente) |

---

## 3. Tablas de gestión (reemplazan `ARIEL_PORCENTAJE`)

### `rendimiento_diario`
Antes era una planilla paralela y manual. Con `cobros` y `operaciones` normalizadas, esta tabla puede ser una **vista calculada** en vez de tabla física — se deja como tabla solo si se quiere congelar el objetivo diario (`EXIG. DIARIO`) por cobrador, que hoy no sale de ningún otro lado.

| Campo | Tipo |
|---|---|
| id PK | INT |
| id_cobrador FK | INT |
| fecha | DATE |
| tipo | ENUM('EFECTIVO','PRODUCTO') |
| exigible | DECIMAL(12,2) — objetivo del día |
| cobrado | DECIMAL(12,2) — se puede calcular con `SUM(cobros.monto_cobrado)` |
| UNIQUE | (id_cobrador, fecha, tipo) |

> `porcentaje` y `diferencia` no se guardan: se calculan (`cobrado/exigible`, `exigible-cobrado`) en la vista o en la capa de aplicación.

### `capitalizaciones`
| Campo | Tipo |
|---|---|
| id PK | INT |
| fecha | DATE |
| aportante | VARCHAR(100) — "JUANQUI", "HERNAN"... |
| monto | DECIMAL(14,2) |
| concepto | VARCHAR(200) |

### `compras_productos`
| Campo | Tipo |
|---|---|
| id PK | INT |
| fecha | DATE |
| id_producto FK | INT NULL |
| descripcion | VARCHAR(200) |
| costo_neto | DECIMAL(12,2) |
| estado_pago | VARCHAR(30) |

---

## 4. Vistas calculadas (reemplazan `CONTROL COBROS` y la hoja de ruta)

No se guardan como tablas porque son 100% derivables de `operaciones` + `cobros`, evitando el problema actual de doble carga y desincronización.

```sql
-- Equivalente a "CONTROL COBROS": estado de mora por operación
CREATE VIEW vw_control_cobros AS
SELECT
  o.nro_op,
  o.fecha AS inicio,
  pl.dias AS plan,
  -- fin estimado: inicio + dias + 1 dia de descanso cada 6 dias cobrados
  o.fecha + (pl.dias + FLOOR(pl.dias / 6.0)) * INTERVAL '1 day' AS finaliza_estimado,
  COALESCE(SUM(c.cuotas_pagadas), 0) AS pagadas,
  o.monto_total,
  o.estado,
  o.id_cobrador_actual,
  o.id_vendedor,
  -- dias exigibles desde el inicio hasta hoy, descontando ~1 de cada 7 (domingos)
  FLOOR((CURRENT_DATE - o.fecha) * 6.0 / 7.0) - COALESCE(SUM(c.cuotas_pagadas), 0) AS atraso
FROM operaciones o
JOIN planes pl ON pl.id_plan = o.id_plan
LEFT JOIN cobros c ON c.nro_op = o.nro_op
GROUP BY o.nro_op, o.fecha, pl.dias, o.monto_total, o.estado, o.id_cobrador_actual, o.id_vendedor;

-- Equivalente a PLANILLA_DE_COBRO_*: hoja de ruta del día para un cobrador
CREATE VIEW vw_hoja_de_ruta AS
SELECT
  o.nro_op,
  cl.nombre AS cliente,
  pl.dias AS cuotas,
  o.importe_cuota,
  o.id_cobrador_actual,
  o.domicilio,
  o.tipo
FROM operaciones o
JOIN clientes cl ON cl.id_cliente = o.id_cliente
JOIN planes pl ON pl.id_plan = o.id_plan
WHERE o.estado IS NULL OR o.estado NOT IN ('CANCELADO','RETIRADO');

-- Equivalente a ARIEL_PORCENTAJE: rendimiento por cobrador y día (cobrado real)
CREATE VIEW vw_rendimiento_calculado AS
SELECT
  r.id_cobrador,
  r.fecha,
  r.tipo,
  r.exigible,
  COALESCE(SUM(c.monto_cobrado), 0) AS cobrado,
  CASE WHEN r.exigible > 0
       THEN COALESCE(SUM(c.monto_cobrado), 0) / r.exigible
       ELSE NULL END AS porcentaje,
  r.exigible - COALESCE(SUM(c.monto_cobrado), 0) AS diferencia
FROM rendimiento_diario r
LEFT JOIN cobros c
  ON c.id_cobrador = r.id_cobrador AND c.fecha = r.fecha
GROUP BY r.id_cobrador, r.fecha, r.tipo, r.exigible;
```

---

## 5. DDL completo (PostgreSQL)

```sql
CREATE TABLE clientes (
  id_cliente     SERIAL PRIMARY KEY,
  nombre         VARCHAR(150) NOT NULL,
  dni            VARCHAR(20),
  domicilio      VARCHAR(200),
  telefono       VARCHAR(30),
  telefono_fijo  VARCHAR(30),
  calificacion   VARCHAR(50),
  fecha_alta     DATE DEFAULT CURRENT_DATE
);

CREATE TABLE vendedores (
  id_vendedor  SERIAL PRIMARY KEY,
  nombre       VARCHAR(100) NOT NULL,
  activo       BOOLEAN DEFAULT TRUE
);

CREATE TABLE cobradores (
  id_cobrador    SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  id_supervisor  INT REFERENCES cobradores(id_cobrador),
  activo         BOOLEAN DEFAULT TRUE
);

CREATE TABLE productos (
  id_producto  SERIAL PRIMARY KEY,
  nombre       VARCHAR(150) NOT NULL,
  categoria    VARCHAR(80),
  costo        DECIMAL(12,2)
);

CREATE TABLE planes (
  id_plan        SERIAL PRIMARY KEY,
  tipo           VARCHAR(10) NOT NULL CHECK (tipo IN ('EFECTIVO','PRODUCTO')),
  dias           INT NOT NULL,
  tasa_interes   DECIMAL(5,2)
);

CREATE TABLE precios_plan (
  id_producto   INT REFERENCES productos(id_producto),
  id_plan       INT REFERENCES planes(id_plan),
  cuota_diaria  DECIMAL(12,2) NOT NULL,
  monto_total   DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_producto, id_plan)
);

CREATE TABLE operaciones (
  nro_op              SERIAL PRIMARY KEY,
  fecha               DATE NOT NULL,
  id_cliente          INT NOT NULL REFERENCES clientes(id_cliente),
  tipo                VARCHAR(10) NOT NULL CHECK (tipo IN ('EFECTIVO','PRODUCTO')),
  id_producto         INT REFERENCES productos(id_producto),
  id_plan             INT NOT NULL REFERENCES planes(id_plan),
  importe_cuota       DECIMAL(12,2) NOT NULL,
  monto_total         DECIMAL(12,2) NOT NULL,
  estado              VARCHAR(30),
  id_cobrador_actual  INT REFERENCES cobradores(id_cobrador),
  id_vendedor         INT REFERENCES vendedores(id_vendedor),
  recibo              VARCHAR(30),
  vend_pct            DECIMAL(5,2),
  ganancia            DECIMAL(12,2),
  domicilio           VARCHAR(200)
);

CREATE TABLE cobros (
  id_cobro        BIGSERIAL PRIMARY KEY,
  nro_op          INT NOT NULL REFERENCES operaciones(nro_op),
  fecha           DATE NOT NULL,
  cuotas_pagadas  DECIMAL(10,4) NOT NULL DEFAULT 0,
  importe_cuota   DECIMAL(12,2),
  monto_cobrado   DECIMAL(12,2) NOT NULL DEFAULT 0,
  id_cobrador     INT REFERENCES cobradores(id_cobrador),
  estado          VARCHAR(30),
  UNIQUE (nro_op, fecha)
);

CREATE TABLE asignaciones_cobrador (
  id            SERIAL PRIMARY KEY,
  nro_op        INT NOT NULL REFERENCES operaciones(nro_op),
  id_cobrador   INT NOT NULL REFERENCES cobradores(id_cobrador),
  fecha_desde   DATE NOT NULL,
  fecha_hasta   DATE
);

CREATE TABLE rendimiento_diario (
  id            SERIAL PRIMARY KEY,
  id_cobrador   INT NOT NULL REFERENCES cobradores(id_cobrador),
  fecha         DATE NOT NULL,
  tipo          VARCHAR(10) NOT NULL CHECK (tipo IN ('EFECTIVO','PRODUCTO')),
  exigible      DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE (id_cobrador, fecha, tipo)
);

CREATE TABLE capitalizaciones (
  id          SERIAL PRIMARY KEY,
  fecha       DATE NOT NULL,
  aportante   VARCHAR(100) NOT NULL,
  monto       DECIMAL(14,2) NOT NULL,
  concepto    VARCHAR(200)
);

CREATE TABLE compras_productos (
  id            SERIAL PRIMARY KEY,
  fecha         DATE NOT NULL,
  id_producto   INT REFERENCES productos(id_producto),
  descripcion   VARCHAR(200),
  costo_neto    DECIMAL(12,2) NOT NULL,
  estado_pago   VARCHAR(30)
);

-- Índices recomendados para las consultas más frecuentes
CREATE INDEX idx_operaciones_cliente ON operaciones(id_cliente);
CREATE INDEX idx_operaciones_cobrador ON operaciones(id_cobrador_actual);
CREATE INDEX idx_operaciones_estado ON operaciones(estado);
CREATE INDEX idx_cobros_nro_op ON cobros(nro_op);
CREATE INDEX idx_cobros_fecha ON cobros(fecha);
CREATE INDEX idx_cobros_cobrador_fecha ON cobros(id_cobrador, fecha);
```

---

## 6. Cómo esto resuelve los riesgos detectados en el informe

| Riesgo detectado en Excel | Cómo lo resuelve el esquema |
|---|---|
| Nombres de cliente duplicados (doble espacio) | `clientes` normalizado, un solo registro por DNI/nombre; validación en la capa de carga |
| `#DIV/0!` en porcentaje de rendimiento | El cálculo pasa a una vista/consulta con `CASE WHEN exigible > 0`, nunca se guarda el error |
| Fecha "ancla" fija que había que actualizar a mano | `vw_control_cobros` usa `CURRENT_DATE`, no una celda fija |
| Tarifario desconectado de la carga de operaciones | `precios_plan` conectado por FK; `importe_cuota` en `operaciones` se puede autocompletar desde ahí y solo se pisa si hay un caso especial |
| Doble carga entre `COBROS UNIFICADO`/`CONTROL COBROS` y `ARIEL_PORCENTAJE` | Un solo origen (`cobros`); rendimiento se calcula, no se carga aparte |
| Cambio de cobrador a mitad de crédito | `asignaciones_cobrador` guarda el historial completo, sin perder de vista quién cobró cada jornada (`cobros.id_cobrador`) |
| Datos sensibles (DNI, teléfono, domicilio) sin control de acceso | Al migrar a BD real, se puede aplicar permisos por rol (cobrador solo ve su cartera del día vía `vw_hoja_de_ruta`, admin ve todo) |

---

## 7. Notas de migración

1. **Orden de carga**: `productos` → `planes` → `precios_plan` → `clientes` → `vendedores` → `cobradores` → `operaciones` → `cobros`.
2. `BASE_DE_DATOS_1_A` está dañado — antes de migrar, intentar recuperar una versión no corrupta (OneDrive / AutoRecuperación de Excel) por si contiene operaciones que no están en `BASE_DE_DATOS_OPERACIONES_A`.
3. Al cargar `COBROS UNIFICADO` histórico a `cobros`, vas a encontrar más de una fila por (operación, fecha) en algunos casos — conviene decidir si se suman o se quedan con la última antes de aplicar el `UNIQUE`.
4. `rendimiento_diario.exigible` no existe hoy como dato explícito en ningún archivo (se ve el resultado, no el objetivo cargado) — hay que confirmar con el negocio de dónde sale ese número o si se calcula (ej. cuota × cantidad de clientes activos del cobrador).
