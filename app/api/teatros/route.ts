/**
 * API Route: /api/teatros
 * GET: Info del teatro + estadísticas (público)
 * POST: Actualizar datos del teatro (solo Admin)
 */
import { query } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';

async function GET(req: Request) {
  const url = new URL(req.url);
  const idTeatro = parseInt(url.searchParams.get('id') || '1', 10) || 1;

  const teatroRows = await query(
    'SELECT * FROM teatros WHERE id = $1',
    [idTeatro]
  );
  const teatro = teatroRows[0] || {
    id: 1,
    nombre: 'Teatro Municipal de Caracas',
    ubicacion: 'Av. Lecuna, Centro de Caracas',
    aforo: 650,
  };

  const [statsRows, ticketStats, criticaStats] = await Promise.all([
    query('SELECT * FROM estadisticas_teatro WHERE id_teatro = $1 LIMIT 1', [teatro.id]),
    query(`SELECT COUNT(*) AS "totalTickets", SUM(precio_usd) AS "totalRecaudado" FROM tickets WHERE id_teatro = $1`, [teatro.id]),
    query(`SELECT AVG(estrellas) AS promedio, COUNT(*) AS "totalCriticas" FROM interacciones WHERE tipo = 'critica'`),
  ]);

  const stats = statsRows[0] || {};
  const tStats = ticketStats[0] as any || {};
  const cStats = criticaStats[0] as any || {};

  return Response.json({
    teatro,
    estadisticas: {
      totalFunciones:     parseInt(stats.total_funciones as string, 10) || 24,
      butacasVendidas:    (parseInt(stats.butacas_vendidas as string, 10) || 5280) + (parseInt(tStats.totalTickets, 10) || 0),
      porcentajeOcupacion: parseFloat(stats.porcentaje_ocupacion as string) || 91.25,
      calificacionCriticos: Math.round((parseFloat(cStats.promedio) || 4.94) * 100) / 100,
      totalCriticasOficiales: parseInt(cStats.totalCriticas, 10) || 0,
      obraMasVista:       stats.obra_mas_vista || 'Hamlet',
      totalRecaudadoUSD:  parseFloat(tStats.totalRecaudado) || 0,
    },
  });
}

async function POST(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const body = await req.json();
  const idTeatro = parseInt(body.id, 10) || 1;

  await query(
    `UPDATE teatros SET aforo=$1, historia=$2, servicios=$3, normas=$4, telefono=$5, imagen=$6 WHERE id=$7`,
    [
      parseInt(body.aforo, 10) || 650,
      body.historia || '',
      body.servicios || '',
      body.normas || '',
      body.telefono || '',
      body.imagen || '',
      idTeatro,
    ]
  );

  logger.info('Teatro actualizado', { idTeatro });
  return Response.json({ success: true });
}

const GET_H = withErrorHandler(GET);
const POST_H = withErrorHandler(POST);
export { GET_H as GET, POST_H as POST };
