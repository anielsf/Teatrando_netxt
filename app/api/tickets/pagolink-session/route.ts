/**
 * API Route: /api/tickets/pagolink-session
 * POST → Crea una sesión de checkout en PagoLink.
 * El precio se obtiene desde public.carteleras.precio_usd.
 * Nunca se acepta el importe enviado por el navegador.
 */
import { requireAuth } from '@/lib/auth';
import { obtenerTasaBCV } from '@/lib/tasaBcv';
import { logger } from '@/lib/logger';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

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
    if (authResult instanceof Response) return authResult;
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

    const secretKey = process.env.PAYMENT_SECRET_KEY?.trim();
    if (!secretKey) {
      logger.error('Falta PAYMENT_SECRET_KEY en las variables de entorno.');
      return Response.json(
        { error: 'La pasarela de pago no está configurada en el servidor.' },
        { status: 503 }
      );
    }

    // Consultar precio autoritativo en Supabase.
    // Esquema conocido: public.carteleras.id y precio_usd.
    const supabase = createSupabaseAdminClient();
    const { data: obraDB, error: errorObra } = await supabase
      .from('carteleras')
      .select('id, titulo, precio_usd')
      .eq('id', id_obra)
      .maybeSingle();

    if (errorObra) {
      logger.error('Error consultando precio de cartelera.', {
        message: errorObra.message,
        code: errorObra.code,
        id_obra,
      });
      return Response.json(
        { error: 'No se pudo consultar el precio de la obra.' },
        { status: 500 }
      );
    }

    if (!obraDB) {
      return Response.json(
        { error: 'No se encontró la obra seleccionada en la cartelera.' },
        { status: 404 }
      );
    }

    const precioUsd = Number(obraDB.precio_usd);
    if (!Number.isFinite(precioUsd) || precioUsd <= 0) {
      logger.warn('La obra no tiene un precio_usd válido.', {
        id_obra,
        precio_usd: obraDB.precio_usd,
      });
      return Response.json(
        { error: 'La obra no tiene un precio válido en dólares.' },
        { status: 400 }
      );
    }

    const tasa = await obtenerTasaBCV();
    if (!tasa.ok) {
      logger.warn('No se pudo obtener la tasa BCV para PagoLink.', {
        error: tasa.error,
      });
      return Response.json(
        { error: 'No se pudo obtener la tasa BCV. Intenta nuevamente.' },
        { status: 503 }
      );
    }

    const tasaBcv = Number(tasa.tasa);
    if (!Number.isFinite(tasaBcv) || tasaBcv <= 0) {
      logger.warn('La tasa BCV recibida no es válida para PagoLink.');
      return Response.json(
        { error: 'La tasa BCV recibida no es válida. Intenta nuevamente.' },
        { status: 503 }
      );
    }

    const baseUrl = obtenerBaseUrl();
    const successUrl = new URL('/checkout', baseUrl);
    successUrl.searchParams.set('pago_ok', '1');
    successUrl.searchParams.set('asiento', asiento);
    successUrl.searchParams.set('obra', id_obra);

    const nombre = textoSeguro(body.nombre_cliente || user.nombre, 120);
    const nombreValido = nombre.length >= 3 ? nombre : 'Espectador Teatrando';
    const email = textoSeguro(body.email_cliente || user.email, 200);
    const nombreObra = textoSeguro(obraDB.titulo || obra, 200) || 'Obra';

    const payloadPagoLink = {
      amount: precioUsd.toFixed(2),
      currency: 'USD',
      exchangeRate: String(tasaBcv),
      description: `Boleto Teatrando · ${nombreObra} · Asiento ${asiento}`,
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
        precio_usd: precioUsd.toFixed(2),
      },
      successUrl: successUrl.toString(),
    };

    const res = await fetch('https://api.pagolink.co/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretKey,
      },
      body: JSON.stringify(payloadPagoLink),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

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
          error: typeof data.message === 'string'
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
      precioUsd,
      usuario: user.email,
    });

    return Response.json({
      ok: true,
      sessionId,
      checkoutUrl,
      amount: precioUsd.toFixed(2),
      currency: 'USD',
      expiresAt: data.expiresAt || null,
      environment: data.environment || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    logger.error('Error creando sesión PagoLink hosted.', { message });
    return Response.json(
      { error: 'No se pudo crear la sesión de pago. Intenta nuevamente.' },
      { status: 500 }
    );
  }
}
