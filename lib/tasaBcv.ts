/**
 * lib/tasaBcv.ts
 * Fuente única de la tasa oficial USD/VES del BCV para todo el servidor
 * (/api/tasa-bcv, /api/tickets, /api/suscripciones).
 *
 * - Portal oficial (bcv.org.ve) con módulo https de Node, reintentos y
 *   verificación TLS relajada SOLO para ese host.
 * - Espejo JSON como respaldo.
 * - Sin valor fijo de emergencia: si no hay tasa verificada devuelve ok:false.
 */
import https from 'node:https';
import { logger } from '@/lib/logger';

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_MAX_MS = 24 * 60 * 60 * 1000; // una tasa vieja de >24h ya no se usa
const MAX_VARIACION = 0.25;

const BCV_URLS = [
  'https://www.bcv.org.ve/',
  'https://www.bcv.org.ve/estadisticas/tipo-de-cambio',
];
const MIRROR_URL = 'https://rates.dolarvzla.com/bcv/current.json';

type Cache = { valor: number; timestamp: number; fuente: string; fecha?: string };
let cache: Cache | null = null;

const bcvAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: false });

export type ResultadoTasa =
  | { ok: true; tasa: number; fuente: string; fecha?: string; cached: boolean; stale: boolean }
  | { ok: false; error: string };

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
          resolve(getTexto(new URL(res.headers.location, url).toString(), timeoutMs, redirecciones - 1));
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

function parseNumeroVenezolano(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, '');
  if (!limpio) return null;
  const normalizado = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio;
  const n = Number(normalizado);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extraerDolarBCV(html: string): number | null {
  const m = html.match(/id=["']dolar["'][\s\S]{0,4000}?<strong[^>]*>\s*([\d.,]+)\s*<\/strong>/i);
  if (!m?.[1]) return null;
  const n = parseNumeroVenezolano(m[1]);
  return n && n < 10_000_000 ? n : null;
}

function extraerFechaValor(html: string): string | undefined {
  const m = html.match(/date-display-single["'][^>]*content=["'](\d{4}-\d{2}-\d{2})/i);
  return m?.[1];
}

function variacionSospechosa(nueva: number): boolean {
  return !!cache && Math.abs(nueva - cache.valor) / cache.valor > MAX_VARIACION;
}

function guardar(valor: number, fuente: string, fecha?: string): ResultadoTasa {
  cache = { valor, timestamp: Date.now(), fuente, fecha };
  return { ok: true, tasa: valor, fuente, fecha, cached: false, stale: false };
}

export async function obtenerTasaBCV(): Promise<ResultadoTasa> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return { ok: true, tasa: cache.valor, fuente: cache.fuente, fecha: cache.fecha, cached: true, stale: false };
  }

  const errores: string[] = [];

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

  if (cache && Date.now() - cache.timestamp < STALE_MAX_MS) {
    return {
      ok: true,
      tasa: cache.valor,
      fuente: `${cache.fuente} (última tasa verificada)`,
      fecha: cache.fecha,
      cached: true,
      stale: true,
    };
  }

  const error = errores.join(' | ') || 'Fuentes BCV no disponibles';
  logger.warn('No fue posible verificar la tasa BCV', { detalle: error });
  return { ok: false, error };
}

export const MENSAJE_TASA_NO_DISPONIBLE =
  'No fue posible verificar la tasa oficial del BCV en este momento. Intenta de nuevo en unos minutos.';