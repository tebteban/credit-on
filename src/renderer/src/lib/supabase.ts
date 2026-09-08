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

  // 1. Resolver o registrar Cobrador
  let idCobrador: number | null = null;
  const nombreLimpio = input.cobradorNombre.includes(' - ')
    ? input.cobradorNombre.split(' - ').slice(1).join(' - ').trim()
    : input.cobradorNombre.trim();

  try {
    const { data: cobrador } = await client
      .from('cobradores')
      .select('id_cobrador')
      .or(`nombre.ilike.%${nombreLimpio}%,nombre.ilike.%${input.cobradorNombre.trim()}%`)
      .eq('activo', true)
      .limit(1)
      .maybeSingle();

    if (cobrador?.id_cobrador) {
      idCobrador = cobrador.id_cobrador;
    } else {
      const { data: nuevoCob } = await client
        .from('cobradores')
        .insert({
          nombre: nombreLimpio || input.cobradorNombre.trim(),
          porcentaje_comision: 8.0,
          activo: true,
        })
        .select('id_cobrador')
        .single();
      if (nuevoCob?.id_cobrador) {
        idCobrador = nuevoCob.id_cobrador;
      }
    }
  } catch (e) {
    console.warn('Error resolviendo cobrador en Supabase:', e);
  }

  if (!idCobrador) {
    try {
      const { data: primerCob } = await client
        .from('cobradores')
        .select('id_cobrador')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      idCobrador = primerCob?.id_cobrador ?? 1;
    } catch {
      idCobrador = 1;
    }
  }

  // 2. Resolver Plan
  let idPlan: number | null = null;
  try {
    const { data: plan } = await client
      .from('planes')
      .select('id_plan')
      .eq('tipo', input.tipo)
      .eq('dias', input.planDias)
      .eq('activo', true)
      .maybeSingle();

    if (plan?.id_plan) {
      idPlan = plan.id_plan;
    } else {
      const { data: primerPlan } = await client
        .from('planes')
        .select('id_plan')
        .eq('tipo', input.tipo)
        .eq('activo', true)
        .limit(1)
        .maybeSingle();
      idPlan = primerPlan?.id_plan ?? null;
    }
  } catch (e) {
    console.warn('Error resolviendo plan en Supabase:', e);
  }

  // 3. Resolver Producto si aplica
  let idProducto: number | null = null;
  if (input.tipo === 'PRODUCTO' && input.productoNombre) {
    try {
      const { data: producto } = await client
        .from('productos')
        .select('id_producto, stock_deposito')
        .ilike('nombre', `%${input.productoNombre.trim()}%`)
        .eq('activo', true)
        .limit(1)
        .maybeSingle();

      if (producto?.id_producto) {
        idProducto = producto.id_producto;
      } else {
        const { data: nuevoProd } = await client
          .from('productos')
          .insert({
            nombre: input.productoNombre.trim(),
            stock_deposito: 10,
            stock_calle: 0,
            costo_ars: input.montoCapital,
            activo: true,
          })
          .select('id_producto')
          .single();
        if (nuevoProd?.id_producto) {
          idProducto = nuevoProd.id_producto;
        }
      }
    } catch (e) {
      console.warn('Error resolviendo producto en Supabase:', e);
    }
  }

  const { data: operacion, error: operacionError } = await client
    .from('operaciones')
    .insert({
      fecha: input.fecha,
      id_cliente: idCliente,
      tipo: input.tipo,
      id_producto: idProducto,
      id_plan: idPlan,
      id_cobrador_actual: idCobrador,
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
