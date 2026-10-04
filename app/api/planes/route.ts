/**
 * API Route: /api/planes
 * GET  : planes activos (público). Con ?admin=true devuelve todos (solo Admin).
 * POST : crear plan (solo Admin).
 */
import { query } from '@/lib/db';
import { requireAdmin, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { listarPlanes, validarPlan, ROLES_PLAN } from '@/lib/planes';

export const dynamic = 'force-dynamic';

async function GET(req: Request) {
  const adminView = new URL(req.url).searchParams.get('admin') === 'true';

  if (adminView) {
    const user = await getAuthUser();
    if (!user || user.rol !== 'Admin') {
      return Response.json({ error: 'Permisos insuficientes.' }, { status: 403 });
    }
  }

  const planes = await listarPlanes(!adminView);
  return Response.json(planes, { headers: { 'Cache-Control': 'no-store' } });
}

async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof Response) return auth;

  const v = validarPlan(await req.json(), false);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const d = v.datos;

  const rol = d.rol_otorgado ?? 'Usuario';
  if (!ROLES_PLAN.includes(rol)) return Response.json({ error: 'Rol no válido.' }, { status: 400 });
  // Un plan que otorga Grupo th (permite crear/borrar carteleras) siempre pasa por aprobación.
  const requiereAprobacion = rol === 'Grupo th' ? true : (d.requiere_aprobacion ?? false);

  const clave = d.nombre; // la clave se fija al crear y no cambia aunque se renombre el plan
  const existe = await query(`SELECT 1 FROM public.planes WHERE clave = $1`, [clave]);
  if (existe.length > 0) {
    return Response.json({ error: 'Ya existe un plan con ese nombre.' }, { status: 409 });
  }

  const rows = await query(
    `INSERT INTO public.planes
       (clave, nombre, descripcion, precio_usd, rol_otorgado, beneficios, badge,
        destacado, requiere_aprobacion, activo, orden)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
     RETURNING id, clave`,
    [
      clave, d.nombre, d.descripcion ?? '', d.precio_usd ?? 0, rol,
      JSON.stringify(d.beneficios ?? []), d.badge ?? '',
      d.destacado ?? false, requiereAprobacion, d.activo ?? true, d.orden ?? 99,
    ]
  );

  logger.info('Plan creado', { admin: auth.user.id, clave });
  return Response.json({ success: true, ...rows[0] }, { status: 201 });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };