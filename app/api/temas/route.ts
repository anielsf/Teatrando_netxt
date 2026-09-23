/**
 * API Route: /api/temas
 * GET: Obtener el tema estacional activo (público)
 * POST: Crear o activar un tema (solo Admin)
 * PUT: Actualizar tema existente (solo Admin)
 */
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET() {
  const rows = await query(`
    SELECT * FROM temas_estacionales WHERE activo = true LIMIT 1
  `);
  const tema = rows[0] || {
    color_primario: '#c9a24b',
    color_secundario: '#8b1a2e',
    color_acento: '#d4af37',
    color_fondo: '#0d0507',
    color_texto: '#f5e6c8',
    color_texto_suave: '#d8c9b3',
    border_radius: '6px',
    font_familia: 'Playfair Display',
  };
  return Response.json(tema);
}

async function POST(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();

  // Desactivar todos los temas primero
  if (body.activo) {
    await query('UPDATE temas_estacionales SET activo = false');
  }

  const rows = await query(
    `INSERT INTO temas_estacionales
      (nombre, descripcion, activo, fecha_inicio, fecha_fin,
       color_primario, color_secundario, color_acento, color_fondo,
       color_texto, color_texto_suave, border_radius, hero_image_url,
       hero_image_mobile_url, logo_variant_url, font_familia)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      body.nombre, body.descripcion, body.activo ?? false,
      body.fecha_inicio, body.fecha_fin,
      body.color_primario || '#c9a24b', body.color_secundario || '#8b1a2e',
      body.color_acento || '#d4af37', body.color_fondo || '#0d0507',
      body.color_texto || '#f5e6c8', body.color_texto_suave || '#d8c9b3',
      body.border_radius || '6px', body.hero_image_url,
      body.hero_image_mobile_url, body.logo_variant_url,
      body.font_familia || 'Playfair Display',
    ]
  );

  logger.info('Tema estacional creado', { nombre: body.nombre });
  return Response.json({ success: true, tema: rows[0] }, { status: 201 });
}

async function PUT(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const { id } = body;
  if (!id) return Response.json({ error: 'ID del tema requerido.' }, { status: 400 });

  if (body.activo) {
    await query('UPDATE temas_estacionales SET activo = false WHERE id != $1', [id]);
  }

  await query(
    `UPDATE temas_estacionales SET
       nombre=$1, descripcion=$2, activo=$3, fecha_inicio=$4, fecha_fin=$5,
       color_primario=$6, color_secundario=$7, color_acento=$8, color_fondo=$9,
       color_texto=$10, color_texto_suave=$11, border_radius=$12,
       hero_image_url=$13, hero_image_mobile_url=$14, logo_variant_url=$15,
       font_familia=$16, updated_at=NOW()
     WHERE id=$17`,
    [
      body.nombre, body.descripcion, body.activo ?? false,
      body.fecha_inicio, body.fecha_fin,
      body.color_primario, body.color_secundario, body.color_acento,
      body.color_fondo, body.color_texto, body.color_texto_suave,
      body.border_radius, body.hero_image_url, body.hero_image_mobile_url,
      body.logo_variant_url, body.font_familia, id,
    ]
  );

  logger.info('Tema estacional actualizado', { id, nombre: body.nombre });
  return Response.json({ success: true });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
const PUT_H  = withErrorHandler(PUT);
export { GET_H as GET, POST_H as POST, PUT_H as PUT };
