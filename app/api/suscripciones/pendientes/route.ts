/**
 * GET /api/suscripciones/pendientes — solicitudes en estado 'Pendiente' (solo Admin)
 */
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const rows = await query(
    `SELECT
       s.id::text         AS id,
       s.plan,
       pl.nombre          AS plan_nombre,
       s.precio_usd,
       s.precio_ves,
       s.tasa_bcv,
       s.ref_pago,
       s.created_at,
       p.nombre           AS usuario_nombre,
       p.email            AS usuario_email,
       p.rol              AS usuario_rol,
       p.plan_suscripcion AS usuario_plan_actual
     FROM suscripciones s
     LEFT JOIN profiles p  ON p.id  = s.usuario_uuid
     LEFT JOIN planes   pl ON pl.clave = s.plan
     WHERE s.estado = 'Pendiente'
     ORDER BY s.created_at ASC`
  );
  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };