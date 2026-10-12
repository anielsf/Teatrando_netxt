/**
 * PATCH /api/tickets/[id] — Aprobar o rechazar el pago de un boleto (Admin o Grupo th)
 * body: { accion: 'aprobar' | 'rechazar' }
 * - 'aprobar'  -> estado = 'valido' (queda listo para usarse en taquilla)
 * - 'rechazar' -> estado = 'rechazado' (acceso denegado)
 */
import { query } from '@/lib/db';
import { requireAdminOrGrupoTH } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function PATCH(req: Request, context?: Record<string, unknown>) {
  const auth = await requireAdminOrGrupoTH();
  if (auth instanceof Response) return auth;
  const { user } = auth;

  const id = String((context?.params as { id?: string } | undefined)?.id ?? '').trim();
  const body = await req.json();
  const accion = body.accion;

  if (!id || (accion !== 'aprobar' && accion !== 'rechazar')) {
    return Response.json({ error: 'Acción inválida. Usa "aprobar" o "rechazar".' }, { status: 400 });
  }

  // Buscar el boleto por id numérico o por código ticket_id (ej. TCK-...)
  const rows = await query<any>(
    `SELECT t.*, c.grupo_teatral
     FROM public.tickets t
     LEFT JOIN public.carteleras c ON t.id_obra = c.id
     WHERE t.id::text = $1 OR UPPER(t.ticket_id) = UPPER($1)
     LIMIT 1`,
    [id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'Boleto no encontrado.' }, { status: 404 });
  }

  const ticket = rows[0];

  // Si es Grupo th, verificar que sea de su grupo
  if (user.rol === 'Grupo th' && ticket.grupo_teatral && ticket.grupo_teatral !== user.nombre) {
    return Response.json(
      { error: 'No tienes permisos para validar pagos de boletos de otros grupos teatrales.' },
      { status: 403 }
    );
  }

  // Si ya fue canjeado en puerta, no se puede cambiar a rechazado ni revertir
  if (ticket.utilizado || ticket.estado === 'canjeado') {
    return Response.json(
      { error: 'Este boleto ya fue canjeado en puerta y ha expirado. No se puede modificar.' },
      { status: 409 }
    );
  }

  const nuevoEstado = accion === 'aprobar' ? 'valido' : 'rechazado';

  await query(
    `UPDATE public.tickets
     SET estado = $1
     WHERE t.id::text = $2 OR UPPER(t.ticket_id) = UPPER($2)`,
    [nuevoEstado, id]
  ).catch(async () => {
    // Si la cláusula t.id da error de alias en el update simple
    await query(
      `UPDATE public.tickets
       SET estado = $1
       WHERE id::text = $2 OR UPPER(ticket_id) = UPPER($2)`,
      [nuevoEstado, id]
    );
  });

  logger.info(`Pago de boleto ${accion === 'aprobar' ? 'aprobado' : 'rechazado'}`, {
    ticketId: ticket.ticket_id,
    operador: user.nombre,
    nuevoEstado,
  });

  return Response.json({
    success: true,
    ticket_id: ticket.ticket_id,
    estado: nuevoEstado,
    mensaje: accion === 'aprobar'
      ? `Pago del boleto [${ticket.ticket_id}] confirmado exitosamente. Ahora es válido para acceso.`
      : `Pago del boleto [${ticket.ticket_id}] rechazado. Acceso denegado.`,
  });
}

const PATCH_H = withErrorHandler(PATCH);
export { PATCH_H as PATCH };
