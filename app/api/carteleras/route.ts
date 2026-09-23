/**
 * API Route: /api/carteleras
 * GET: Carteleras públicas (visibles=true) — con críticas, comentarios y likes
 * POST: Crear/actualizar cartelera — solo Admin
 * DELETE: Eliminar cartelera — solo Admin
 */
import { query } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET(req: Request) {
  const url = new URL(req.url);
  const adminView = url.searchParams.get('admin') === 'true';

  // Si es vista admin, requerir autenticación
  if (adminView) {
    const authResult = await requireAdmin();
    if (authResult instanceof Response) return authResult;
  }

  const visibleFilter = adminView ? '' : 'WHERE c.visible = true';

  const rows = await query(`
    SELECT
      c.*,
      t.nombre         AS "teatroNombre",
      t.ubicacion      AS "teatroUbicacion",
      t.aforo          AS "teatroAforo",
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id',          i.id,
          'nombre_autor', i.nombre_autor,
          'rol_autor',   i.rol_autor,
          'texto',       i.valor,
          'estrellas',   i.estrellas,
          'esDestacada', i.es_destacada,
          'fecha',       i.fecha_registro
        )) FILTER (WHERE i.id IS NOT NULL AND i.tipo = 'critica'), '[]'
      ) AS criticas,
      COALESCE(
        json_agg(DISTINCT jsonb_build_object(
          'id',          cm.id,
          'nombre_autor', cm.nombre_autor,
          'texto',       cm.valor,
          'fecha',       cm.fecha_registro
        )) FILTER (WHERE cm.id IS NOT NULL AND cm.tipo = 'comentario'), '[]'
      ) AS comentarios,
      COUNT(DISTINCT lk.id) FILTER (WHERE lk.tipo = 'like') AS likes
    FROM carteleras c
    LEFT JOIN teatros t ON c.id_teatro = t.id
    LEFT JOIN interacciones i  ON i.id_obra = c.id
    LEFT JOIN interacciones cm ON cm.id_obra = c.id
    LEFT JOIN interacciones lk ON lk.id_obra = c.id
    ${visibleFilter}
    GROUP BY c.id, t.nombre, t.ubicacion, t.aforo
    ORDER BY c.fecha ASC, c.hora ASC
  `);

  return Response.json(rows);
}

async function POST(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const {
    id, id_teatro, obra, funcion, genero, sala, director,
    fecha, hora, precioUSD, sinopsis, reparto, imagen,
    duracionMin, edadMinima, visible,
  } = body;

  if (!obra || !funcion) {
    return Response.json({ error: 'Obra y función son requeridos.' }, { status: 400 });
  }

  if (id) {
    // Actualizar cartelera existente
    await query(
      `UPDATE carteleras SET
        id_teatro=$1, obra=$2, funcion=$3, genero=$4, sala=$5, director=$6,
        fecha=$7, hora=$8, precio_usd=$9, sinopsis=$10, reparto=$11, imagen=$12,
        duracion_min=$13, edad_minima=$14, visible=$15
       WHERE id=$16`,
      [
        id_teatro || 1, obra, funcion, genero, sala, director,
        fecha, hora, precioUSD, sinopsis, reparto, imagen,
        duracionMin || 90, edadMinima || 'Todo público',
        visible !== undefined ? visible : true, id,
      ]
    );
    logger.info('Cartelera actualizada', { id, obra });
    return Response.json({ success: true, id });
  } else {
    // Crear nueva cartelera
    const newId = `TRD-${Date.now()}`;
    await query(
      `INSERT INTO carteleras
        (id, id_teatro, obra, funcion, genero, sala, director, fecha, hora,
         precio_usd, sinopsis, reparto, imagen, duracion_min, edad_minima, visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        newId, id_teatro || 1, obra, funcion, genero, sala, director,
        fecha, hora, precioUSD, sinopsis, reparto, imagen,
        duracionMin || 90, edadMinima || 'Todo público',
        visible !== undefined ? visible : true,
      ]
    );
    logger.info('Cartelera creada', { id: newId, obra });
    return Response.json({ success: true, id: newId }, { status: 201 });
  }
}

async function DELETE(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'ID de cartelera requerido.' }, { status: 400 });
  }

  await query('DELETE FROM carteleras WHERE id=$1', [id]);
  logger.info('Cartelera eliminada', { id });
  return Response.json({ success: true });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
const DELETE_H = withErrorHandler(DELETE);
export { GET_H as GET, POST_H as POST, DELETE_H as DELETE };
