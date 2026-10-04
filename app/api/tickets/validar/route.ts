/**
 * API Route: /api/tickets/validar
 * POST: Valida y canjea un boleto escaneado en taquilla/puerta (QR)
 * Permisos: Admin o Grupo th
 */
import { query } from '@/lib/db';
import { requireAdminOrGrupoTH } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function POST(req: Request) {
  const authResult = await requireAdminOrGrupoTH();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const rawId = body.ticket_id || body.ticketId || body.ticket;

  if (!rawId) {
    return Response.json({ error: 'Identificador del ticket no proporcionado.' }, { status: 400 });
  }

  const ticketId = String(rawId).trim().toUpperCase();

  // Buscar boleto en la base de datos
  const rows = await query<any>(
    `SELECT t.*, c.obra as obra_nombre, c.grupo_teatral
     FROM public.tickets t
     LEFT JOIN public.carteleras c ON t.id_obra = c.id
     WHERE UPPER(t.ticket_id) = $1`,
    [ticketId]
  );

  if (rows.length === 0) {
    logger.warn('Intento de validar ticket inexistente', { ticketId, validador: user.nombre });
    return Response.json(
      { success: false, error: `Boleto [${ticketId}] no encontrado en el sistema.` },
      { status: 404 }
    );
  }

  const ticket = rows[0];

  // Si el usuario es de Grupo th, verificar que el boleto corresponda a una obra de su grupo
  if (user.rol === 'Grupo th' && ticket.grupo_teatral && ticket.grupo_teatral !== user.nombre) {
    return Response.json(
      {
        success: false,
        error: `Este boleto pertenece a "${ticket.grupo_teatral}". No tienes permisos para validarlo.`,
      },
      { status: 403 }
    );
  }

  // Verificar si ya fue canjeado
  if (ticket.utilizado || ticket.estado === 'canjeado') {
    return Response.json({
      success: false,
      yaUtilizado: true,
      mensaje: `⚠️ ¡ATENCIÓN! Este boleto ya fue CANJEADO previamente.`,
      ticket: {
        ticket_id: ticket.ticket_id,
        obra: ticket.obra || ticket.obra_nombre,
        asiento: ticket.asiento,
        fecha_funcion: ticket.fecha_funcion,
        nombre_cliente: ticket.nombre_cliente,
        fecha_utilizacion: ticket.fecha_utilizacion,
        validado_por: ticket.validado_por,
      },
    }, { status: 409 });
  }

  // Canjear y marcar boleto como utilizado
  const now = new Date();
  await query(
    `UPDATE public.tickets
     SET utilizado = true,
         estado = 'canjeado',
         fecha_utilizacion = $1,
         validado_por = $2
     WHERE UPPER(ticket_id) = $3`,
    [now.toISOString(), `${user.nombre} (${user.rol})`, ticketId]
  );

  logger.info('Boleto validado con éxito en taquilla', {
    ticketId,
    validador: user.nombre,
    obra: ticket.obra,
    asiento: ticket.asiento,
  });

  return Response.json({
    success: true,
    mensaje: `Boleto [${ticketId}] validado exitosamente. Acceso permitido.`,
    ticket: {
      ticket_id: ticket.ticket_id,
      obra: ticket.obra || ticket.obra_nombre,
      sala: ticket.sala,
      asiento: ticket.asiento,
      fecha_funcion: ticket.fecha_funcion,
      hora_funcion: ticket.hora_funcion,
      nombre_cliente: ticket.nombre_cliente,
      ref_pago: ticket.ref_pago,
      fecha_utilizacion: now.toISOString(),
      validado_por: user.nombre,
    },
  });
}

const POST_H = withErrorHandler(POST);
export { POST_H as POST };
