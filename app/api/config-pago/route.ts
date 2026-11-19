/**
 * API Route: /api/config-pago
 * GET  → Devuelve la configuración actual del modo de pago (público, sin auth)
 * POST → Cambia el modo de pago (solo Admin)
 *
 * Modos disponibles:
 *  - 'pagolink_hosted'  → Redirige al checkout oficial de PagoLink (URL externa)
 *  - 'c2p_directo'      → Formulario nativo embebido en la web de Teatrando
 */
import { requireAdmin } from '@/lib/auth';
import { withErrorHandler, logger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';

export type ModoPago = 'pagolink_hosted' | 'c2p_directo';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'config-pago.json');

const DEFAULT_CONFIG = {
  modo: 'c2p_directo' as ModoPago,
  descripcion: 'Formulario de pago directo en la web',
  actualizado_en: new Date().toISOString(),
  actualizado_por: 'sistema',
};

async function leerConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Si no existe el archivo, retorna configuración por defecto
    return DEFAULT_CONFIG;
  }
}

async function escribirConfig(data: object) {
  try {
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Error escribiendo config-pago.json', { err });
    throw err;
  }
}

async function GET() {
  const config = await leerConfig();
  return Response.json(config);
}

async function POST(req: Request) {
  const authResult = await requireAdmin();
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;
  const body = await req.json();
  const { modo } = body as { modo: ModoPago };

  if (!['pagolink_hosted', 'c2p_directo'].includes(modo)) {
    return Response.json(
      { error: 'Modo de pago no válido. Usa "pagolink_hosted" o "c2p_directo".' },
      { status: 400 }
    );
  }

  const descripcion =
    modo === 'pagolink_hosted'
      ? 'Pago a través del checkout oficial de PagoLink (Pago Móvil, C2P, Binance Pay, Transferencia)'
      : 'Formulario de pago directo integrado en la web de Teatrando (C2P / Débito Inmediato)';

  const config = {
    modo,
    descripcion,
    actualizado_en: new Date().toISOString(),
    actualizado_por: user.nombre,
  };

  await escribirConfig(config);

  logger.info('Modo de pago cambiado por administrador', {
    modo,
    admin: user.nombre,
  });

  return Response.json({ ok: true, config });
}

export const GET_ = withErrorHandler(GET);
export const POST_ = withErrorHandler(POST);
export { GET, POST };
