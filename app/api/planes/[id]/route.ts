/**
 * API Route: /api/planes/[id]
 * PATCH: editar un plan, incluido mostrar/ocultar con "activo" (solo Admin).
 * No hay DELETE: los planes se ocultan, porque hay usuarios y suscripciones que los referencian.
 */
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { validarPlan, PLAN_BASE } from '@/lib/planes';

export const dynamic = 'force-dynamic';

async function PATCH(req: Request, context?: Record<string, unknown>) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const id = Number((context?.params as { id?: string } | undefined)?.id);
  if (!Number.isInteger(id)) return Response.json({ error: 'ID inválido.' }, { status: 400 });

  const actual = await query(`SELECT clave, rol_otorgado FROM public.planes WHERE id = $1`, [id]);
  if (actual.length === 0) return Response.json({ error: 'Plan no encontrado.' }, { status: 404 });

  const v = validarPlan(await req.json(), true);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const d = v.datos;

  // El plan base lo asigna el trigger de registro a todo usuario nuevo.
  if (actual[0].clave === PLAN_BASE) {
    if (d.activo === false || (d.rol_otorgado && d.rol_otorgado !== 'Usuario') || (d.precio_usd && d.precio_usd > 0)) {
      return Response.json(
        { error: 'El Plan Básico debe seguir activo, gratuito y con rol Usuario.' },
        { status: 400 }
      );
    }
  }

  // Un plan que otorga Grupo th siempre exige aprobación manual.
  const rolFinal = d.rol_otorgado ?? actual[0].rol_otorgado;
  if (rolFinal === 'Grupo th') d.requiere_aprobacion = true;

  const campos = Object.keys(d);
  if (campos.length === 0) return Response.json({ error: 'Nada que actualizar.' }, { status: 400 });

  const sets = campos.map((c, i) => `${c} = $${i + 1}${c === 'beneficios' ? '::jsonb' : ''}`);
  const valores = campos.map((c) => (c === 'beneficios' ? JSON.stringify(d[c]) : d[c]));

  await query(
    `UPDATE public.planes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${campos.length + 1}`,
    [...valores, id]
  );

  logger.info('Plan actualizado', { admin: auth.user.id, id, campos });
  return Response.json({ success: true });
}

const PATCH_H = withErrorHandler(PATCH);
export { PATCH_H as PATCH };