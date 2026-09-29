/**
 * API Route: /api/interacciones
 * GET: Interacciones de una obra (público)
 * POST: Registrar like/comentario/crítica (requiere auth)
 */
import { query } from '@/lib/db';
import { requireAuth, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET(req: Request) {
  const url = new URL(req.url);
  const idObra = url.searchParams.get('id_obra');

  if (!idObra) return Response.json([]);

  const rows = await query(`
    SELECT
      id,
      id_obra   AS "idObra",
      id_usuario AS "idUsuario",
      nombre_autor AS "nombreAutor",
      rol_autor AS "rolAutor",
      tipo, valor, estrellas,
      es_destacada AS "esDestacada",
      fecha_registro AS "fechaRegistro"
    FROM interacciones
    WHERE id_obra = $1 AND tipo IN ('critica', 'comentario', 'like')
    ORDER BY es_destacada DESC, fecha_registro DESC
  `, [idObra]);

  return Response.json(rows);
}

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const idObra      = body.id_obra;
  const tipo        = body.tipo || 'like';
  const valor       = body.valor || '';
  const estrellas   = body.estrellas !== undefined ? parseInt(body.estrellas, 10) : 5;
  const nombreAutor = body.nombre_autor || user.nombre || 'Anónimo';

  if (!idObra) {
    return Response.json({ error: 'id_obra es requerido.' }, { status: 400 });
  }

  // Solo Crítico o Admin pueden marcar como destacada
  const esDestacada = user.rol === 'Crítico' || user.rol === 'Admin';

  const rows = await query(
    `INSERT INTO interacciones
      (id_obra, id_usuario, usuario_uuid, nombre_autor, rol_autor, tipo, valor, estrellas, es_destacada)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [idObra, user.id, user.id, nombreAutor, user.rol, tipo, valor, estrellas, esDestacada]
  );

  logger.info('Interacción registrada', { idObra, tipo, userId: user.id });
  return Response.json({ success: true, id: (rows[0] as any).id, esDestacada });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };
