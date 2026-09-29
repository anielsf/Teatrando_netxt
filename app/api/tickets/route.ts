/**
 * API Route: /api/tickets
 * GET: Tickets del usuario actual (o todos si es Admin)
 * POST: Emitir nuevo ticket para el usuario autenticado
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { query } from '@/lib/db';
import { requireAuth, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { obtenerTasaBCV, MENSAJE_TASA_NO_DISPONIBLE } from '@/lib/tasaBcv';

async function GET(req: Request) {
  const url = new URL(req.url);
  const idObra = url.searchParams.get('id_obra');

  // Si se solicita por id_obra para ver ocupación de asientos en checkout
  if (idObra) {
    const ocupados = await query(`
      SELECT asiento, fecha_funcion FROM public.tickets
      WHERE id_obra = $1
    `, [idObra]);
    return Response.json(ocupados);
  }

  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  let rows;
  if (user.rol === 'Admin' || user.rol === 'Grupo th') {
    // Admin o Grupo TH ven los tickets para auditoría y validación
    rows = await query(`
      SELECT t.*, c.obra, c.fecha AS fecha_funcion_cartelera, c.hora AS hora_funcion_cartelera
      FROM public.tickets t
      LEFT JOIN public.carteleras c ON t.id_obra = c.id
      ORDER BY t.created_at DESC
    `);
  } else {
    // Usuario ve solo sus propios tickets
    rows = await query(`
      SELECT t.*, c.obra, c.fecha AS fecha_funcion_cartelera, c.hora AS hora_funcion_cartelera
      FROM public.tickets t
      LEFT JOIN public.carteleras c ON t.id_obra = c.id
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
  // precio_usd, precio_ves y tasa_bcv que envíe el navegador se IGNORAN:
  // el precio sale de la cartelera y la tasa del BCV se calcula en el servidor.
  const {
    nombre_cliente, email_cliente, id_obra,
    obra, funcion, sala, asiento, fecha_funcion, hora_funcion,
    ref_pago,
  } = body;

  if (!asiento || !ref_pago || !id_obra) {
    return Response.json(
      { error: 'Obra, asiento y referencia de pago son requeridos.' },
      { status: 400 }
    );
  }

  const cartelera = await query<{ precio_usd: string | number | null }>(
    `SELECT precio_usd FROM public.carteleras WHERE id = $1`,
    [id_obra]
  );
  if (cartelera.length === 0) {
    return Response.json({ error: 'La función seleccionada no existe.' }, { status: 404 });
  }

  const precio_usd = Number(cartelera[0].precio_usd);
  if (!Number.isFinite(precio_usd) || precio_usd <= 0) {
    return Response.json(
      { error: 'La función no tiene un precio válido configurado.' },
      { status: 422 }
    );
  }

  const tasa = await obtenerTasaBCV();
  if (!tasa.ok) {
    return Response.json({ error: MENSAJE_TASA_NO_DISPONIBLE }, { status: 503 });
  }
  const tasa_bcv = tasa.tasa;
  const precio_ves = Math.round(precio_usd * tasa_bcv * 100) / 100;

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

  try {
    await query(
      `UPDATE public.carteleras SET butacas_disponibles = GREATEST(0, COALESCE(butacas_disponibles, 80) - 1) WHERE id = $1`,
      [id_obra]
    );
  } catch (e) {
    // Fail-open si la columna no estuviera en una base no migrada
  }

  logger.info('Ticket emitido', { ticketId, userId: user.id, obra, asiento, precio_usd, precio_ves, tasa_bcv });
  return Response.json({ success: true, ticket: rows[0] }, { status: 201 });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };