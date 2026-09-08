-- =============================================================================
-- CREDIT-ON — Migración 006: Habilitación de Terminal Cobrador PWA y Sincronización
-- =============================================================================
-- Ejecutar en el SQL Editor del Dashboard de Supabase.
-- 
-- 1. Asegura permisos de ejecución para la RPC transaccional de cobros.
-- 2. Permite inserción y lectura de cobros y operaciones tanto para usuarios
--    autenticados como para la terminal móvil PWA.
-- =============================================================================

-- 1. Permisos en las funciones RPC de Cobro y Cierre de Caja
DO $$
BEGIN
  -- Permisos para fn_registrar_cobro
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_registrar_cobro') THEN
    GRANT EXECUTE ON FUNCTION public.fn_registrar_cobro TO authenticated, anon;
  END IF;

  -- Permisos para fn_cerrar_caja
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_cerrar_caja') THEN
    GRANT EXECUTE ON FUNCTION public.fn_cerrar_caja TO authenticated, anon;
  END IF;
END $$;

-- 2. Políticas RLS permisivas y seguras para la Terminal Cobrador
-- Permitir que la tabla 'cobros' reciba inserciones de la Terminal Móvil
DROP POLICY IF EXISTS pwa_cobros_insert ON public.cobros;
CREATE POLICY pwa_cobros_insert ON public.cobros
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

DROP POLICY IF EXISTS pwa_cobros_select ON public.cobros;
CREATE POLICY pwa_cobros_select ON public.cobros
  FOR SELECT TO authenticated, anon
  USING (true);

-- Permitir que las operaciones puedan ser consultadas y actualizadas al cobrar
DROP POLICY IF EXISTS pwa_operaciones_select ON public.operaciones;
CREATE POLICY pwa_operaciones_select ON public.operaciones
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS pwa_operaciones_update ON public.operaciones;
CREATE POLICY pwa_operaciones_update ON public.operaciones
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Permitir lectura y actualización de cuotas
DROP POLICY IF EXISTS pwa_cuotas_select ON public.cuotas;
CREATE POLICY pwa_cuotas_select ON public.cuotas
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS pwa_cuotas_update ON public.cuotas;
CREATE POLICY pwa_cuotas_update ON public.cuotas
  FOR UPDATE TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Permitir lectura de clientes y cobradores
DROP POLICY IF EXISTS pwa_clientes_select ON public.clientes;
CREATE POLICY pwa_clientes_select ON public.clientes
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS pwa_cobradores_select ON public.cobradores;
CREATE POLICY pwa_cobradores_select ON public.cobradores
  FOR SELECT TO authenticated, anon
  USING (true);

-- 3. Crear o refrescar vista vw_hoja_de_ruta con permisos públicos
CREATE OR REPLACE VIEW public.vw_hoja_de_ruta AS
SELECT
  o.nro_op,
  o.id_cobrador_actual AS id_cobrador,
  c.nombre AS cobrador_nombre,
  cl.id_cliente,
  cl.nombre AS cliente,
  cl.telefono,
  COALESCE(o.domicilio_cobro, cl.domicilio) AS domicilio,
  o.tipo,
  p.nombre AS producto,
  o.importe_cuota,
  o.saldo_restante,
  o.importe_cuota AS monto_exigible_hoy,
  COALESCE((
    SELECT COUNT(*)
    FROM public.cuotas cu
    WHERE cu.nro_op = o.nro_op
      AND cu.estado = 'PENDIENTE'
      AND cu.fecha_vencimiento < CURRENT_DATE
  ), 0) AS cuotas_vencidas,
  COALESCE((
    SELECT SUM(cu.monto_esperado - cu.monto_pagado)
    FROM public.cuotas cu
    WHERE cu.nro_op = o.nro_op
      AND cu.estado IN ('PENDIENTE', 'PARCIAL')
      AND cu.fecha_vencimiento < CURRENT_DATE
  ), 0) AS deuda_vencida,
  ROW_NUMBER() OVER(PARTITION BY o.id_cobrador_actual ORDER BY o.nro_op) AS orden_recorrido
FROM public.operaciones o
JOIN public.clientes cl ON cl.id_cliente = o.id_cliente
LEFT JOIN public.cobradores c ON c.id_cobrador = o.id_cobrador_actual
LEFT JOIN public.productos p ON p.id_producto = o.id_producto
WHERE o.estado = 'VIGENTE';

GRANT SELECT ON public.vw_hoja_de_ruta TO authenticated, anon;
