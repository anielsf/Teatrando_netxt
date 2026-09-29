/**
 * API Route: /api/suscripciones
 * POST: Registrar nueva suscripción y actualizar rol en profiles
 */
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const plan       = body.plan || 'Plan Bambalinas';
  const precioUSD  = parseFloat(body.precioUSD) || 9.99;
  const tasaBCV    = parseFloat(body.tasaBCV) || 798.33;
  const precioVES  = body.precioVES !== undefined
    ? parseFloat(body.precioVES)
    : Math.round(precioUSD * tasaBCV * 100) / 100;
  const refPago    = (body.refPago || `REF-${Date.now()}`).toString().trim();

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
