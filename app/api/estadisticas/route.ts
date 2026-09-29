/**
 * API Route: /api/estadisticas
 * GET: Obtiene las estadísticas del teatro (semanas históricas, métricas por género, compras y críticas por Grupo TH)
 * POST: Permite al Admin registrar o actualizar datos de semanas pasadas (Semana 1, Semana 2, etc.)
 */
import { query } from '@/lib/db';
import { requireAdmin, getAuthUser } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

// Datos por defecto basados exactamente en la imagen de referencia del Microteatral Caracas
const DATOS_DEFECTO_SEMANA_2 = {
  semana_numero: 2,
  titulo_evento: 'Microteatral Caracas (Semanas 1 y 2)',
  salas_activas: 22,
  capacidad_semanal: 14000,
  entradas_semana: 2707,
  crecimiento_porcentaje: '+8.45%',
  valoracion_critica: 4.94,
  entradas_por_dia: [
    { dia: 'Miér', promo: '3×1', cantidad: 740 },
    { dia: 'Jue', promo: '2×1', cantidad: 450 },
    { dia: 'Vie', promo: '2×1', cantidad: 550 },
    { dia: 'Sáb', promo: 'T.Plana', cantidad: 493 },
    { dia: 'Dom', promo: '2×1', cantidad: 474 },
  ],
  top_salas: [
    { sala: 'Sala 7', asistencia: 515 },
    { sala: 'Sala 19', asistencia: 420 },
    { sala: 'Sala 21', asistencia: 415 },
    { sala: 'Sala 6', asistencia: 390 },
    { sala: 'Sala 15', asistencia: 370 },
    { sala: 'Sala 9', asistencia: 310 },
  ],
  generos_comparativa: {
    comedia_s1: 2150,
    drama_s1: 380,
    otros_s1: 50,
    comedia_s2: 2400,
    drama_s2: 295,
    otros_s2: 60,
  },
  nota_salas: 'Sala 7 lidera con 515 espectadores en la segunda semana.',
  nota_generos: 'Drama cayó un 22.25% en la segunda semana, mientras Comedia mantiene el 64% de la cartelera (14 de 22 salas).',
};

async function GET(req: Request) {
  const url = new URL(req.url);
  const grupo = url.searchParams.get('grupo');
  const user = await getAuthUser();

  // 1. Obtener datos históricos de semanas pasadas
  let semanasHistoricas: any[] = [];
  try {
    const rows = await query(`
      SELECT * FROM public.estadisticas_semanales
      ORDER BY semana_numero DESC
    `);
    semanasHistoricas = rows.length > 0 ? rows : [DATOS_DEFECTO_SEMANA_2];
  } catch (err) {
    // Si la tabla aún no fue migrada en la BD viva, usar datos por defecto
    semanasHistoricas = [DATOS_DEFECTO_SEMANA_2];
  }

  // 2. Métricas dinámicas.
  // Las semanas históricas son públicas, pero las métricas que contienen
  // ventas, críticas y datos de clientes no deben exponerse a visitantes.
  let metricasGrupo: any = null;
  const puedeVerMetricas = user?.rol === 'Admin' || user?.rol === 'Grupo th';

  if (puedeVerMetricas) {
    // Grupo TH solo puede consultar sus propios datos. Admin puede usar
    // ?grupo= para filtrar o dejarlo vacío para ver el consolidado general.
    const filtroGrupo =
      user?.rol === 'Grupo th'
        ? user.nombre
        : grupo || null;

    try {
      const whereGrupo = filtroGrupo ? 'WHERE c.grupo_teatral = $1' : '';
      const params = filtroGrupo ? [filtroGrupo] : [];

      // Ventas agrupadas por género
      const ventasPorGenero = await query(`
        SELECT
          COALESCE(c.genero, 'Otros') AS genero,
          COUNT(t.id) AS total_boletos,
          COALESCE(SUM(t.precio_usd), 0) AS total_usd,
          COALESCE(SUM(t.precio_ves), 0) AS total_ves
        FROM public.carteleras c
        LEFT JOIN public.tickets t ON t.id_obra = c.id
        ${whereGrupo}
        GROUP BY c.genero
        ORDER BY total_usd DESC
      `, params);

      // Críticas recibidas y promedio de estrellas
      const criticasPorObra = await query(`
        SELECT
          c.id,
          c.obra,
          c.grupo_teatral,
          COALESCE(AVG(i.estrellas), 5.0) AS promedio_estrellas,
          COUNT(i.id) AS total_criticas
        FROM public.carteleras c
        LEFT JOIN public.interacciones i ON i.id_obra = c.id AND i.tipo = 'critica'
        ${whereGrupo}
        GROUP BY c.id, c.obra, c.grupo_teatral
        ORDER BY promedio_estrellas DESC
      `, params);

      // Desglose de compras: solo disponible dentro del área administrativa.
      const comprasDetalladas = await query(`
        SELECT
          t.ticket_id,
          t.obra,
          t.asiento,
          t.fecha_funcion,
          t.precio_usd,
          t.precio_ves,
          t.ref_pago,
          t.nombre_cliente,
          t.email_cliente,
          t.created_at,
          c.grupo_teatral,
          c.genero
        FROM public.tickets t
        JOIN public.carteleras c ON t.id_obra = c.id
        ${whereGrupo ? 'WHERE c.grupo_teatral = $1' : ''}
        ORDER BY t.created_at DESC
        LIMIT 100
      `, params);

      metricasGrupo = {
        grupo: filtroGrupo || 'General',
        ventasPorGenero,
        criticasPorObra,
        comprasDetalladas,
      };
    } catch (err) {
      logger.warn('Error calculando métricas de grupo', {
        err: (err as any).message,
      });
    }
  }
  return Response.json({
    semanasHistoricas,
    semanaActual: semanasHistoricas[0] || DATOS_DEFECTO_SEMANA_2,
    metricasGrupo,
    success: true,
  });
}

async function POST(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const {
    semana_numero,
    titulo_evento,
    salas_activas,
    capacidad_semanal,
    entradas_semana,
    crecimiento_porcentaje,
    valoracion_critica,
    entradas_por_dia,
    top_salas,
    generos_comparativa,
    nota_salas,
    nota_generos,
  } = body;

  if (!semana_numero) {
    return Response.json({ error: 'El número de semana es requerido.' }, { status: 400 });
  }

  try {
    const rows = await query(
      `INSERT INTO public.estadisticas_semanales
        (semana_numero, titulo_evento, salas_activas, capacidad_semanal, entradas_semana,
         crecimiento_porcentaje, valoracion_critica, entradas_por_dia, top_salas, generos_comparativa,
         nota_salas, nota_generos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        parseInt(semana_numero, 10),
        titulo_evento || `Microteatral Caracas (Semana ${semana_numero})`,
        parseInt(salas_activas, 10) || 22,
        parseInt(capacidad_semanal, 10) || 14000,
        parseInt(entradas_semana, 10) || 0,
        crecimiento_porcentaje || '+0.00%',
        parseFloat(valoracion_critica) || 4.90,
        JSON.stringify(entradas_por_dia || []),
        JSON.stringify(top_salas || []),
        JSON.stringify(generos_comparativa || {}),
        nota_salas || '',
        nota_generos || '',
      ]
    );

    return Response.json({ success: true, semana: rows[0] }, { status: 201 });
  } catch (err: any) {
    logger.error('Error guardando estadística semanal', { err: err.message });
    return Response.json({ error: err.message }, { status: 500 });
  }
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };
