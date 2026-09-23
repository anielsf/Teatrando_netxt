/**
 * API Route: /api/tasa-bcv
 * GET: Tasa oficial del BCV en tiempo real con fallback
 * Cache: 30 minutos (stale-while-revalidate)
 */
import { withErrorHandler, logger } from '@/lib/logger';

const BCV_FALLBACK = 798.33;

async function GET() {
  try {
    const response = await fetch('https://www.bcv.org.ve/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      next: { revalidate: 1800 }, // Cache de Next.js: 30 minutos
    });

    if (response.ok) {
      const html = await response.text();
      const pos = html.indexOf('id="dolar"');
      if (pos !== -1) {
        const fragment = html.substring(pos, pos + 600);
        const match = fragment.match(/class=["']strong-tb["']>\s*([\d.,]+)\s*<\/strong>/i);
        if (match?.[1]) {
          const cleaned = match[1].trim().replace(/\./g, '').replace(',', '.');
          const tasa = parseFloat(cleaned);
          if (!isNaN(tasa) && tasa > 0) {
            return new Response(
              JSON.stringify({ tasa: parseFloat(tasa.toFixed(2)), fuente: 'bcv.org.ve', success: true, timestamp: new Date().toISOString() }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
                },
              }
            );
          }
        }
      }
    }
  } catch (err) {
    logger.warn('BCV no disponible, usando fallback', { error: (err as Error).message });
  }

  // Fallback seguro
  return Response.json({
    tasa: BCV_FALLBACK,
    fuente: 'fallback_oficial',
    success: true,
    timestamp: new Date().toISOString(),
  }, {
    headers: { 'Cache-Control': 's-maxage=300' },
  });
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };
