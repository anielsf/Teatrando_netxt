/**
 * API Route: /api/carteleras
 * GET: Carteleras públicas (visibles=true) — con críticas, comentarios, likes, grupo_teatral y butacas disponibles
 * POST: Crear/actualizar cartelera — Admin o Grupo th
 * DELETE: Eliminar cartelera — Admin o Grupo th (propietario)
 */
import { query } from '@/lib/db';
import { requireAdminOrGrupoTH, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET(req: Request) {
  const url = new URL(req.url);
  const adminView = url.searchParams.get('admin') === 'true';
  const grupoFiltro = url.searchParams.get('grupo');

  const user = await getAuthUser();

  // Si es vista administrativa, requerir permisos
  if (adminView) {
    if (!user || (user.rol !== 'Admin' && user.rol !== 'Grupo th')) {
      return Response.json({ error: 'Permisos insuficientes.' }, { status: 403 });
    }
  }

  let conditions: string[] = [];
  let params: any[] = [];

  if (!adminView) {
    conditions.push('c.visible = true');
  }

  if (grupoFiltro) {
    params.push(grupoFiltro);
    conditions.push(`c.grupo_teatral = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT
      c.*,
      COALESCE(c.grupo_teatral, 'Compañía Teatral Residente') AS grupo_teatral,
      COALESCE(c.butacas_disponibles, 80) AS butacas_disponibles,
      COALESCE(c.aforo_total, 80) AS aforo_total,
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
    FROM public.carteleras c
    LEFT JOIN public.teatros t ON c.id_teatro = t.id
    LEFT JOIN public.interacciones i  ON i.id_obra = c.id
    LEFT JOIN public.interacciones cm ON cm.id_obra = c.id
    LEFT JOIN public.interacciones lk ON lk.id_obra = c.id
    ${whereClause}
    GROUP BY c.id, t.nombre, t.ubicacion, t.aforo
    ORDER BY c.fecha ASC, c.hora ASC
  `, params);

  return Response.json(rows);
}

async function POST(req: Request) {
  const authResult = await requireAdminOrGrupoTH();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const {
    id, id_teatro, obra, funcion, genero, sala, director,
    fecha, hora, precioUSD, sinopsis, reparto, imagen,
    duracionMin, edadMinima, visible,
    grupo_teatral, butacas_disponibles, aforo_total,
  } = body;

  if (!obra || !funcion) {
    return Response.json({ error: 'Obra y función son requeridos.' }, { status: 400 });
  }

  // Identificador del Grupo TH que crea/gestiona la cartelera
  const nombreGrupo = grupo_teatral || (user.rol === 'Grupo th' ? user.nombre : 'Compañía Teatral Residente');
  const aforo = parseInt(aforo_total, 10) || 80;
  const butacasDisp = butacas_disponibles !== undefined ? parseInt(butacas_disponibles, 10) : aforo;

  if (id) {
    // Si es Grupo th, verificar que sea el creador o Admin
    if (user.rol === 'Grupo th') {
      const existente = await query<any>(`SELECT id_usuario_grupo FROM public.carteleras WHERE id = $1`, [id]);
      if (existente.length > 0 && existente[0].id_usuario_grupo && existente[0].id_usuario_grupo !== user.id) {
        return Response.json({ error: 'Solo puedes editar carteleras pertenecientes a tu grupo teatral.' }, { status: 403 });
      }
    }

    // Actualizar cartelera existente en el esquema public
    await query(
      `UPDATE public.carteleras SET
        id_teatro=$1, obra=$2, funcion=$3, genero=$4, sala=$5, director=$6,
        fecha=$7, hora=$8, precio_usd=$9, sinopsis=$10, reparto=$11, imagen=$12,
        duracion_min=$13, edad_minima=$14, visible=$15,
        grupo_teatral=$16, butacas_disponibles=$17, aforo_total=$18
       WHERE id=$19`,
      [
        id_teatro || 1, obra, funcion, genero, sala, director,
        fecha, hora, precioUSD, sinopsis, reparto, imagen,
        duracionMin || 90, edadMinima || 'Todo público',
        visible !== undefined ? visible : true,
        nombreGrupo, butacasDisp, aforo, id,
      ]
    );
    logger.info('Cartelera actualizada', { id, obra, grupo: nombreGrupo, editor: user.nombre });
    return Response.json({ success: true, id, grupo_teatral: nombreGrupo });
  } else {
    // Crear nueva cartelera en el esquema public con identificador del Grupo TH
    const newId = `TRD-${Date.now()}`;
    await query(
      `INSERT INTO public.carteleras
        (id, id_teatro, obra, funcion, genero, sala, director, fecha, hora,
         precio_usd, sinopsis, reparto, imagen, duracion_min, edad_minima, visible,
         grupo_teatral, id_usuario_grupo, butacas_disponibles, aforo_total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        newId, id_teatro || 1, obra, funcion, genero, sala, director,
        fecha, hora, precioUSD, sinopsis, reparto, imagen,
        duracionMin || 90, edadMinima || 'Todo público',
        visible !== undefined ? visible : true,
        nombreGrupo, user.id, butacasDisp, aforo,
      ]
    );
    logger.info('Cartelera creada', { id: newId, obra, grupo: nombreGrupo, autor: user.nombre });
    return Response.json({ success: true, id: newId, grupo_teatral: nombreGrupo }, { status: 201 });
  }
}

async function DELETE(req: Request) {
  const authResult = await requireAdminOrGrupoTH();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'ID de cartelera requerido.' }, { status: 400 });
  }

  // Si es Grupo th, verificar que le pertenezca
  if (user.rol === 'Grupo th') {
    const existente = await query<any>(`SELECT id_usuario_grupo FROM public.carteleras WHERE id = $1`, [id]);
    if (existente.length > 0 && existente[0].id_usuario_grupo && existente[0].id_usuario_grupo !== user.id) {
      return Response.json({ error: 'Solo puedes eliminar carteleras pertenecientes a tu grupo teatral.' }, { status: 403 });
    }
  }

  await query('DELETE FROM public.carteleras WHERE id = $1', [id]);
  logger.info('Cartelera eliminada', { id, por: user.nombre });
  return Response.json({ success: true });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
const DELETE_H = withErrorHandler(DELETE);
export { GET_H as GET, POST_H as POST, DELETE_H as DELETE };
