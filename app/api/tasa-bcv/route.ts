/**
 * API Route: /api/tasa-bcv
 * GET: Tasa oficial del BCV en tiempo real con scraping directo del portal oficial
 * Basado en la función oficial con reintentos y regex específico del HTML del BCV
 */
import { withErrorHandler, logger } from '@/lib/logger';

const BCV_FALLBACK = 798.33;
const CACHE_TASA_TTL_MS = 30 * 60 * 1000; // 30 minutos

// Caché en memoria del servidor
let cacheTasa: { valor: number; timestamp: number } | null = null;

async function obtenerTasaBCV() {
  const ahora = Date.now();
  if (cacheTasa && (ahora - cacheTasa.timestamp) < CACHE_TASA_TTL_MS) {
    const tasa = cacheTasa.valor;
    if (isFinite(tasa) && tasa > 0) {
      return { status: 200, tasa, cached: true, fuente: 'bcv.org.ve' };
    }
  }

  let ultimoError = '';
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const respuesta = await fetch('https://www.bcv.org.ve/', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      if (respuesta.status !== 200) {
        ultimoError = `HTTP ${respuesta.status}`;
        await new Promise((r) => setTimeout(r, 800 * intento));
        continue;
      }

      const html = await respuesta.text();
      // Regex oficial suministrado para captura exacta del HTML del BCV
      const regex =
        /id="dolar"[\s\S]*?class="col-sm-6 col-xs-6 centrado textp"[^>]*>[\s\S]*?<strong class="strong-tb">\s*([\d.,]+)\s*<\/strong>/i;
      const match = html.match(regex);

      if (!match || !match[1]) {
        ultimoError = 'Patrón HTML no encontrado';
        continue;
      }

      const tasa = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      if (!isFinite(tasa) || tasa <= 0 || tasa > 1000000) {
        ultimoError = `Tasa fuera de rango: ${tasa}`;
        continue;
      }

      cacheTasa = { valor: tasa, timestamp: ahora };
      return { status: 200, tasa, cached: false, fuente: 'bcv.org.ve' };
    } catch (e: any) {
      ultimoError = e.toString();
      await new Promise((r) => setTimeout(r, 800 * intento));
    }
  }

  logger.warn('BCV no disponible tras 3 intentos, usando fallback', { error: ultimoError });
  return { status: 500, tasa: BCV_FALLBACK, error: ultimoError, fallback: true };
}

async function GET() {
  const resultado = await obtenerTasaBCV();
  const tasaFinal = resultado.tasa && resultado.tasa > 0 ? resultado.tasa : BCV_FALLBACK;

  return Response.json(
    {
      tasa: parseFloat(tasaFinal.toFixed(2)),
      fuente: resultado.fuente || 'bcv_fallback',
      cached: resultado.cached ?? false,
      success: true,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600',
      },
    }
  );
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };
