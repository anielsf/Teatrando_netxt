/**
 * API Route: /api/suscripciones
 * POST: Registrar suscripción a un plan (los planes y precios salen de public.planes).
 *  - Plan sin aprobación: se activa y actualiza rol/plan en profiles.
 *  - Plan con aprobación: queda 'Pendiente' hasta que un Admin lo apruebe.
 */
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { obtenerTasaBCV, MENSAJE_TASA_NO_DISPONIBLE } from '@/lib/tasaBcv';
import { obtenerPlan, rolResultante } from '@/lib/planes';

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();

  // El navegador solo elige el plan; precio, tasa, monto y rol se calculan aquí.
  const plan = await obtenerPlan(String(body.plan ?? ''));
  if (!plan || !plan.activo) {
    return Response.json({ error: 'Ese plan no está disponible.' }, { status: 400 });
  }
  const precioUSD = plan.precio_usd;

  let refPago = String(body.refPago ?? '').trim();
  if (precioUSD > 0 && !refPago) {
    return Response.json({ error: 'La referencia de pago es obligatoria.' }, { status: 400 });
  }
  if (precioUSD === 0 && !refPago) refPago = 'PLAN-GRATIS';

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

  const pendiente = plan.requiere_aprobacion && user.rol !== 'Admin';
  const estado = pendiente ? 'Pendiente' : 'Activa';

  // 1. Registrar en el historial
  await query(
    `INSERT INTO suscripciones (id_usuario, usuario_uuid, plan, precio_usd, precio_ves, tasa_bcv, ref_pago, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [user.id, user.id, plan.clave, precioUSD, precioVES, tasaBCV, refPago, estado]
  );

  // 2. Si no necesita aprobación, aplicar plan y rol ya
  let rol = user.rol as string;
  if (!pendiente) {
    rol = rolResultante(user.rol, plan.rol_otorgado);
    await query(
      `UPDATE profiles SET plan_suscripcion = $1, rol = $2, updated_at = NOW() WHERE id = $3`,
      [plan.clave, rol, user.id]
    );
  }

  logger.info('Suscripción registrada', { userId: user.id, plan: plan.clave, estado, rol, refPago });

  return Response.json({
    success: true,
    pendiente,
    mensaje: pendiente
      ? `Recibimos tu solicitud al ${plan.nombre}. Un administrador la revisará y activará tu plan.`
      : `¡Suscripción activada con éxito al ${plan.nombre}!`,
    plan: plan.nombre,
    rol,
    precioUSD,
    precioVES,
    refPago,
    fecha: new Date().toISOString(),
  });
}

const POST_H = withErrorHandler(POST);
export { POST_H as POST };