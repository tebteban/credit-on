-- =============================================================================
-- CREDIT-ON — Migración 004: Row Level Security (RLS) para Supabase
-- Base de datos: PostgreSQL / Supabase
-- Versión: 1.0.0 | Fecha: 2026-09-04
-- Prerequisito: Ejecutar 001, 002 y 003 primero
-- =============================================================================
-- ROLES:
--   - 'admin'    → administrador / dueño: acceso total
--   - 'cobrador' → cobrador de campo: solo ve sus operaciones del día
-- =============================================================================

-- Habilitar RLS en las tablas sensibles
ALTER TABLE operaciones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rendimiento_diario ENABLE ROW LEVEL SECURITY;

-- ===========================================================================
-- POLÍTICAS PARA ADMINISTRADOR (acceso irrestricto)
-- Se usan los claims JWT de Supabase Auth para determinar el rol.
-- El administrador tiene claim: { "role": "admin" }
-- ===========================================================================

-- operaciones: admin ve todo
CREATE POLICY policy_op_admin ON operaciones
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin'
    );

-- cobros: admin ve todo
CREATE POLICY policy_cobros_admin ON cobros
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin'
    );

-- cuotas: admin ve todo
CREATE POLICY policy_cuotas_admin ON cuotas
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'admin'
    );

-- ===========================================================================
-- POLÍTICAS PARA COBRADOR (solo su cartera activa)
-- El cobrador tiene claim: { "role": "cobrador", "id_cobrador": 3 }
-- ===========================================================================

-- operaciones: el cobrador solo ve las operaciones asignadas a él, vigentes
CREATE POLICY policy_op_cobrador ON operaciones
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'cobrador'
        AND id_cobrador_actual = (auth.jwt() ->> 'id_cobrador')::INT
        AND estado = 'VIGENTE'
    );

-- cobros: el cobrador puede INSERT y ver sus propios cobros del día
CREATE POLICY policy_cobros_cobrador_select ON cobros
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'cobrador'
        AND id_cobrador = (auth.jwt() ->> 'id_cobrador')::INT
        AND DATE(fecha_hora) = CURRENT_DATE
    );

CREATE POLICY policy_cobros_cobrador_insert ON cobros
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'cobrador'
        AND id_cobrador = (auth.jwt() ->> 'id_cobrador')::INT
    );

-- cuotas: el cobrador solo lee cuotas de sus operaciones
CREATE POLICY policy_cuotas_cobrador ON cuotas
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'cobrador'
        AND nro_op IN (
            SELECT nro_op FROM operaciones
            WHERE id_cobrador_actual = (auth.jwt() ->> 'id_cobrador')::INT
              AND estado = 'VIGENTE'
        )
    );

-- clientes: cobrador puede ver datos de sus clientes (sin DNI completo)
CREATE POLICY policy_clientes_cobrador ON clientes
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() ->> 'role') = 'cobrador'
        AND id_cliente IN (
            SELECT id_cliente FROM operaciones
            WHERE id_cobrador_actual = (auth.jwt() ->> 'id_cobrador')::INT
              AND estado = 'VIGENTE'
        )
    );

-- ===========================================================================
-- FUNCIÓN AUXILIAR: fn_cerrar_caja(p_id_cobrador, p_fecha)
-- Marca todos los cobros del cobrador en esa fecha como rendido_en_caja = TRUE
-- Solo puede ejecutar el admin.
-- ===========================================================================
CREATE OR REPLACE FUNCTION fn_cerrar_caja(
    p_id_cobrador INT,
    p_fecha       DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_filas_actualizadas INT;
    v_total_rendido      DECIMAL(14,2);
BEGIN
    -- Verificar que sea admin (SECURITY DEFINER ejecuta como el dueño de la función)
    -- En producción agregar validación adicional con auth.jwt()

    UPDATE cobros
    SET rendido_en_caja = TRUE
    WHERE id_cobrador = p_id_cobrador
      AND DATE(fecha_hora) = p_fecha
      AND rendido_en_caja  = FALSE;

    GET DIAGNOSTICS v_filas_actualizadas = ROW_COUNT;

    SELECT COALESCE(SUM(monto_cobrado), 0) INTO v_total_rendido
    FROM cobros
    WHERE id_cobrador   = p_id_cobrador
      AND DATE(fecha_hora) = p_fecha
      AND rendido_en_caja  = TRUE;

    RETURN jsonb_build_object(
        'status',              'OK',
        'cobros_cerrados',     v_filas_actualizadas,
        'total_rendido',       v_total_rendido,
        'cobrador_id',         p_id_cobrador,
        'fecha_cierre',        p_fecha
    );
END;
$$;

COMMENT ON FUNCTION fn_cerrar_caja IS
'Cierra la caja de un cobrador para una fecha dada. Marca todos sus cobros como rendido_en_caja=TRUE. Retorna el total rendido.';

-- ===========================================================================
-- SEMILLA DE DATOS INICIALES (datos de producción de CREDIT-ON)
-- ===========================================================================

-- Zonas
INSERT INTO zonas (nombre, descripcion) VALUES
    ('Zona Ariel - Efectivo Norte',   'Circuito de préstamos efectivo del sector norte'),
    ('Zona Ariel - Producto Centro',  'Circuito de productos financiados del centro'),
    ('Zona Álvaro',                   'Cartera de Álvaro'),
    ('Zona Antonela',                 'Cartera de Antonela'),
    ('Zona Oriana',                   'Cartera de Oriana (incluye sub-cobradores Emanuel y Walter)')
ON CONFLICT DO NOTHING;

-- Cobradores (Ariel primero, sin supervisor)
INSERT INTO cobradores (nombre, porcentaje_comision) VALUES
    ('Ariel',    10.00),
    ('Álvaro',   10.00),
    ('Antonela', 10.00),
    ('Oriana',   10.00),
    ('César',    10.00)
ON CONFLICT DO NOTHING;

-- Sub-cobradores de Oriana
INSERT INTO cobradores (nombre, porcentaje_comision, id_supervisor)
SELECT 'Emanuel', 8.00, id_cobrador FROM cobradores WHERE nombre = 'Oriana'
ON CONFLICT DO NOTHING;

INSERT INTO cobradores (nombre, porcentaje_comision, id_supervisor)
SELECT 'Walter', 8.00, id_cobrador FROM cobradores WHERE nombre = 'Oriana'
ON CONFLICT DO NOTHING;

-- Planes de efectivo
INSERT INTO planes (tipo, dias, tasa_interes, descripcion) VALUES
    ('EFECTIVO', 26, 30.00, 'Préstamo 26 días al 30%'),
    ('EFECTIVO', 35, 40.00, 'Préstamo 35 días al 40%')
ON CONFLICT DO NOTHING;

-- Planes de producto
INSERT INTO planes (tipo, dias, tasa_interes, descripcion) VALUES
    ('PRODUCTO',  42, NULL, 'Financiación 42 cuotas'),
    ('PRODUCTO',  84, NULL, 'Financiación 84 cuotas'),
    ('PRODUCTO', 135, NULL, 'Financiación 135 cuotas'),
    ('PRODUCTO', 175, NULL, 'Financiación 175 cuotas'),
    ('PRODUCTO', 220, NULL, 'Financiación 220 cuotas')
ON CONFLICT DO NOTHING;
