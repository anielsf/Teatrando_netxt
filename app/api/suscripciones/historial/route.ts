/**
 * GET /api/suscripciones/historial — historial completo de suscripciones (solo Admin)
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
       s.estado,
       s.created_at,
       s.updated_at,
       p.nombre           AS usuario_nombre,
       p.email            AS usuario_email,
       p.rol              AS usuario_rol
     FROM suscripciones s
     LEFT JOIN profiles p  ON p.id  = s.usuario_uuid
     LEFT JOIN planes   pl ON pl.clave = s.plan
     ORDER BY s.created_at DESC
     LIMIT 200`
  );
  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };
