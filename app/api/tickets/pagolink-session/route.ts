/**
 * API Route: /api/tickets/pagolink-session
 * POST → Crea una sesión de checkout en PagoLink.
 *
 * IMPORTANTE:
 * - La API key solo se lee desde PAYMENT_SECRET_KEY (servidor).
 * - PagoLink admite successUrl; afterCompletion NO es válido en esta ruta.
 * - El precio de ejemplo de abajo debe sustituirse por una consulta confiable
 *   a la cartelera/base de datos antes de habilitar cobros reales.
 */
import { requireAuth } from '@/lib/auth';
import { obtenerTasaBCV } from '@/lib/tasaBcv';
import { logger } from '@/lib/logger';

type CheckoutBody = {
  id_obra?: string;
  obra?: string;
  asiento?: string;
  fecha_funcion?: string;
  nombre_cliente?: string;
  email_cliente?: string;
};

function textoSeguro(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function obtenerBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://teatrando-netxt.vercel.app';

  const url = new URL(raw);

  if (url.protocol !== 'https:') {
    throw new Error('La URL pública de Teatrando debe utilizar HTTPS.');
  }

  return url.origin;
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth();

    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    let body: CheckoutBody;

    try {
      body = await req.json();
    } catch {
      return Response.json(
        { error: 'La solicitud no contiene un JSON válido.' },
        { status: 400 }
      );
    }

    const id_obra = textoSeguro(body.id_obra, 100);
    const obra = textoSeguro(body.obra, 200);
    const asiento = textoSeguro(body.asiento, 30);
    const fecha_funcion = textoSeguro(body.fecha_funcion, 80);

    if (!id_obra || !asiento) {
      return Response.json(
        { error: 'Faltan datos obligatorios: id_obra y asiento.' },
        { status: 400 }
      );
    }

    // No se incluye una clave de prueba incrustada en el código.
    const secretKey = process.env.PAYMENT_SECRET_KEY?.trim();

    if (!secretKey) {
      logger.error('Falta PAYMENT_SECRET_KEY en las variables de entorno.');
      return Response.json(
        { error: 'La pasarela de pago no está configurada en el servidor.' },
        { status: 503 }
      );
    }

    // IMPORTANTE: valor provisional conservado del código original.
    // Sustituir por el precio real consultado desde la base de datos
    // usando id_obra; nunca aceptar el precio enviado por el navegador.
    const precioUsd = 1.00;

    if (!Number.isFinite(precioUsd) || precioUsd <= 0) {
      return Response.json(
        { error: 'El precio de la entrada no es válido.' },
        { status: 400 }
      );
    }

    // Se exige una tasa válida para que el equivalente mostrado en
    // Teatrando coincida con el que se envía a PagoLink.
    const tasa = await obtenerTasaBCV();
    const tasaBcv = Number(tasa?.tasa);

    if (!tasa?.ok || !Number.isFinite(tasaBcv) || tasaBcv <= 0) {
      logger.warn('No se pudo obtener una tasa BCV válida para PagoLink.');
      return Response.json(
        { error: 'No se pudo obtener la tasa BCV. Intenta nuevamente.' },
        { status: 503 }
      );
    }

    const baseUrl = obtenerBaseUrl();

    const successUrl = new URL('/checkout', baseUrl);
    successUrl.searchParams.set('pago_ok', '1');
    successUrl.searchParams.set('asiento', asiento);
    successUrl.searchParams.set('obra', id_obra);

    const nombre = textoSeguro(body.nombre_cliente || user.nombre, 120);
    const nombreValido =
      nombre.length >= 3 ? nombre : 'Espectador Teatrando';

    const email = textoSeguro(body.email_cliente || user.email, 200);

    const payloadPagoLink = {
      amount: precioUsd.toFixed(2),
      currency: 'USD',
      exchangeRate: String(tasaBcv),
      description: `Boleto Teatrando · ${obra || 'Obra'} · Asiento ${asiento}`,
      customer: {
        name: nombreValido,
        ...(email ? { email } : {}),
      },
      metadata: {
        id_obra,
        asiento,
        fecha_funcion,
        usuario_id: String(user.id),
        modo: 'pagolink_hosted',
      },
      // Campo admitido por POST /v1/checkout/sessions.
      // No usar afterCompletion en esta solicitud.
      successUrl: successUrl.toString(),
    };

    const res = await fetch(
      'https://api.pagolink.co/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': secretKey,
        },
        body: JSON.stringify(payloadPagoLink),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    );

    const responseText = await res.text();

    let data: Record<string, unknown> = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      logger.warn('PagoLink devolvió una respuesta que no es JSON.', {
        status: res.status,
      });
    }

    if (!res.ok) {
      logger.warn('PagoLink rechazó la creación de la sesión.', {
        status: res.status,
        providerResponse: data,
        id_obra,
        asiento,
        usuario: user.email,
      });

      return Response.json(
        {
          error:
            typeof data.message === 'string'
              ? data.message
              : 'PagoLink no pudo crear la sesión de pago.',
          code: data.code || 'PAGOLINK_SESSION_ERROR',
        },
        { status: 502 }
      );
    }

    const checkoutUrl =
      typeof data.checkoutUrl === 'string' ? data.checkoutUrl : '';

    const sessionId =
      typeof data.sessionId === 'string' ? data.sessionId : '';

    // No redirigir a una URL arbitraria devuelta por un proveedor.
    let checkoutHostValid = false;

    try {
      const parsedCheckoutUrl = new URL(checkoutUrl);
      checkoutHostValid =
        parsedCheckoutUrl.protocol === 'https:' &&
        parsedCheckoutUrl.hostname === 'pay.pagolink.co';
    } catch {
      checkoutHostValid = false;
    }

    if (!sessionId || !checkoutHostValid) {
      logger.error('PagoLink respondió sin sessionId o checkoutUrl válida.', {
        status: res.status,
        sessionIdPresent: Boolean(sessionId),
        checkoutUrlPresent: Boolean(checkoutUrl),
      });

      return Response.json(
        { error: 'PagoLink devolvió una sesión incompleta o una URL inválida.' },
        { status: 502 }
      );
    }

    logger.info('Sesión PagoLink hosted creada.', {
      sessionId,
      id_obra,
      asiento,
      usuario: user.email,
    });

    return Response.json({
      ok: true,
      sessionId,
      checkoutUrl,
      expiresAt: data.expiresAt || null,
      environment: data.environment || null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error desconocido';

    logger.error('Error creando sesión PagoLink hosted.', { message });

    return Response.json(
      { error: 'No se pudo crear la sesión de pago. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}
