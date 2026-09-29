/**
 * API Route: /api/tasa-bcv
 *
 * Tasa oficial USD/VES del BCV.
 * 1) Portal oficial (bcv.org.ve) vía módulo https de Node, con reintentos.
 * 2) Espejo JSON como respaldo.
 * 3) Sin valor fijo: si nada se puede verificar, responde 503.
 *
 * Cambios clave respecto a la versión anterior:
 *  - `dynamic = 'force-dynamic'`: en Next 14 un GET sin uso de `request` puede
 *    prerenderizarse en el build y quedar congelado con la tasa del deploy.
 *  - El certificado de bcv.org.ve suele fallar la verificación en Node
 *    (cadena incompleta). Se relaja SOLO para ese host, con validación de rango.
 *  - Timeout más largo + reintento (el portal del BCV es lento desde fuera).
 *  - Lee la "fecha valor" de la página y se valida contra la tasa anterior.
 */
import https from 'node:https';
import { withErrorHandler, logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_VARIACION = 0.25; // rechaza saltos >25% respecto a la última tasa verificada

const BCV_URLS = [
  'https://www.bcv.org.ve/',
  'https://www.bcv.org.ve/estadisticas/tipo-de-cambio',
];
const MIRROR_URL = 'https://rates.dolarvzla.com/bcv/current.json';

type Cache = { valor: number; timestamp: number; fuente: string; fecha?: string };
let cache: Cache | null = null;

// Agente que NO verifica el certificado; se usa únicamente para bcv.org.ve.
const bcvAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

function getTexto(url: string, timeoutMs = 12000, redirecciones = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const esBCV = u.hostname.endsWith('bcv.org.ve');

    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'GET',
        agent: esBCV ? bcvAgent : undefined,
        timeout: timeoutMs,
        headers: {
          Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9',
          'Cache-Control': 'no-cache',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;

        if (status >= 300 && status < 400 && res.headers.location && redirecciones > 0) {
          res.resume();
          const siguiente = new URL(res.headers.location, url).toString();
          resolve(getTexto(siguiente, timeoutMs, redirecciones - 1));
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status} en ${u.hostname}`));
          return;
        }

        const partes: Buffer[] = [];
        res.on('data', (c: Buffer) => partes.push(c));
        res.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
        res.on('error', reject);
      },
    );

    req.on('timeout', () => req.destroy(new Error(`Timeout ${timeoutMs}ms en ${u.hostname}`)));
    req.on('error', reject);
    req.end();
  });
}

async function getTextoConReintento(url: string, intentos = 2): Promise<string> {
  let ultimo: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await getTexto(url);
    } catch (e) {
      ultimo = e;
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error(String(ultimo));
}

/** "39,18130000" -> 39.1813 | "1.234,5678" -> 1234.5678 */
function parseNumeroVenezolano(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, '');
  if (!limpio) return null;
  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extraerDolarBCV(html: string): number | null {
  // Bloque <div id="dolar"> ... <strong> 39,18130000 </strong>
  // (el <strong> puede o no llevar clase, y suele traer espacios/saltos de línea).
  const m = html.match(
    /id=["']dolar["'][\s\S]{0,4000}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i,
  );
  if (!m?.[1]) return null;
  const n = parseNumeroVenezolano(m[1]);
  return n && n < 10_000_000 ? n : null;
}

function extraerFechaValor(html: string): string | undefined {
  // <span class="date-display-single" content="2024-10-22T00:00:00-04:00">
  const m = html.match(/date-display-single["'][^>]*content=["'](\d{4}-\d{2}-\d{2})/i);
  return m?.[1];
}

function variacionSospechosa(nueva: number): boolean {
  if (!cache) return false;
  return Math.abs(nueva - cache.valor) / cache.valor > MAX_VARIACION;
}

function guardar(valor: number, fuente: string, fecha?: string) {
  cache = { valor, timestamp: Date.now(), fuente, fecha };
  return { tasa: valor, fuente, fecha, cached: false as const };
}

async function obtenerTasaBCV(): Promise<{
  tasa: number | null;
  fuente?: string | null;
  fecha?: string;
  cached?: boolean;
  stale?: boolean;
  error?: string;
}> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return { tasa: cache.valor, fuente: cache.fuente, fecha: cache.fecha, cached: true };
  }

  const errores: string[] = [];

  // 1) Portal oficial
  for (const url of BCV_URLS) {
    try {
      const html = await getTextoConReintento(url);
      const tasa = extraerDolarBCV(html);
      if (!tasa) {
        errores.push(`Sin valor USD en ${url}`);
        continue;
      }
      if (variacionSospechosa(tasa)) {
        errores.push(`Valor sospechoso ${tasa} (última verificada ${cache?.valor})`);
        continue;
      }
      return guardar(tasa, 'bcv.org.ve', extraerFechaValor(html));
    } catch (e: any) {
      const causa = e?.code || e?.cause?.code || '';
      errores.push(`${url}: ${causa} ${e?.message || e}`.trim());
      logger.warn('No se pudo consultar BCV directamente', {
        url,
        code: causa,
        error: e?.message || String(e),
      });
    }
  }

  // 2) Espejo (comprobar el esquema real del JSON antes de confiar en él)
  try {
    const data = JSON.parse(await getTextoConReintento(MIRROR_URL, 1));
    const tasa = Number(data?.usd);
    const fecha = typeof data?.date === 'string' ? data.date : undefined;
    if (Number.isFinite(tasa) && tasa > 0 && tasa < 10_000_000 && !variacionSospechosa(tasa)) {
      return guardar(tasa, 'rates.dolarvzla.com (datos BCV)', fecha);
    }
    errores.push('El espejo no devolvió una tasa USD válida');
  } catch (e: any) {
    errores.push(`espejo: ${e?.message || e}`);
  }

  // 3) Última tasa verificada en esta instancia (marcada como desactualizada)
  if (cache) {
    return {
      tasa: cache.valor,
      fuente: `${cache.fuente} (última tasa verificada)`,
      fecha: cache.fecha,
      cached: true,
      stale: true,
    };
  }

  const detalle = errores.join(' | ');
  logger.warn('No fue posible verificar la tasa BCV', { detalle });
  return { tasa: null, error: detalle || 'Fuentes BCV no disponibles' };
}

async function GET() {
  const r = await obtenerTasaBCV();

  if (!r.tasa) {
    return Response.json(
      {
        success: false,
        tasa: null,
        error: 'No fue posible verificar la tasa oficial del BCV en este momento.',
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
      cached: r.cached ?? false,
      stale: r.stale ?? false,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        // Si es stale no dejamos que el CDN la fije durante 15 min.
        'Cache-Control': r.stale ? 'no-store' : 's-maxage=900, stale-while-revalidate=1800',
      },
    },
  );
}

const GET_H = withErrorHandler(GET);
export { GET_H as GET };