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
    // Si no es ticket, buscar si corresponde a una Suscripción o Membresía
    const subClean = ticketId.replace(/^SUB-/, '');
    const subRows = await query<any>(
      `SELECT s.*, pl.nombre AS plan_nombre, pl.rol_otorgado,
              p.nombre AS usuario_nombre, p.email AS usuario_email, p.rol AS usuario_rol
       FROM public.suscripciones s
       LEFT JOIN public.planes pl ON pl.clave = s.plan
       LEFT JOIN public.profiles p ON p.id = s.usuario_uuid
       WHERE s.id::text = $1 
          OR UPPER(s.ref_pago) = $2
          OR UPPER(p.email) = $2
          OR s.id::text = $2
       ORDER BY s.id DESC
       LIMIT 1`,
      [subClean, ticketId]
    );

    if (subRows.length === 0) {
      logger.warn('Intento de validar identificador inexistente', { ticketId, validador: user.nombre });
      return Response.json(
        { success: false, error: `Código [${ticketId}] no encontrado como boleto ni como suscripción.` },
        { status: 404 }
      );
    }

    const sub = subRows[0];

    // a) Verificar si el pago de la suscripción está pendiente o rechazado
    if (sub.estado === 'Pendiente') {
      return Response.json({
        success: false,
        pagoPendiente: true,
        error: `⛔ MEMBRESÍA PENDIENTE: La suscripción de ${sub.usuario_nombre || 'usuario'} está PENDIENTE de verificación de pago por administración.`,
      }, { status: 403 });
    }

    if (sub.estado === 'Rechazada') {
      return Response.json({
        success: false,
        pagoRechazado: true,
        error: `❌ MEMBRESÍA RECHAZADA: La solicitud de suscripción de ${sub.usuario_nombre || 'usuario'} fue rechazada por administración.`,
      }, { status: 403 });
    }

    // b) Verificar expiración por tiempo (vigencia de 30 días o fecha_fin)
    const now = new Date();
    const fechaFin = sub.fecha_fin ? new Date(sub.fecha_fin) : null;
    const expiradaPorFecha = fechaFin ? now > fechaFin : false;

    if (expiradaPorFecha || sub.estado === 'Expirada') {
      await query(`UPDATE public.suscripciones SET estado = 'Expirada' WHERE id::text = $1`, [sub.id]).catch(() => {});
      return Response.json({
        success: false,
        yaUtilizado: true,
        mensaje: `⚠️ ¡MEMBRESÍA EXPIRADA! La suscripción al plan "${sub.plan_nombre || sub.plan}" venció el ${fechaFin ? fechaFin.toLocaleDateString('es-VE') : 'fecha límite'}.`,
        suscripcion: {
          id: `SUB-${sub.id}`,
          plan: sub.plan_nombre || sub.plan,
          usuario: sub.usuario_nombre,
          fecha_fin: sub.fecha_fin,
          estado: 'Expirada',
        }
      }, { status: 409 });
    }

    // c) Verificar entradas disponibles por canje
    const entradasDisp = sub.entradas_disponibles !== undefined && sub.entradas_disponibles !== null
      ? Number(sub.entradas_disponibles)
      : null;

    if (entradasDisp !== null && entradasDisp <= 0) {
      return Response.json({
        success: false,
        yaUtilizado: true,
        mensaje: `⚠️ ¡CANJES AGOTADOS! El suscriptor ${sub.usuario_nombre} ya utilizó todas las entradas de cortesía de su ciclo mensual.`,
        suscripcion: {
          id: `SUB-${sub.id}`,
          plan: sub.plan_nombre || sub.plan,
          usuario: sub.usuario_nombre,
          entradas_disponibles: 0,
        }
      }, { status: 409 });
    }

    // d) Canjear entrada y registrar uso
    let nuevasEntradas = entradasDisp !== null ? Math.max(0, entradasDisp - 1) : null;
    let entradasCanjeadas = Number(sub.entradas_canjeadas || 0) + 1;

    if (entradasDisp !== null) {
      await query(
        `UPDATE public.suscripciones 
         SET entradas_disponibles = $1, 
             entradas_canjeadas = $2,
             updated_at = NOW()
         WHERE id::text = $3`,
        [nuevasEntradas, entradasCanjeadas, sub.id]
      ).catch(() => {});
    }

    logger.info('Membresía validada en taquilla', {
      subId: sub.id,
      plan: sub.plan,
      usuario: sub.usuario_nombre,
      validador: user.nombre,
      nuevasEntradas,
    });

    return Response.json({
      success: true,
      esSuscripcion: true,
      mensaje: `✓ Membresía VIP validada exitosamente para ${sub.usuario_nombre}. Acceso permitido.` +
        (nuevasEntradas !== null ? ` (Entradas restantes en este ciclo: ${nuevasEntradas})` : ''),
      suscripcion: {
        id: `SUB-${sub.id}`,
        plan: sub.plan_nombre || sub.plan,
        usuario: sub.usuario_nombre,
        email: sub.usuario_email,
        fecha_fin: sub.fecha_fin,
        entradas_restantes: nuevasEntradas,
        validado_por: user.nombre,
      }
    });
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

  // 1. Verificar si el pago del boleto ya fue validado por la administración
  if (ticket.estado === 'pendiente') {
    return Response.json({
      success: false,
      pagoPendiente: true,
      error: `⛔ ACCESO DENEGADO: El pago del boleto [${ticketId}] aún no ha sido confirmado por administración (Ref: ${ticket.ref_pago || 'N/A'}). Debe ser validado antes de canjearse.`,
      ticket: {
        ticket_id: ticket.ticket_id,
        obra: ticket.obra || ticket.obra_nombre,
        asiento: ticket.asiento,
        fecha_funcion: ticket.fecha_funcion,
        nombre_cliente: ticket.nombre_cliente,
        ref_pago: ticket.ref_pago,
        estado: 'pendiente',
      },
    }, { status: 403 });
  }

  if (ticket.estado === 'rechazado') {
    return Response.json({
      success: false,
      pagoRechazado: true,
      error: `❌ BOLETO RECHAZADO: El pago del boleto [${ticketId}] fue rechazado por la administración. Acceso prohibido.`,
      ticket: {
        ticket_id: ticket.ticket_id,
        obra: ticket.obra || ticket.obra_nombre,
        asiento: ticket.asiento,
        nombre_cliente: ticket.nombre_cliente,
        estado: 'rechazado',
      },
    }, { status: 403 });
  }

  // 2. Verificar si ya fue canjeado / expirado previamente
  if (ticket.utilizado || ticket.estado === 'canjeado') {
    return Response.json({
      success: false,
      yaUtilizado: true,
      mensaje: `⚠️ ¡BOLETO EXPIRADO! Este boleto ya fue CANJEADO y expiró previamente en taquilla.`,
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
