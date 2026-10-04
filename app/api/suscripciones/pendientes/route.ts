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
    `SELECT s.id::text AS id, s.plan, s.precio_usd, s.precio_ves, s.ref_pago,
            p.nombre AS usuario_nombre, p.email AS usuario_email, p.rol AS usuario_rol
     FROM suscripciones s
     LEFT JOIN profiles p ON p.id = s.usuario_uuid
     WHERE s.estado = 'Pendiente'
     ORDER BY s.id DESC`
  );
  return Response.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };