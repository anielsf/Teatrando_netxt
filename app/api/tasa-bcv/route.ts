/**
 * API Route: /api/tasa-bcv
 *
 * Obtiene la tasa oficial USD/VES publicada por el BCV.
 * 1) Intenta el portal oficial directamente.
 * 2) Si el portal bloquea la petición del servidor, usa un espejo que
 *    documenta que sus datos provienen del BCV.
 *
 * Importante: no existe un valor fijo de respaldo. Si no se puede verificar
 * una tasa, la API devuelve 503 en vez de mostrar una tasa vieja como si fuera
 * la actual.
 */
import { withErrorHandler, logger } from '@/lib/logger';

const CACHE_TASA_TTL_MS = 15 * 60 * 1000;
const BCV_URLS = [
  'https://www.bcv.org.ve/',
  'https://www.bcv.org.ve/estadisticas/tipo-de-cambio',
];
const MIRROR_URL = 'https://rates.dolarvzla.com/bcv/current.json';

let cacheTasa: {
  valor: number;
  timestamp: number;
  fuente: string;
  fecha?: string;
} | null = null;

function parseNumeroVenezolano(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, '');
  if (!limpio) return null;

  // El BCV publica normalmente 853,50 o 1.234,5678.
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;

  const numero = Number(normalizado);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

function extraerDolarBCV(html: string): number | null {
  // Estructura habitual: bloque #dolar con un <strong class="strong-tb">.
  const patrones = [
    /id=["']dolar["'][\s\S]{0,15000}?<strong[^>]*class=["'][^"']*strong-tb[^"']*["'][^>]*>\s*([\d.,]+)\s*<\/strong>/i,
    /id=["']dolar["'][\s\S]{0,15000}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i,
  ];

  for (const patron of patrones) {
    const match = html.match(patron);
    if (match?.[1]) {
      const tasa = parseNumeroVenezolano(match[1]);
      if (tasa && tasa < 10_000_000) return tasa;
    }
  }

  return null;
}

async function fetchConTimeout(
  url: string,
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function obtenerTasaBCV() {
  const ahora = Date.now();

  if (
    cacheTasa &&
    ahora - cacheTasa.timestamp < CACHE_TASA_TTL_MS &&
    Number.isFinite(cacheTasa.valor) &&
    cacheTasa.valor > 0
  ) {
    return {
      tasa: cacheTasa.valor,
      fuente: cacheTasa.fuente,
      fecha: cacheTasa.fecha,
      cached: true,
    };
  }

  let ultimoError = '';

  // Fuente primaria: portal oficial del BCV.
  for (const url of BCV_URLS) {
    try {
      const respuesta = await fetchConTimeout(url);

      if (!respuesta.ok) {
        ultimoError = `BCV HTTP ${respuesta.status}`;
        continue;
      }

      const html = await respuesta.text();
      const tasa = extraerDolarBCV(html);

      if (tasa) {
        cacheTasa = {
          valor: tasa,
          timestamp: Date.now(),
          fuente: 'bcv.org.ve',
        };

        return {
          tasa,
          fuente: 'bcv.org.ve',
          cached: false,
        };
      }

      ultimoError = 'No se encontró el valor del dólar en el HTML del BCV';
    } catch (error: any) {
      ultimoError = error?.message || String(error);
      logger.warn('No se pudo consultar BCV directamente', {
        url,
        error: ultimoError,
      });
    }
  }

  // Respaldo: espejo que publica archivos JSON de tasas atribuidas al BCV.
  try {
    const respuesta = await fetchConTimeout(MIRROR_URL, 8000);

    if (respuesta.ok) {
      const data = await respuesta.json();
      const tasa = Number(data?.usd);
      const fecha = typeof data?.date === 'string' ? data.date : undefined;

      if (Number.isFinite(tasa) && tasa > 0 && tasa < 10_000_000) {
        cacheTasa = {
          valor: tasa,
          timestamp: Date.now(),
          fuente: 'rates.dolarvzla.com (datos BCV)',
          fecha,
        };

        return {
          tasa,
          fuente: 'rates.dolarvzla.com (datos BCV)',
          fecha,
          cached: false,
        };
      }

      ultimoError = 'El respaldo no devolvió una tasa USD válida';
    } else {
      ultimoError = `Respaldo BCV HTTP ${respuesta.status}`;
    }
  } catch (error: any) {
    ultimoError = error?.message || String(error);
  }

  // Si ya hubo una tasa verificada durante la vida del proceso, es preferible
  // informar que está temporalmente desactualizada antes que inventar una.
  if (cacheTasa && cacheTasa.valor > 0) {
    return {
      tasa: cacheTasa.valor,
      fuente: `${cacheTasa.fuente} (última tasa verificada)`,
      fecha: cacheTasa.fecha,
      cached: true,
      stale: true,
    };
  }

  logger.warn('No fue posible verificar la tasa BCV', { error: ultimoError });

  return {
    tasa: null,
    fuente: null,
    error: ultimoError || 'Fuentes BCV no disponibles',
  };
}

async function GET() {
  const resultado = await obtenerTasaBCV();

  if (!resultado.tasa) {
    return Response.json(
      {
        success: false,
        tasa: null,
        error: 'No fue posible verificar la tasa oficial del BCV en este momento.',
        detalle: resultado.error,
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  return Response.json(
    {
      success: true,
      tasa: Number(resultado.tasa.toFixed(4)),
      fuente: resultado.fuente,
      fecha: resultado.fecha ?? null,
      cached: resultado.cached ?? false,
      stale: resultado.stale ?? false,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 's-maxage=900, stale-while-revalidate=1800',
      },
    },
  );
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };
