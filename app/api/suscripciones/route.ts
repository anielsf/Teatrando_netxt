/**
 * API Route: /api/suscripciones
 * POST: Registrar nueva suscripción y actualizar rol en profiles
 */
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { obtenerTasaBCV, MENSAJE_TASA_NO_DISPONIBLE } from '@/lib/tasaBcv';

// Precios oficiales de los planes (mantener en sync con PLANES_MEMBRESIA del modal).
const PRECIO_PLAN_USD: Record<string, number> = {
  'Plan Básico (Gratis)': 0,
  'Plan Bambalinas': 9.99,
  'Plan Crítico / VIP': 19.99,
};

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  // El navegador solo elige el plan; precio, tasa y monto en Bs. se calculan aquí.
  const plan: string = body.plan || 'Plan Bambalinas';
  if (!Object.prototype.hasOwnProperty.call(PRECIO_PLAN_USD, plan)) {
    return Response.json({ error: 'Plan de suscripción no válido.' }, { status: 400 });
  }
  const precioUSD = PRECIO_PLAN_USD[plan];

  let tasaBCV = 0;
  let precioVES = 0;
  if (precioUSD > 0) {
    const tasa = await obtenerTasaBCV();
    if (!tasa.ok) {
      return Response.json({ error: MENSAJE_TASA_NO_DISPONIBLE }, { status: 503 });
    }
    tasaBCV = tasa.tasa;
    precioVES = Math.round(precioUSD * tasaBCV * 100) / 100;
  }
  // Plan gratuito: no se cobra nada, así que no depende de la tasa (se guarda 0).

  const refPago = (body.refPago || `REF-${Date.now()}`).toString().trim();

  // Determinar nuevo rol según el plan
  let nuevoRol = 'Usuario';
  if (plan === 'Plan Crítico / VIP') {
    nuevoRol = 'Crítico';
  } else if (user.rol === 'Admin') {
    nuevoRol = 'Admin'; // Admin no pierde su rol
  }

  // 1. Registrar suscripción en historial
  await query(
    `INSERT INTO suscripciones (id_usuario, usuario_uuid, plan, precio_usd, precio_ves, tasa_bcv, ref_pago, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Activa')`,
    [user.id, user.id, plan, precioUSD, precioVES, tasaBCV, refPago]
  );

  // 2. Actualizar rol y plan en profiles
  await query(
    `UPDATE profiles SET
       plan_suscripcion = $1,
       rol = CASE WHEN rol = 'Admin' THEN 'Admin' ELSE $2 END,
       updated_at = NOW()
     WHERE id = $3`,
    [plan, nuevoRol, user.id]
  );

  logger.info('Suscripción registrada', { userId: user.id, plan, nuevoRol, refPago });

  return Response.json({
    success: true,
    mensaje: `¡Suscripción activada con éxito al ${plan}!`,
    plan,
    rol: nuevoRol,
    precioUSD,
    precioVES,
    refPago,
    fecha: new Date().toISOString(),
  });
}

const POST_H = withErrorHandler(POST);
export { POST_H as POST };