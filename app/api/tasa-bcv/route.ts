/**
 * API Route: /api/tasa-bcv
 * Expone la tasa oficial del BCV (lógica en lib/tasaBcv.ts).
 */
import { withErrorHandler } from '@/lib/logger';
import { obtenerTasaBCV, MENSAJE_TASA_NO_DISPONIBLE } from '@/lib/tasaBcv';

// En Next 14 evita que el GET se prerenderice en el build y quede congelado.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

async function GET() {
  const r = await obtenerTasaBCV();

  if (!r.ok) {
    return Response.json(
      {
        success: false,
        tasa: null,
        error: MENSAJE_TASA_NO_DISPONIBLE,
        detalle: r.error,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    {
      success: true,
      tasa: Number(r.tasa.toFixed(4)),
      fuente: r.fuente,
      fecha: r.fecha ?? null,
      cached: r.cached,
      stale: r.stale,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': r.stale ? 'no-store' : 's-maxage=900, stale-while-revalidate=1800',
      },
    },
  );
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };