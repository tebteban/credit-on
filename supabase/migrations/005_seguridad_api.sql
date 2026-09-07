-- =============================================================================
-- CREDIT-ON — Migración 005: políticas API y RPC seguras
-- Ejecutar después de 001, 002, 003 y 004.
--
-- El rol de negocio se toma de auth.users.raw_app_meta_data:
-- { "credit_on_role": "admin" }
-- { "credit_on_role": "cobrador", "id_cobrador": 1 }
-- Nunca se usa raw_user_meta_data porque el usuario puede modificarlo.
-- =============================================================================

-- La migración 004 consultaba auth.jwt()->>'role'. En Supabase ese claim es
-- "authenticated", no el rol de negocio de CREDIT-ON. Se reemplazan sus políticas.
DROP POLICY IF EXISTS policy_op_admin ON public.operaciones;
DROP POLICY IF EXISTS policy_cobros_admin ON public.cobros;
DROP POLICY IF EXISTS policy_cuotas_admin ON public.cuotas;
DROP POLICY IF EXISTS policy_op_cobrador ON public.operaciones;
DROP POLICY IF EXISTS policy_cobros_cobrador_select ON public.cobros;
DROP POLICY IF EXISTS policy_cobros_cobrador_insert ON public.cobros;
DROP POLICY IF EXISTS policy_cuotas_cobrador ON public.cuotas;
DROP POLICY IF EXISTS policy_clientes_cobrador ON public.clientes;

ALTER TABLE public.cobradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precios_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asignaciones_cobrador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capitalizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras_productos ENABLE ROW LEVEL SECURITY;

-- Administrador: acceso completo a las tablas operativas.
CREATE POLICY credit_on_admin_operaciones ON public.operaciones
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

CREATE POLICY credit_on_admin_cobros ON public.cobros
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

CREATE POLICY credit_on_admin_cuotas ON public.cuotas
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

CREATE POLICY credit_on_admin_clientes ON public.clientes
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

CREATE POLICY credit_on_admin_rendimiento ON public.rendimiento_diario
  FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

-- Un cobrador solo puede leer su cartera, cuotas y cobros del día.
CREATE POLICY credit_on_cobrador_operaciones_select ON public.operaciones
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'cobrador'
    AND id_cobrador_actual = NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT
    AND estado = 'VIGENTE'
  );

CREATE POLICY credit_on_cobrador_cuotas_select ON public.cuotas
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'cobrador'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.nro_op = cuotas.nro_op
        AND o.id_cobrador_actual = NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT
    )
  );

CREATE POLICY credit_on_cobrador_clientes_select ON public.clientes
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'cobrador'
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.id_cliente = clientes.id_cliente
        AND o.id_cobrador_actual = NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT
        AND o.estado = 'VIGENTE'
    )
  );

CREATE POLICY credit_on_cobrador_cobros_select ON public.cobros
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'cobrador'
    AND id_cobrador = NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT
    AND DATE(fecha_hora) = CURRENT_DATE
  );

CREATE POLICY credit_on_cobrador_cobros_insert ON public.cobros
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'cobrador'
    AND id_cobrador = NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT
    AND EXISTS (
      SELECT 1 FROM public.operaciones o
      WHERE o.nro_op = cobros.nro_op
        AND o.id_cobrador_actual = cobros.id_cobrador
    )
  );

-- Catálogos: lectura para todo usuario autenticado y administración solo para admin.
CREATE POLICY credit_on_catalogo_cobradores_select ON public.cobradores FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_zonas_select ON public.zonas FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_vendedores_select ON public.vendedores FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_productos_select ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_planes_select ON public.planes FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_precios_select ON public.precios_plan FOR SELECT TO authenticated USING (true);
CREATE POLICY credit_on_catalogo_feriados_select ON public.feriados FOR SELECT TO authenticated USING (true);

CREATE POLICY credit_on_admin_cobradores ON public.cobradores FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_zonas ON public.zonas FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_vendedores ON public.vendedores FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_productos ON public.productos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_planes ON public.planes FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_precios ON public.precios_plan FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_feriados ON public.feriados FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_asignaciones ON public.asignaciones_cobrador FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_capitalizaciones ON public.capitalizaciones FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');
CREATE POLICY credit_on_admin_compras ON public.compras_productos FOR ALL TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'credit_on_role') = 'admin');

-- Las vistas deben respetar el RLS del usuario que las consulta.
ALTER VIEW public.vw_hoja_de_ruta SET (security_invoker = true);

-- RPC de cobro: muta varias tablas, por eso opera como dueño de la función,
-- pero valida el rol y la asignación antes de tocar un registro.
CREATE OR REPLACE FUNCTION public.fn_registrar_cobro(
  p_nro_op INT,
  p_id_cobrador INT,
  p_monto DECIMAL(12,2),
  p_fecha TIMESTAMPTZ DEFAULT NOW(),
  p_gps VARCHAR(50) DEFAULT NULL,
  p_observacion VARCHAR(200) DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := COALESCE(auth.jwt() -> 'app_metadata' ->> 'credit_on_role', '');
  v_auth_cobrador INT := NULLIF(auth.jwt() -> 'app_metadata' ->> 'id_cobrador', '')::INT;
  v_op operaciones%ROWTYPE;
  v_cuota cuotas%ROWTYPE;
  v_disponible DECIMAL(12,2) := p_monto;
  v_faltante DECIMAL(12,2);
  v_cuotas_pagadas DECIMAL(10,4) := 0;
  v_id_cobro BIGINT;
  v_idem_key UUID := COALESCE(p_idempotency_key, gen_random_uuid());
  v_resultado JSONB;
BEGIN
  IF v_role NOT IN ('admin', 'cobrador') THEN
    RAISE EXCEPTION 'No autorizado para registrar cobros';
  END IF;
  IF v_role = 'cobrador' AND v_auth_cobrador IS DISTINCT FROM p_id_cobrador THEN
    RAISE EXCEPTION 'El cobrador autenticado no coincide con el cobro';
  END IF;
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto a cobrar debe ser mayor a 0';
  END IF;

  IF EXISTS (SELECT 1 FROM cobros WHERE idempotency_key = v_idem_key) THEN
    SELECT row_to_json(c)::JSONB INTO v_resultado FROM cobros c WHERE idempotency_key = v_idem_key;
    RETURN jsonb_build_object('status', 'DUPLICATE', 'cobro', v_resultado);
  END IF;

  SELECT * INTO v_op FROM operaciones WHERE nro_op = p_nro_op FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operación % no encontrada', p_nro_op; END IF;
  IF v_role = 'cobrador' AND v_op.id_cobrador_actual IS DISTINCT FROM p_id_cobrador THEN
    RAISE EXCEPTION 'La operación no está asignada al cobrador autenticado';
  END IF;
  IF v_op.estado <> 'VIGENTE' THEN
    RAISE EXCEPTION 'La operación % no admite cobros por estar en estado %', p_nro_op, v_op.estado;
  END IF;

  FOR v_cuota IN
    SELECT * FROM cuotas
    WHERE nro_op = p_nro_op AND estado IN ('PENDIENTE', 'PARCIAL')
    ORDER BY fecha_vencimiento, numero_cuota
    FOR UPDATE
  LOOP
    EXIT WHEN v_disponible <= 0;
    v_faltante := v_cuota.monto_esperado - v_cuota.monto_pagado;
    IF v_disponible >= v_faltante THEN
      UPDATE cuotas SET monto_pagado = monto_esperado, estado = 'PAGADA', fecha_pago_efectivo = p_fecha::DATE
      WHERE id_cuota = v_cuota.id_cuota;
      v_cuotas_pagadas := v_cuotas_pagadas + (v_faltante / v_op.importe_cuota);
      v_disponible := v_disponible - v_faltante;
    ELSE
      UPDATE cuotas SET monto_pagado = monto_pagado + v_disponible, estado = 'PARCIAL'
      WHERE id_cuota = v_cuota.id_cuota;
      v_cuotas_pagadas := v_cuotas_pagadas + (v_disponible / v_op.importe_cuota);
      v_disponible := 0;
    END IF;
  END LOOP;

  UPDATE operaciones
  SET saldo_restante = GREATEST(saldo_restante - p_monto, 0)
  WHERE nro_op = p_nro_op
  RETURNING saldo_restante INTO v_op.saldo_restante;

  IF NOT EXISTS (SELECT 1 FROM cuotas WHERE nro_op = p_nro_op AND estado IN ('PENDIENTE', 'PARCIAL')) THEN
    UPDATE operaciones SET estado = 'CANCELADO', fecha_cancelacion = CURRENT_DATE WHERE nro_op = p_nro_op;
  END IF;

  INSERT INTO cobros (
    nro_op, id_cobrador, fecha_hora, monto_cobrado, cuotas_equivalentes,
    coordenadas_gps, observacion, idempotency_key
  ) VALUES (
    p_nro_op, p_id_cobrador, p_fecha, p_monto, GREATEST(v_cuotas_pagadas, 0.0001),
    p_gps, p_observacion, v_idem_key
  ) RETURNING id_cobro INTO v_id_cobro;

  RETURN jsonb_build_object(
    'status', 'OK', 'id_cobro', v_id_cobro, 'nro_op', p_nro_op,
    'monto_cobrado', p_monto, 'cuotas_equivalentes', v_cuotas_pagadas,
    'saldo_restante', v_op.saldo_restante,
    'operacion_estado', CASE WHEN v_op.saldo_restante = 0 THEN 'CANCELADO' ELSE 'VIGENTE' END,
    'excedente', v_disponible
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_cerrar_caja(
  p_id_cobrador INT,
  p_fecha DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_filas_actualizadas INT;
  v_total_rendido DECIMAL(14,2);
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'credit_on_role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede cerrar una caja';
  END IF;

  UPDATE cobros SET rendido_en_caja = TRUE
  WHERE id_cobrador = p_id_cobrador
    AND DATE(fecha_hora) = p_fecha
    AND rendido_en_caja = FALSE;
  GET DIAGNOSTICS v_filas_actualizadas = ROW_COUNT;

  SELECT COALESCE(SUM(monto_cobrado), 0) INTO v_total_rendido
  FROM cobros
  WHERE id_cobrador = p_id_cobrador AND DATE(fecha_hora) = p_fecha AND rendido_en_caja = TRUE;

  RETURN jsonb_build_object(
    'status', 'OK', 'cobros_cerrados', v_filas_actualizadas,
    'total_rendido', v_total_rendido, 'cobrador_id', p_id_cobrador,
    'fecha_cierre', p_fecha
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_registrar_cobro(INT, INT, DECIMAL, TIMESTAMPTZ, VARCHAR, VARCHAR, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_cerrar_caja(INT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registrar_cobro(INT, INT, DECIMAL, TIMESTAMPTZ, VARCHAR, VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cerrar_caja(INT, DATE) TO authenticated;
