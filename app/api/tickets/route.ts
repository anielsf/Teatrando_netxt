/**
 * API Route: /api/tickets
 * GET: Tickets del usuario actual (o todos si es Admin)
 * POST: Emitir nuevo ticket para el usuario autenticado
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import { requireAuth, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  let rows;
  if (user.rol === 'Admin') {
    // Admin ve todos los tickets
    rows = await query(`
      SELECT t.*, c.obra, c.fecha AS fecha_funcion_cartelera, c.hora AS hora_funcion_cartelera
      FROM tickets t
      LEFT JOIN carteleras c ON t.id_obra = c.id
      ORDER BY t.created_at DESC
    `);
  } else {
    // Usuario ve solo sus propios tickets
    rows = await query(`
      SELECT t.*, c.obra, c.fecha AS fecha_funcion_cartelera, c.hora AS hora_funcion_cartelera
      FROM tickets t
      LEFT JOIN carteleras c ON t.id_obra = c.id
      WHERE t.usuario_uuid = $1
      ORDER BY t.created_at DESC
    `, [user.id]);
  }

  return Response.json(rows);
}

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const {
    nombre_cliente, email_cliente, id_obra,
    obra, funcion, sala, asiento, fecha_funcion, hora_funcion,
    precio_usd, precio_ves, tasa_bcv, ref_pago,
  } = body;

  if (!asiento || !ref_pago || !precio_usd) {
    return Response.json(
      { error: 'Asiento, referencia de pago y precio son requeridos.' },
      { status: 400 }
    );
  }

  // Verificar que el asiento no esté ya ocupado
  const existing = await query(
    `SELECT ticket_id FROM tickets WHERE asiento=$1 AND id_obra=$2 AND fecha_funcion=$3`,
    [asiento, id_obra, fecha_funcion]
  );
  if (existing.length > 0) {
    return Response.json(
      { error: `El asiento ${asiento} ya fue reservado para esta función.` },
      { status: 409 }
    );
  }

  const supabase = createSupabaseServerClient();
  const now = new Date();
  const ticketId = `TCK-${now.getTime().toString(36).toUpperCase()}`;

  const rows = await query(
    `INSERT INTO tickets
      (ticket_id, id_usuario, usuario_uuid, id_obra, nombre_cliente, email_cliente,
       obra, funcion, sala, asiento, fecha_funcion, hora_funcion,
       precio_usd, precio_ves, tasa_bcv, ref_pago,
       fecha_emision, hora_emision)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      ticketId, user.id, user.id, id_obra,
      nombre_cliente || user.nombre,
      email_cliente || user.email,
      obra, funcion, sala, asiento,
      fecha_funcion, hora_funcion,
      precio_usd, precio_ves, tasa_bcv, ref_pago,
      now.toISOString().split('T')[0],
      now.toTimeString().split(' ')[0],
    ]
  );

  logger.info('Ticket emitido', { ticketId, userId: user.id, obra, asiento });
  return Response.json({ success: true, ticket: rows[0] }, { status: 201 });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };
