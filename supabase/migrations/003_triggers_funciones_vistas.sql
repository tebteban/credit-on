-- =============================================================================
-- CREDIT-ON — Migración 003: Triggers, Funciones PL/pgSQL y Vistas
-- Base de datos: PostgreSQL / Supabase
-- Versión: 1.0.0 | Fecha: 2026-09-04
-- Prerequisito: Ejecutar 001 y 002 primero
-- =============================================================================

-- ===========================================================================
-- SECCIÓN A: TRIGGERS DE AUTOMATIZACIÓN DE STOCK
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- A.1 TRIGGER: Al registrar una compra → sumar al stock_deposito
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_compra_actualizar_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Validar coherencia del costo_total
    IF ABS(NEW.costo_total - (NEW.cantidad * NEW.costo_unitario)) > 0.01 THEN
        RAISE EXCEPTION 'costo_total (%) no coincide con cantidad × costo_unitario (%)',
            NEW.costo_total, NEW.cantidad * NEW.costo_unitario;
    END IF;

    IF NEW.id_producto IS NOT NULL THEN
        UPDATE productos
        SET stock_deposito = stock_deposito + NEW.cantidad,
            costo          = NEW.costo_unitario  -- actualiza el último precio de costo
        WHERE id_producto = NEW.id_producto;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compra_actualizar_stock
AFTER INSERT ON compras_productos
FOR EACH ROW EXECUTE FUNCTION fn_compra_actualizar_stock();

-- ---------------------------------------------------------------------------
-- A.2 TRIGGER: Al crear una operación de PRODUCTO
--    → Mueve 1 unidad de stock_deposito → stock_calle
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_operacion_mover_stock_out()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.tipo = 'PRODUCTO' AND NEW.id_producto IS NOT NULL AND NEW.estado = 'VIGENTE' THEN
        -- Verificar que haya stock disponible
        IF (SELECT stock_deposito FROM productos WHERE id_producto = NEW.id_producto) < 1 THEN
            RAISE EXCEPTION 'Sin stock disponible para el producto id=%', NEW.id_producto;
        END IF;
        UPDATE productos
        SET stock_deposito = stock_deposito - 1,
            stock_calle    = stock_calle    + 1
        WHERE id_producto = NEW.id_producto;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operacion_mover_stock_out
AFTER INSERT ON operaciones
FOR EACH ROW EXECUTE FUNCTION fn_operacion_mover_stock_out();

-- ---------------------------------------------------------------------------
-- A.3 TRIGGER: Al cambiar estado de operación a CANCELADO o RETIRADO
--    → Devuelve 1 unidad de stock_calle → stock_deposito
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_operacion_mover_stock_in()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.tipo = 'PRODUCTO'
       AND OLD.id_producto IS NOT NULL
       AND OLD.estado = 'VIGENTE'
       AND NEW.estado IN ('CANCELADO', 'RETIRADO') THEN

        UPDATE productos
        SET stock_calle    = GREATEST(stock_calle - 1, 0),
            stock_deposito = CASE
                WHEN NEW.estado = 'RETIRADO' THEN stock_deposito + 1
                ELSE stock_deposito  -- CANCELADO: el cliente se quedó con el bien → no vuelve al depósito
            END
        WHERE id_producto = OLD.id_producto;

        -- Si fue CANCELADO, actualizar fecha
        IF NEW.estado = 'CANCELADO' THEN
            NEW.fecha_cancelacion := CURRENT_DATE;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operacion_mover_stock_in
BEFORE UPDATE OF estado ON operaciones
FOR EACH ROW EXECUTE FUNCTION fn_operacion_mover_stock_in();

-- ---------------------------------------------------------------------------
-- A.4 TRIGGER: Actualizar actualizado_en en operaciones
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_set_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operaciones_actualizado_en
BEFORE UPDATE ON operaciones
FOR EACH ROW EXECUTE FUNCTION fn_set_actualizado_en();

-- ===========================================================================
-- SECCIÓN B: FUNCIÓN PRINCIPAL — GENERADOR DE CRONOGRAMA DE CUOTAS
-- fn_generar_cronograma(p_nro_op, p_fecha_inicio, p_n_cuotas, p_importe_cuota)
--
-- ALGORITMO:
--   Dado una fecha de inicio y un número de cuotas (= días del plan):
--   1. Iterar añadiendo 1 día a la fecha corriente.
--   2. Si es domingo (DOW = 0) → saltar.
--   3. Si está en la tabla feriados → saltar.
--   4. Registrar esa fecha como vencimiento de la cuota i.
--   5. Repetir hasta generar las N cuotas del plan.
--
-- Complejidad: O(N + F) donde F es la cantidad de feriados en el período.
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_generar_cronograma(
    p_nro_op       INT,
    p_fecha_inicio DATE,
    p_n_cuotas     INT,
    p_importe      DECIMAL(12,2)
)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_fecha      DATE    := p_fecha_inicio;
    v_cuota_num  INT     := 0;
    v_max_iter   INT     := p_n_cuotas * 4;  -- tope de seguridad (evita loop infinito)
    v_iter       INT     := 0;
BEGIN
    -- Borrar cuotas previas si se llama para re-generar
    DELETE FROM cuotas WHERE nro_op = p_nro_op;

    WHILE v_cuota_num < p_n_cuotas AND v_iter < v_max_iter LOOP
        v_iter  := v_iter  + 1;
        v_fecha := v_fecha + INTERVAL '1 day';

        -- Saltar domingos (DOW = 0 en PostgreSQL: 0=domingo, 6=sábado)
        IF EXTRACT(DOW FROM v_fecha)::INT = 0 THEN
            CONTINUE;
        END IF;

        -- Saltar feriados
        IF EXISTS (SELECT 1 FROM feriados WHERE fecha = v_fecha) THEN
            CONTINUE;
        END IF;

        -- Es día hábil: registrar la cuota
        v_cuota_num := v_cuota_num + 1;

        INSERT INTO cuotas (nro_op, numero_cuota, fecha_vencimiento, monto_esperado, estado)
        VALUES (p_nro_op, v_cuota_num, v_fecha, p_importe, 'PENDIENTE');
    END LOOP;

    IF v_cuota_num < p_n_cuotas THEN
        RAISE EXCEPTION 'fn_generar_cronograma: no se pudieron generar las % cuotas (solo % generadas, límite iteraciones alcanzado)',
            p_n_cuotas, v_cuota_num;
    END IF;
END;
$$;

COMMENT ON FUNCTION fn_generar_cronograma IS
'Genera el cronograma de cuotas de una operación respetando el calendario Lunes–Sábado y saltando feriados de la tabla feriados. Llamar inmediatamente después de INSERT en operaciones.';

-- ---------------------------------------------------------------------------
-- Función de conveniencia: calcula fecha estimada de finalización
-- sin insertar cuotas, solo retorna la fecha del último día hábil.
-- Útil para mostrar "Finaliza el dd/mm/yyyy" en el alta de operación.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_fecha_fin_estimada(
    p_fecha_inicio DATE,
    p_n_cuotas     INT
)
RETURNS DATE LANGUAGE plpgsql AS $$
DECLARE
    v_fecha      DATE := p_fecha_inicio;
    v_cuota_num  INT  := 0;
    v_max_iter   INT  := p_n_cuotas * 4;
    v_iter       INT  := 0;
BEGIN
    WHILE v_cuota_num < p_n_cuotas AND v_iter < v_max_iter LOOP
        v_iter  := v_iter  + 1;
        v_fecha := v_fecha + INTERVAL '1 day';
        CONTINUE WHEN EXTRACT(DOW FROM v_fecha)::INT = 0;
        CONTINUE WHEN EXISTS (SELECT 1 FROM feriados WHERE fecha = v_fecha);
        v_cuota_num := v_cuota_num + 1;
    END LOOP;
    RETURN v_fecha;
END;
$$;

-- ===========================================================================
-- SECCIÓN C: PROCEDIMIENTO DE IMPUTACIÓN DE PAGOS EN CASCADA
-- fn_registrar_cobro(p_nro_op, p_id_cobrador, p_monto, p_fecha, p_gps, p_obs)
--
-- LÓGICA DE CASCADA:
--   1. Buscar cuotas PENDIENTE o PARCIAL ordenadas por fecha_vencimiento ASC.
--   2. Ir imputando el monto disponible cuota a cuota:
--       a. Si monto_disponible >= monto_faltante → pagar cuota completa,
--          descontar de monto_disponible y continuar a la siguiente.
--       b. Si monto_disponible < monto_faltante → pago parcial, estado = 'PARCIAL'.
--       c. Si monto_disponible = 0 → parar.
--   3. Calcular cuotas_equivalentes = monto_cobrado / importe_cuota.
--   4. Actualizar saldo_restante en operaciones.
--   5. Si saldo_restante = 0 → marcar operación como CANCELADO.
--   6. Insertar registro en cobros con idempotency_key.
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_registrar_cobro(
    p_nro_op          INT,
    p_id_cobrador     INT,
    p_monto           DECIMAL(12,2),
    p_fecha           TIMESTAMPTZ DEFAULT NOW(),
    p_gps             VARCHAR(50) DEFAULT NULL,
    p_observacion     VARCHAR(200) DEFAULT NULL,
    p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_op              operaciones%ROWTYPE;
    v_cuota           cuotas%ROWTYPE;
    v_disponible      DECIMAL(12,2) := p_monto;
    v_faltante        DECIMAL(12,2);
    v_cuotas_pagadas  DECIMAL(10,4) := 0;
    v_id_cobro        BIGINT;
    v_idem_key        UUID;
    v_resultado       JSONB;
BEGIN
    -- -----------------------------------------------------------------------
    -- 0. Idempotencia: si ya existe este key, retornar el cobro previo
    -- -----------------------------------------------------------------------
    v_idem_key := COALESCE(p_idempotency_key, gen_random_uuid());

    IF EXISTS (SELECT 1 FROM cobros WHERE idempotency_key = v_idem_key) THEN
        SELECT row_to_json(c)::JSONB INTO v_resultado
        FROM cobros c WHERE idempotency_key = v_idem_key;
        RETURN jsonb_build_object('status', 'DUPLICATE', 'cobro', v_resultado);
    END IF;

    -- -----------------------------------------------------------------------
    -- 1. Bloquear la operación para escritura concurrente (evita race conditions)
    -- -----------------------------------------------------------------------
    SELECT * INTO v_op FROM operaciones WHERE nro_op = p_nro_op FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operación % no encontrada', p_nro_op;
    END IF;

    IF v_op.estado NOT IN ('VIGENTE') THEN
        RAISE EXCEPTION 'La operación % está en estado %. No se pueden registrar cobros.',
            p_nro_op, v_op.estado;
    END IF;

    IF p_monto <= 0 THEN
        RAISE EXCEPTION 'El monto a cobrar debe ser mayor a 0 (recibido: %)', p_monto;
    END IF;

    -- -----------------------------------------------------------------------
    -- 2. Imputación en cascada: recorrer cuotas PENDIENTE/PARCIAL en orden
    -- -----------------------------------------------------------------------
    FOR v_cuota IN
        SELECT * FROM cuotas
        WHERE nro_op = p_nro_op
          AND estado IN ('PENDIENTE', 'PARCIAL')
        ORDER BY fecha_vencimiento ASC, numero_cuota ASC
        FOR UPDATE
    LOOP
        EXIT WHEN v_disponible <= 0;

        v_faltante := v_cuota.monto_esperado - v_cuota.monto_pagado;

        IF v_disponible >= v_faltante THEN
            -- Pago completo de esta cuota
            UPDATE cuotas
            SET monto_pagado      = monto_esperado,
                estado            = 'PAGADA',
                fecha_pago_efectivo = p_fecha::DATE
            WHERE id_cuota = v_cuota.id_cuota;

            v_cuotas_pagadas := v_cuotas_pagadas + (v_faltante / v_op.importe_cuota);
            v_disponible     := v_disponible - v_faltante;

        ELSE
            -- Pago parcial: solo alcanza para cubrir parte de esta cuota
            UPDATE cuotas
            SET monto_pagado = monto_pagado + v_disponible,
                estado       = 'PARCIAL'
            WHERE id_cuota = v_cuota.id_cuota;

            v_cuotas_pagadas := v_cuotas_pagadas + (v_disponible / v_op.importe_cuota);
            v_disponible     := 0;
        END IF;
    END LOOP;

    -- -----------------------------------------------------------------------
    -- 3. Actualizar saldo_restante en la operación
    -- -----------------------------------------------------------------------
    UPDATE operaciones
    SET saldo_restante = GREATEST(saldo_restante - p_monto, 0)
    WHERE nro_op = p_nro_op
    RETURNING saldo_restante INTO v_op.saldo_restante;

    -- -----------------------------------------------------------------------
    -- 4. Si no quedan cuotas pendientes → marcar como CANCELADO
    -- -----------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM cuotas
        WHERE nro_op = p_nro_op AND estado IN ('PENDIENTE','PARCIAL')
    ) THEN
        UPDATE operaciones
        SET estado = 'CANCELADO', fecha_cancelacion = CURRENT_DATE
        WHERE nro_op = p_nro_op;
    END IF;

    -- -----------------------------------------------------------------------
    -- 5. Insertar registro de cobro
    -- -----------------------------------------------------------------------
    INSERT INTO cobros (
        nro_op, id_cobrador, fecha_hora, monto_cobrado,
        cuotas_equivalentes, coordenadas_gps, observacion, idempotency_key
    ) VALUES (
        p_nro_op, p_id_cobrador, p_fecha, p_monto,
        GREATEST(v_cuotas_pagadas, 0.0001),
        p_gps, p_observacion, v_idem_key
    ) RETURNING id_cobro INTO v_id_cobro;

    -- -----------------------------------------------------------------------
    -- 6. Retornar resultado estructurado para la app cliente
    -- -----------------------------------------------------------------------
    v_resultado := jsonb_build_object(
        'status',            'OK',
        'id_cobro',          v_id_cobro,
        'nro_op',            p_nro_op,
        'monto_cobrado',     p_monto,
        'cuotas_equivalentes', v_cuotas_pagadas,
        'saldo_restante',    v_op.saldo_restante,
        'operacion_estado',  CASE WHEN v_op.saldo_restante = 0 THEN 'CANCELADO' ELSE 'VIGENTE' END,
        'excedente',         v_disponible   -- si el cliente pagó de más
    );

    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION fn_registrar_cobro IS
'Procedimiento central de imputación de pagos en cascada. Soporta pagos parciales, completos y adelantos de múltiples cuotas. Retorna JSONB con el resultado de la transacción. Idempotente mediante idempotency_key (soporta sincronización offline).';

-- ===========================================================================
-- SECCIÓN D: VISTAS CALCULADAS
-- Reemplazan los tableros manuales de Excel.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- D.1 VISTA: vw_hoja_de_ruta
--    Listado de cobro diario por cobrador.
--    Incluye deuda acumulada, estado de mora y cuota del día.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_hoja_de_ruta AS
SELECT
    o.nro_op,
    o.orden_recorrido,
    o.id_cobrador_actual                                    AS id_cobrador,
    co.nombre                                               AS cobrador,
    cl.nombre                                               AS cliente,
    cl.telefono,
    o.domicilio_cobro                                       AS domicilio,
    o.tipo,
    pr.nombre                                               AS producto,
    pl.dias                                                 AS cuotas_plan,
    o.importe_cuota,
    o.saldo_restante,
    -- Cuota del día: la próxima PENDIENTE o PARCIAL
    (SELECT c.monto_esperado - c.monto_pagado
     FROM cuotas c
     WHERE c.nro_op = o.nro_op
       AND c.estado IN ('PENDIENTE','PARCIAL')
     ORDER BY c.fecha_vencimiento ASC
     LIMIT 1)                                               AS monto_exigible_hoy,
    -- Cuotas impagas acumuladas (mora)
    (SELECT COUNT(*)
     FROM cuotas c
     WHERE c.nro_op = o.nro_op
       AND c.estado IN ('PENDIENTE','PARCIAL')
       AND c.fecha_vencimiento < CURRENT_DATE)              AS cuotas_vencidas,
    -- Deuda vencida total (suma de cuotas impagas anteriores)
    (SELECT COALESCE(SUM(c.monto_esperado - c.monto_pagado), 0)
     FROM cuotas c
     WHERE c.nro_op = o.nro_op
       AND c.estado IN ('PENDIENTE','PARCIAL')
       AND c.fecha_vencimiento < CURRENT_DATE)              AS deuda_vencida,
    o.estado
FROM operaciones o
JOIN clientes    cl ON cl.id_cliente  = o.id_cliente
JOIN cobradores  co ON co.id_cobrador = o.id_cobrador_actual
JOIN planes      pl ON pl.id_plan     = o.id_plan
LEFT JOIN productos pr ON pr.id_producto = o.id_producto
WHERE o.estado = 'VIGENTE'
ORDER BY o.id_cobrador_actual, o.orden_recorrido;

COMMENT ON VIEW vw_hoja_de_ruta IS
'Vista de ruta diaria por cobrador. Incluye monto exigible del día, cuotas vencidas y deuda acumulada. Filtra solo operaciones VIGENTES.';

-- ---------------------------------------------------------------------------
-- D.2 VISTA: vw_control_mora
--    Tablero de mora: operaciones con X o más cuotas impagas.
--    Reemplaza la hoja "CONTROL COBROS" de Excel.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_control_mora AS
SELECT
    o.nro_op,
    cl.nombre                                               AS cliente,
    cl.telefono,
    cl.dni,
    o.domicilio_cobro                                       AS domicilio,
    o.tipo,
    pr.nombre                                               AS producto,
    o.id_cobrador_actual,
    co.nombre                                               AS cobrador,
    o.fecha                                                 AS fecha_inicio,
    pl.dias                                                 AS plan_dias,
    fn_fecha_fin_estimada(o.fecha, pl.dias)                 AS fecha_fin_estimada,
    o.importe_cuota,
    o.monto_total,
    o.saldo_restante,
    -- Cuotas pagadas totales
    (SELECT COUNT(*) FROM cuotas c
     WHERE c.nro_op = o.nro_op AND c.estado = 'PAGADA')    AS cuotas_pagadas,
    -- Cuotas vencidas sin pagar
    (SELECT COUNT(*) FROM cuotas c
     WHERE c.nro_op = o.nro_op
       AND c.estado IN ('PENDIENTE','PARCIAL')
       AND c.fecha_vencimiento < CURRENT_DATE)              AS cuotas_vencidas,
    -- Suma de deuda vencida
    (SELECT COALESCE(SUM(c.monto_esperado - c.monto_pagado), 0)
     FROM cuotas c
     WHERE c.nro_op = o.nro_op
       AND c.estado IN ('PENDIENTE','PARCIAL')
       AND c.fecha_vencimiento < CURRENT_DATE)              AS monto_vencido,
    -- Semáforo: 0=OK, 1=ALERTA, 2=MORA_CRITICA, 3=EVALUAR_RETIRO
    CASE
        WHEN (SELECT COUNT(*) FROM cuotas c
              WHERE c.nro_op = o.nro_op
                AND c.estado IN ('PENDIENTE','PARCIAL')
                AND c.fecha_vencimiento < CURRENT_DATE) = 0 THEN 'AL_DIA'
        WHEN (SELECT COUNT(*) FROM cuotas c
              WHERE c.nro_op = o.nro_op
                AND c.estado IN ('PENDIENTE','PARCIAL')
                AND c.fecha_vencimiento < CURRENT_DATE) BETWEEN 1 AND 2 THEN 'ALERTA'
        WHEN (SELECT COUNT(*) FROM cuotas c
              WHERE c.nro_op = o.nro_op
                AND c.estado IN ('PENDIENTE','PARCIAL')
                AND c.fecha_vencimiento < CURRENT_DATE) BETWEEN 3 AND 5 THEN 'MORA_CRITICA'
        ELSE 'EVALUAR_RETIRO'
    END                                                     AS nivel_mora
FROM operaciones o
JOIN clientes   cl ON cl.id_cliente  = o.id_cliente
JOIN cobradores co ON co.id_cobrador = o.id_cobrador_actual
JOIN planes     pl ON pl.id_plan     = o.id_plan
LEFT JOIN productos pr ON pr.id_producto = o.id_producto
WHERE o.estado = 'VIGENTE'
ORDER BY cuotas_vencidas DESC, o.saldo_restante DESC;

COMMENT ON VIEW vw_control_mora IS
'Tablero de mora: operaciones vigentes con semáforo (AL_DIA, ALERTA, MORA_CRITICA, EVALUAR_RETIRO). Reemplaza hoja "CONTROL COBROS".';

-- ---------------------------------------------------------------------------
-- D.3 VISTA: vw_rendimiento_cobrador
--    Efectividad diaria por cobrador: exigible vs. cobrado.
--    Reemplaza ARIEL_PORCENTAJE.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_rendimiento_cobrador AS
WITH cobros_dia AS (
    SELECT
        id_cobrador,
        DATE(fecha_hora) AS fecha,
        SUM(monto_cobrado) AS total_cobrado,
        COUNT(DISTINCT nro_op) AS clientes_cobrados
    FROM cobros
    GROUP BY id_cobrador, DATE(fecha_hora)
),
exigible_dia AS (
    -- Suma de cuotas con vencimiento en esa fecha, por cobrador
    SELECT
        o.id_cobrador_actual AS id_cobrador,
        c.fecha_vencimiento  AS fecha,
        SUM(c.monto_esperado) AS total_exigible,
        COUNT(*)              AS clientes_a_cobrar
    FROM cuotas c
    JOIN operaciones o ON o.nro_op = c.nro_op
    WHERE o.estado = 'VIGENTE'
      AND c.estado IN ('PENDIENTE','PARCIAL')
    GROUP BY o.id_cobrador_actual, c.fecha_vencimiento
)
SELECT
    co.nombre                                               AS cobrador,
    e.fecha,
    e.total_exigible,
    COALESCE(cd.total_cobrado, 0)                           AS total_cobrado,
    e.clientes_a_cobrar,
    COALESCE(cd.clientes_cobrados, 0)                       AS clientes_cobrados,
    CASE WHEN e.total_exigible > 0
         THEN ROUND(COALESCE(cd.total_cobrado, 0) / e.total_exigible * 100, 2)
         ELSE 0
    END                                                     AS porcentaje_efectividad,
    e.total_exigible - COALESCE(cd.total_cobrado, 0)        AS diferencia
FROM exigible_dia e
JOIN cobradores  co ON co.id_cobrador = e.id_cobrador
LEFT JOIN cobros_dia cd ON cd.id_cobrador = e.id_cobrador AND cd.fecha = e.fecha
ORDER BY e.fecha DESC, co.nombre;

-- ---------------------------------------------------------------------------
-- D.4 VISTA: vw_patrimonio
--    Tablero de patrimonio en tiempo real.
--    Caja Líquida + Capital en Calle + Mercadería en Calle + Stock en Depósito
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_patrimonio AS
SELECT
    -- Caja Líquida: cobros rendidos - compras - comisiones (simplificado)
    (SELECT COALESCE(SUM(monto_cobrado), 0) FROM cobros WHERE rendido_en_caja = TRUE)
    - (SELECT COALESCE(SUM(costo_total), 0) FROM compras_productos WHERE estado_pago = 'PAGADO')
    + (SELECT COALESCE(SUM(monto), 0) FROM capitalizaciones)            AS caja_liquida,

    -- Capital en Calle: saldo de préstamos efectivo vigentes
    (SELECT COALESCE(SUM(saldo_restante), 0)
     FROM operaciones WHERE tipo = 'EFECTIVO' AND estado = 'VIGENTE')   AS capital_prestamos_calle,

    -- Mercadería en la Calle: saldo de productos financiados vigentes
    (SELECT COALESCE(SUM(saldo_restante), 0)
     FROM operaciones WHERE tipo = 'PRODUCTO' AND estado = 'VIGENTE')   AS mercaderia_financiada_calle,

    -- Stock en Depósito: unidades × costo
    (SELECT COALESCE(SUM(p.stock_deposito * p.costo), 0)
     FROM productos p WHERE p.activo = TRUE)                             AS valor_stock_deposito,

    -- PATRIMONIO TOTAL
    (
        (SELECT COALESCE(SUM(monto_cobrado), 0) FROM cobros WHERE rendido_en_caja = TRUE)
        - (SELECT COALESCE(SUM(costo_total), 0) FROM compras_productos WHERE estado_pago = 'PAGADO')
        + (SELECT COALESCE(SUM(monto), 0) FROM capitalizaciones)
        + (SELECT COALESCE(SUM(saldo_restante), 0) FROM operaciones WHERE estado = 'VIGENTE')
        + (SELECT COALESCE(SUM(p.stock_deposito * p.costo), 0) FROM productos p WHERE p.activo = TRUE)
    )                                                                    AS patrimonio_total,

    NOW()                                                                AS calculado_al;

COMMENT ON VIEW vw_patrimonio IS
'Dashboard financiero: Caja Líquida + Capital en Calle (efectivo) + Mercadería en Calle + Stock en Depósito = Patrimonio Total.';

-- ---------------------------------------------------------------------------
-- D.5 VISTA: vw_cierre_caja_cobrador
--    Para el módulo de Arqueo: total recaudado por cobrador en una fecha dada.
--    Filtrar con WHERE cobrador = 'Ariel' AND fecha = '2026-09-04'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_cierre_caja_cobrador AS
SELECT
    co.id_cobrador,
    co.nombre                                               AS cobrador,
    co.porcentaje_comision,
    DATE(c.fecha_hora)                                      AS fecha,
    o.tipo,
    COUNT(DISTINCT c.nro_op)                                AS clientes_cobrados,
    SUM(c.monto_cobrado)                                    AS total_cobrado,
    SUM(c.monto_cobrado) * co.porcentaje_comision / 100     AS comision_cobrador,
    SUM(c.monto_cobrado) * (1 - co.porcentaje_comision/100) AS neto_a_rendir,
    BOOL_AND(c.rendido_en_caja)                             AS todo_rendido
FROM cobros c
JOIN cobradores  co ON co.id_cobrador = c.id_cobrador
JOIN operaciones o  ON o.nro_op       = c.nro_op
GROUP BY co.id_cobrador, co.nombre, co.porcentaje_comision, DATE(c.fecha_hora), o.tipo
ORDER BY fecha DESC, co.nombre, o.tipo;

COMMENT ON VIEW vw_cierre_caja_cobrador IS
'Vista de arqueo de caja por cobrador, fecha y tipo. Calcula comisión del cobrador y neto a rendir al administrador.';
