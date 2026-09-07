import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

/**
 * Cliente usado exclusivamente desde el renderer. Solo admite la clave pública
 * de Supabase; una service_role nunca debe incluirse en variables VITE_.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase no está configurado. Cree .env.local a partir de .env.example y reinicie la aplicación.'
    );
  }

  return supabase;
}

export async function cerrarCajaEnSupabase(payload: {
  id_cobrador: number;
  fecha: string;
}): Promise<{ cobros_cerrados: number; total_rendido: number }> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('fn_cerrar_caja', {
    p_id_cobrador: payload.id_cobrador,
    p_fecha: payload.fecha,
  });

  if (error) throw error;
  if (data?.status !== 'OK') {
    throw new Error('Supabase no confirmó el cierre de caja.');
  }

  return {
    cobros_cerrados: Number(data.cobros_cerrados || 0),
    total_rendido: Number(data.total_rendido || 0),
  };
}

export async function crearOperacionEnSupabase(input: {
  cliente: {
    nombre: string;
    dni: string;
    domicilio: string;
    telefono: string;
    referencia?: string;
  };
  tipo: 'EFECTIVO' | 'PRODUCTO';
  fecha: string;
  cobradorNombre: string;
  planDias: number;
  montoCapital: number;
  montoTotal: number;
  importeCuota: number;
  productoNombre?: string;
}): Promise<number> {
  const client = requireSupabase();
  const dni = input.cliente.dni.trim().toUpperCase() || null;
  let idCliente: number | null = null;

  if (dni) {
    const { data, error } = await client
      .from('clientes')
      .select('id_cliente')
      .eq('dni', dni)
      .maybeSingle();

    if (error) throw error;
    idCliente = data?.id_cliente ?? null;
  }

  if (!idCliente) {
    const { data, error } = await client
      .from('clientes')
      .insert({
        nombre: input.cliente.nombre.trim().toUpperCase(),
        dni,
        domicilio: input.cliente.domicilio.trim(),
        telefono: input.cliente.telefono.trim() || null,
        notas: input.cliente.referencia?.trim() || null,
      })
      .select('id_cliente')
      .single();

    if (error) throw error;
    idCliente = data.id_cliente;
  }

  const { data: cobrador, error: cobradorError } = await client
    .from('cobradores')
    .select('id_cobrador')
    .eq('nombre', input.cobradorNombre)
    .eq('activo', true)
    .maybeSingle();
  if (cobradorError) throw cobradorError;
  if (!cobrador) {
    throw new Error(`No se encontró el cobrador activo “${input.cobradorNombre}” en Supabase.`);
  }

  const { data: plan, error: planError } = await client
    .from('planes')
    .select('id_plan')
    .eq('tipo', input.tipo)
    .eq('dias', input.planDias)
    .eq('activo', true)
    .maybeSingle();
  if (planError) throw planError;
  if (!plan) {
    throw new Error(`No existe un plan ${input.tipo} de ${input.planDias} días en Supabase.`);
  }

  let idProducto: number | null = null;
  if (input.tipo === 'PRODUCTO') {
    const { data: producto, error: productoError } = await client
      .from('productos')
      .select('id_producto, stock_deposito')
      .eq('nombre', input.productoNombre || '')
      .eq('activo', true)
      .maybeSingle();
    if (productoError) throw productoError;
    if (!producto) {
      throw new Error(`No existe el producto “${input.productoNombre}” en el catálogo de Supabase.`);
    }
    if (Number(producto.stock_deposito) < 1) {
      throw new Error(`El producto “${input.productoNombre}” no tiene stock disponible.`);
    }
    idProducto = producto.id_producto;
  }

  const { data: operacion, error: operacionError } = await client
    .from('operaciones')
    .insert({
      fecha: input.fecha,
      id_cliente: idCliente,
      tipo: input.tipo,
      id_producto: idProducto,
      id_plan: plan.id_plan,
      id_cobrador_actual: cobrador.id_cobrador,
      monto_capital: input.montoCapital,
      monto_total: input.montoTotal,
      importe_cuota: input.importeCuota,
      saldo_restante: input.montoTotal,
      domicilio_cobro: input.cliente.domicilio.trim(),
      ganancia_estimada: input.montoTotal - input.montoCapital,
      notas: input.cliente.referencia?.trim() || null,
    })
    .select('nro_op')
    .single();

  if (operacionError) throw operacionError;
  return operacion.nro_op;
}
