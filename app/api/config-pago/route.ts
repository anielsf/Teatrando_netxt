/**
 * API Route: /api/config-pago
 * GET  → Devuelve la configuración actual del modo de pago (público, sin auth)
 * POST → Cambia el modo de pago (solo Admin)
 *
 * La configuración se almacena en Supabase (public.configuracion_sistema).
 * No utiliza el sistema de archivos local de Vercel.
 */
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export type ModoPago = 'pagolink_hosted' | 'c2p_directo';

const CLAVE_CONFIG = 'modo_pago';

const DEFAULT_CONFIG = {
  modo: 'c2p_directo' as ModoPago,
  descripcion: 'Formulario de pago directo en la web',
  actualizado_en: new Date().toISOString(),
  actualizado_por: 'sistema',
};

const MODOS_VALIDOS: ModoPago[] = ['pagolink_hosted', 'c2p_directo'];

interface ConfiguracionPagoDB {
  valor: {
    modo?: ModoPago;
    descripcion?: string;
    actualizado_por?: string;
  } | null;
  actualizado_en: string | null;
  actualizado_por: string | null;
}

/**
 * GET: consulta la configuración persistida en Supabase.
 * Es una ruta pública de lectura; utiliza el cliente administrativo
 * únicamente en el servidor para poder leer una tabla protegida por RLS.
 */
async function GETHandler(_req: Request) {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('configuracion_sistema')
    .select('valor, actualizado_en, actualizado_por')
    .eq('clave', CLAVE_CONFIG)
    .maybeSingle();

  if (error) {
    logger.error('Error consultando configuración de pago en Supabase', {
      message: error.message,
      code: error.code,
    });
    throw new Error(`No se pudo consultar la configuración de pago: ${error.message}`);
  }

  // Respaldo por si todavía no existe el registro inicial.
  if (!data) {
    return Response.json(DEFAULT_CONFIG);
  }

  const row = data as ConfiguracionPagoDB;
  const valor = row.valor || {};

  return Response.json({
    modo: valor.modo || DEFAULT_CONFIG.modo,
    descripcion: valor.descripcion || DEFAULT_CONFIG.descripcion,
    actualizado_en: row.actualizado_en || DEFAULT_CONFIG.actualizado_en,
    // Se conserva el nombre legible que espera la interfaz.
    actualizado_por: valor.actualizado_por || 'sistema',
  });
}

/**
 * POST: cambia el modo de pago.
 * Requiere un usuario autenticado con rol Admin.
 */
async function POSTHandler(req: Request) {
  const authResult = await requireAdmin();

  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  let body: { modo?: unknown };

  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: 'El cuerpo de la solicitud no contiene un JSON válido.' },
      { status: 400 }
    );
  }

  const modo = body?.modo;

  if (typeof modo !== 'string' || !MODOS_VALIDOS.includes(modo as ModoPago)) {
    return Response.json(
      {
        error: 'Modo de pago no válido. Usa "pagolink_hosted" o "c2p_directo".',
      },
      { status: 400 }
    );
  }

  const modoPago = modo as ModoPago;

  const descripcion =
    modoPago === 'pagolink_hosted'
      ? 'Pago a través del checkout oficial de PagoLink (Pago Móvil, C2P, Binance Pay, Transferencia)'
      : 'Formulario de pago directo integrado en la web de Teatrando (C2P / Débito Inmediato)';

  const actualizadoEn = new Date().toISOString();

  // El JSONB conserva los datos que consume la interfaz.
  // La columna actualizado_por guarda el UUID real del administrador.
  const config = {
    modo: modoPago,
    descripcion,
    actualizado_en: actualizadoEn,
    actualizado_por: user.nombre,
  };

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('configuracion_sistema')
    .upsert(
      {
        clave: CLAVE_CONFIG,
        valor: config,
        actualizado_en: actualizadoEn,
        actualizado_por: user.id,
      },
      { onConflict: 'clave' }
    );

  if (error) {
    logger.error('Error guardando configuración de pago en Supabase', {
      message: error.message,
      code: error.code,
      adminId: user.id,
    });
    throw new Error(`No se pudo guardar la configuración de pago: ${error.message}`);
  }

  logger.info('Modo de pago cambiado por administrador', {
    modo: modoPago,
    admin: user.nombre,
    adminId: user.id,
  });

  return Response.json({ ok: true, config });
}

// Next.js 14: exportar únicamente los métodos HTTP admitidos.
export const GET = withErrorHandler(GETHandler);
export const POST = withErrorHandler(POSTHandler);
