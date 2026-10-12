/**
 * PATCH /api/suscripciones/[id] — body: { accion: 'aprobar' | 'rechazar' } (solo Admin)
 */
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { obtenerPlan, rolResultante } from '@/lib/planes';

export const dynamic = 'force-dynamic';

async function PATCH(req: Request, context?: Record<string, unknown>) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const id = String((context?.params as { id?: string } | undefined)?.id ?? '');
  const { accion } = await req.json();
  if (!id || (accion !== 'aprobar' && accion !== 'rechazar')) {
    return Response.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  const rows = await query(
    `SELECT s.plan, s.usuario_uuid, p.rol AS rol_actual
     FROM suscripciones s LEFT JOIN profiles p ON p.id = s.usuario_uuid
     WHERE s.id::text = $1 AND s.estado = 'Pendiente'`,
    [id]
  );
  if (rows.length === 0) {
    return Response.json({ error: 'Solicitud no encontrada o ya resuelta.' }, { status: 404 });
  }
  const sol = rows[0] as {
    plan: string;
    usuario_uuid: string;
    rol_actual: string | null;
  };

  if (accion === 'rechazar') {
    await query(`UPDATE suscripciones SET estado = 'Rechazada' WHERE id::text = $1`, [id]);
    logger.info('Suscripción rechazada', { admin: auth.user.id, id });
    return Response.json({ success: true });
  }

  const plan = await obtenerPlan(sol.plan);
  if (!plan) return Response.json({ error: 'El plan ya no existe.' }, { status: 404 });

  const rol = rolResultante(sol.rol_actual ?? 'Usuario', plan.rol_otorgado);

  // Vigencia de 30 días y entradas de cortesía para canje según el plan
  let entradas = 2;
  if (plan.rol_otorgado === 'Crítico') entradas = 8;
  if (plan.precio_usd >= 30) entradas = 4;

  // Actualizar suscripción con 30 días de vigencia y cupos de entrada
  await query(
    `UPDATE suscripciones 
     SET estado = 'Activa',
         fecha_inicio = NOW(),
         fecha_fin = NOW() + INTERVAL '30 days',
         entradas_totales = $1,
         entradas_disponibles = $1,
         entradas_canjeadas = 0,
         updated_at = NOW()
     WHERE id::text = $2`,
    [entradas, id]
  ).catch(async () => {
    // Si la tabla aún no tiene las columnas entradas_*
    await query(
      `UPDATE suscripciones 
       SET estado = 'Activa',
           fecha_inicio = NOW(),
           fecha_fin = NOW() + INTERVAL '30 days',
           updated_at = NOW()
       WHERE id::text = $1`,
      [id]
    ).catch(async () => {
      await query(`UPDATE suscripciones SET estado = 'Activa' WHERE id::text = $1`, [id]);
    });
  });

  // Actualizar perfil del usuario
  await query(
    `UPDATE profiles 
     SET plan_suscripcion = $1, 
         rol = $2, 
         suscripcion_expira_at = NOW() + INTERVAL '30 days',
         updated_at = NOW() 
     WHERE id = $3`,
    [plan.clave, rol, sol.usuario_uuid]
  ).catch(async () => {
    await query(
      `UPDATE profiles SET plan_suscripcion = $1, rol = $2, updated_at = NOW() WHERE id = $3`,
      [plan.clave, rol, sol.usuario_uuid]
    );
  });

  logger.info('Suscripción aprobada con vigencia de 30 días', { admin: auth.user.id, id, plan: plan.clave, rol, entradas });
  return Response.json({ success: true, rol, entradas, vigencia_dias: 30 });
}

const PATCH_H = withErrorHandler(PATCH);
export { PATCH_H as PATCH };