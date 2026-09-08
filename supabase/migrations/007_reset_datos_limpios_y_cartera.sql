-- =============================================================================
-- CREDIT-ON — Migración 007: Limpieza Total de Datos Residuales y Carga de Cartera Real
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase para dejar la base de datos impecable
-- con operaciones reales vinculadas entre la Web Móvil de Cobradores y el Sistema Central.
-- =============================================================================

-- 1. LIMPIEZA COMPLETA DE TABLAS OPERATIVAS RESIDUALES
TRUNCATE TABLE public.cobros, public.cuotas, public.operaciones, public.clientes RESTART IDENTITY CASCADE;

-- 2. ASEGURAR CONSTRAINTS PERMISIVOS PARA VISITAS SIN PAGO EN COBROS
ALTER TABLE public.cobros DROP CONSTRAINT IF EXISTS ck_cobros_monto;
ALTER TABLE public.cobros ADD CONSTRAINT ck_cobros_monto CHECK (monto_cobrado >= 0);
ALTER TABLE public.cobros DROP CONSTRAINT IF EXISTS ck_cobros_cuotas_eq;
ALTER TABLE public.cobros ADD CONSTRAINT ck_cobros_cuotas_eq CHECK (cuotas_equivalentes >= 0);

-- 3. ASEGURAR ZONAS Y COBRADORES OFICIALES
INSERT INTO public.zonas (id_zona, nombre, descripcion) VALUES
  (1, 'Zona Centro (Capital)', 'Circuito comercial Centro y Belgrano'),
  (2, 'Zona Sur (Ejército Argentino)', 'Circuito residencial Sur'),
  (3, 'Zona La Banda (Centro)', 'Circuito La Banda y alrededores')
ON CONFLICT (id_zona) DO UPDATE SET nombre = EXCLUDED.nombre;

INSERT INTO public.cobradores (id_cobrador, nombre, telefono, porcentaje_comision, activo) VALUES
  (1, 'Ariel Gómez', '+54 9 385 412-3456', 8.00, true),
  (2, 'Carlos Mendilaharzu', '+54 9 385 445-1290', 8.00, true),
  (3, 'Álvaro Morales', '+54 9 385 671-0023', 8.00, true),
  (4, 'Mauro Sánchez', '+54 9 385 552-8812', 8.00, true),
  (5, 'Antonela Rossi', '+54 9 385 332-9011', 9.00, true)
ON CONFLICT (id_cobrador) DO UPDATE SET nombre = EXCLUDED.nombre, activo = true;

-- 3. ASEGURAR PLANES Y PRODUCTOS
INSERT INTO public.planes (id_plan, tipo, dias, tasa_interes, descripcion, activo) VALUES
  (1, 'EFECTIVO', 26, 30.00, 'Préstamo Efectivo 26 cuotas diarias', true),
  (2, 'EFECTIVO', 35, 40.00, 'Préstamo Efectivo 35 cuotas diarias', true),
  (3, 'PRODUCTO', 42, 0.00, 'Financiación Electro / Moto 42 cuotas', true)
ON CONFLICT (id_plan) DO UPDATE SET tipo = EXCLUDED.tipo;

INSERT INTO public.productos (id_producto, nombre, categoria, costo, stock_deposito, stock_calle, activo) VALUES
  (1, 'MOTO CORVEN MIRAGE 110cc', 'Motos', 350000.00, 5, 2, true),
  (2, 'SMART TV SAMSUNG 43" 4K', 'Electro', 180000.00, 8, 3, true),
  (3, 'SOMMIER 2 PLAZAS CANON', 'Hogar', 120000.00, 10, 1, true)
ON CONFLICT (id_producto) DO UPDATE SET nombre = EXCLUDED.nombre, costo = EXCLUDED.costo;

-- 4. INSERTAR CLIENTES MODELO LIMPIOS
INSERT INTO public.clientes (id_cliente, nombre, dni, domicilio, telefono, calificacion) VALUES
  (1, 'PÉREZ JUAN CARLOS', '28456123', 'Av. Belgrano 1420 - Centro', '385-4123456', 'BUENO'),
  (2, 'GÓMEZ MARÍA LAURA', '33445566', 'Roca Sur 245 - B° Cabildo', '385-6112233', 'REGULAR'),
  (3, 'RODRÍGUEZ HUGO O.', '25667788', 'Av. Colón Sur 3100 - B° Ej. Argentino', '385-4889900', 'BUENO'),
  (4, 'BENÍTEZ CLAUDIO A.', '29887112', 'Calle 12 N° 450 - B° Mishqui Mayu', '385-4771234', 'REGULAR'),
  (5, 'BAZÁN NORMA BEATRIZ', '22334556', 'Jujuy 560 - B° Centro', '385-5129988', 'BUENO'),
  (6, 'CORVALÁN RAMÓN E.', '24556778', 'Pasaje 12 Casa 44 - B° Autonomía', '385-5334455', 'BUENO');

-- 5. INSERTAR OPERACIONES ACTIVAS (Nro OP 101 a 106)
-- Vinculadas a los cobradores para prueba en calle:
-- OP 101, 102, 103 -> Cobrador 1 (Ariel Gómez)
-- OP 104           -> Cobrador 2 (Carlos Mendilaharzu)
-- OP 105           -> Cobrador 3 (Álvaro Morales)
-- OP 106           -> Cobrador 4 (Mauro Sánchez)
INSERT INTO public.operaciones (
  nro_op, fecha, id_cliente, tipo, id_producto, id_plan,
  id_cobrador_actual, id_zona, monto_capital, monto_total,
  importe_cuota, saldo_restante, orden_recorrido, estado,
  domicilio_cobro, ganancia_estimada
) VALUES
  (101, CURRENT_DATE - INTERVAL '5 days', 1, 'EFECTIVO', NULL, 1, 1, 1, 100000.00, 130000.00, 5000.00, 120000.00, 1, 'VIGENTE', 'Av. Belgrano 1420 - Centro', 30000.00),
  (102, CURRENT_DATE - INTERVAL '3 days', 2, 'EFECTIVO', NULL, 1, 1, 1, 80000.00, 104000.00, 4000.00, 104000.00, 2, 'VIGENTE', 'Roca Sur 245 - B° Cabildo', 24000.00),
  (103, CURRENT_DATE - INTERVAL '10 days', 3, 'PRODUCTO', 1, 3, 1, 1, 350000.00, 504000.00, 12000.00, 456000.00, 3, 'VIGENTE', 'Av. Colón Sur 3100 - B° Ej. Argentino', 154000.00),
  (104, CURRENT_DATE - INTERVAL '2 days', 4, 'EFECTIVO', NULL, 1, 2, 2, 60000.00, 78000.00, 3000.00, 78000.00, 1, 'VIGENTE', 'Calle 12 N° 450 - B° Mishqui Mayu', 18000.00),
  (105, CURRENT_DATE - INTERVAL '4 days', 5, 'PRODUCTO', 2, 3, 3, 3, 180000.00, 270000.00, 13500.00, 270000.00, 1, 'VIGENTE', 'Jujuy 560 - B° Centro', 90000.00),
  (106, CURRENT_DATE - INTERVAL '1 days', 6, 'EFECTIVO', NULL, 1, 4, 1, 120000.00, 156000.00, 6000.00, 156000.00, 1, 'VIGENTE', 'Pasaje 12 Casa 44 - B° Autonomía', 36000.00);

-- Ajustar las secuencias de IDs al máximo actual de forma segura
DO $$
BEGIN
  IF pg_get_serial_sequence('public.operaciones', 'nro_op') IS NOT NULL THEN
    PERFORM setval(pg_get_serial_sequence('public.operaciones', 'nro_op'), 106, true);
  END IF;
  IF pg_get_serial_sequence('public.clientes', 'id_cliente') IS NOT NULL THEN
    PERFORM setval(pg_get_serial_sequence('public.clientes', 'id_cliente'), 6, true);
  END IF;
  IF pg_get_serial_sequence('public.productos', 'id_producto') IS NOT NULL THEN
    PERFORM setval(pg_get_serial_sequence('public.productos', 'id_producto'), 3, true);
  END IF;
END $$;

-- 6. GENERAR CUOTAS PARA CADA OPERACIÓN (26 cuotas para OP 101, 102, 104, 106; 42 cuotas para 103, 105)
DO $$
DECLARE
  r RECORD;
  i INT;
  dias_total INT;
  f_venc DATE;
  c_monto NUMERIC;
BEGIN
  FOR r IN SELECT nro_op, fecha, importe_cuota, tipo FROM public.operaciones LOOP
    IF r.tipo = 'EFECTIVO' THEN
      dias_total := 26;
    ELSE
      dias_total := 42;
    END IF;
    c_monto := r.importe_cuota;
    f_venc := r.fecha;

    FOR i IN 1..dias_total LOOP
      -- Excluir domingos
      f_venc := f_venc + INTERVAL '1 day';
      IF EXTRACT(DOW FROM f_venc) = 0 THEN
        f_venc := f_venc + INTERVAL '1 day';
      END IF;

      INSERT INTO public.cuotas (
        nro_op, numero_cuota, fecha_vencimiento, monto_esperado, monto_pagado, estado, fecha_pago_efectivo
      ) VALUES (
        r.nro_op,
        i,
        f_venc,
        c_monto,
        CASE WHEN r.nro_op = 101 AND i <= 2 THEN c_monto
             WHEN r.nro_op = 103 AND i <= 4 THEN c_monto
             ELSE 0.00 END,
        CASE WHEN r.nro_op = 101 AND i <= 2 THEN 'PAGADA'
             WHEN r.nro_op = 103 AND i <= 4 THEN 'PAGADA'
             ELSE 'PENDIENTE' END,
        CASE WHEN r.nro_op = 101 AND i <= 2 THEN r.fecha
             WHEN r.nro_op = 103 AND i <= 4 THEN r.fecha
             ELSE NULL END
      ) ON CONFLICT (nro_op, numero_cuota) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- 8. REGISTRAR COBROS HISTÓRICOS DE EJEMPLO PARA AUDITORÍA
INSERT INTO public.cobros (
  nro_op, id_cobrador, monto_cobrado, cuotas_equivalentes, rendido_en_caja, observacion, fecha_hora
) VALUES
  (101, 1, 5000.00, 1.0, true, 'Cobro cuota 1 en circuito', CURRENT_TIMESTAMP - INTERVAL '4 days'),
  (101, 1, 5000.00, 1.0, true, 'Cobro cuota 2 en circuito', CURRENT_TIMESTAMP - INTERVAL '2 days'),
  (103, 1, 12000.00, 1.0, true, 'Cobro cuota 1 moto', CURRENT_TIMESTAMP - INTERVAL '8 days');

-- 9. REFRESCAR VISTA DE HOJA DE RUTA
DROP VIEW IF EXISTS public.vw_hoja_de_ruta CASCADE;
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
  ROW_NUMBER() OVER(PARTITION BY o.id_cobrador_actual ORDER BY o.orden_recorrido, o.nro_op) AS orden_recorrido
FROM public.operaciones o
JOIN public.clientes cl ON cl.id_cliente = o.id_cliente
LEFT JOIN public.cobradores c ON c.id_cobrador = o.id_cobrador_actual
LEFT JOIN public.productos p ON p.id_producto = o.id_producto
WHERE o.estado = 'VIGENTE';

GRANT SELECT ON public.vw_hoja_de_ruta TO authenticated, anon;

-- 10. POLÍTICAS RLS Y PERMISOS GLOBALES PARA PWA Y SISTEMA CENTRAL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_registrar_cobro') THEN
    GRANT EXECUTE ON FUNCTION public.fn_registrar_cobro TO authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_cerrar_caja') THEN
    GRANT EXECUTE ON FUNCTION public.fn_cerrar_caja TO authenticated, anon;
  END IF;
END $$;

-- Permisos DML en tablas
GRANT ALL ON TABLE public.cobros TO authenticated, anon;
GRANT ALL ON TABLE public.cuotas TO authenticated, anon;
GRANT ALL ON TABLE public.operaciones TO authenticated, anon;
GRANT ALL ON TABLE public.clientes TO authenticated, anon;
GRANT ALL ON TABLE public.cobradores TO authenticated, anon;
GRANT ALL ON TABLE public.productos TO authenticated, anon;
GRANT ALL ON TABLE public.planes TO authenticated, anon;
GRANT ALL ON TABLE public.zonas TO authenticated, anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- Asegurar políticas RLS permisivas
DROP POLICY IF EXISTS pwa_cobros_all ON public.cobros;
CREATE POLICY pwa_cobros_all ON public.cobros FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pwa_operaciones_all ON public.operaciones;
CREATE POLICY pwa_operaciones_all ON public.operaciones FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pwa_cuotas_all ON public.cuotas;
CREATE POLICY pwa_cuotas_all ON public.cuotas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pwa_clientes_all ON public.clientes;
CREATE POLICY pwa_clientes_all ON public.clientes FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pwa_cobradores_all ON public.cobradores;
CREATE POLICY pwa_cobradores_all ON public.cobradores FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
