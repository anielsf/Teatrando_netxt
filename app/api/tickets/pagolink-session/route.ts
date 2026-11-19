/**
 * API Route: /api/tickets/pagolink-session
 * POST → Crea una sesión de checkout en PagoLink y devuelve la URL al frontend
 *
 * Solo se usa cuando el modo de pasarela está en 'pagolink_hosted'.
 * El frontend recibe checkoutUrl y redirige al usuario a pay.pagolink.co.
 * PagoLink redirige de vuelta a la app al completar el pago mediante afterCompletion.redirect.
 */
import { requireAuth } from '@/lib/auth';
import { obtenerTasaBCV } from '@/lib/tasaBcv';
import { logger } from '@/lib/logger';

const TEST_KEY_FALLBACK = 'sk_test_96519ba686e667a1be96ce0df7a0ae1909dee3ce9cacc9aa';

function normalizarTaxId(cedula?: string): string | undefined {
  if (!cedula) return undefined;
  const limpia = cedula.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!limpia) return undefined;
  if (/^[VEJGP]\d{5,10}$/.test(limpia)) return limpia;
  if (/^\d{5,10}$/.test(limpia)) return `V${limpia}`;
  return undefined;
}

async function POST(req: Request) {
  const authResult = await requireAuth();
  if (authResult instanceof Response) return authResult;
  const { user } = authResult;

  const body = await req.json();
  const {
    id_obra,
    obra,
    asiento,
    fecha_funcion,
    nombre_cliente,
    email_cliente,
  } = body as {
    id_obra: string;
    obra: string;
    asiento: string;
    fecha_funcion: string;
    nombre_cliente?: string;
    email_cliente?: string;
  };

  if (!id_obra || !asiento) {
    return Response.json({ error: 'Faltan datos obligatorios: id_obra y asiento.' }, { status: 400 });
  }

  const secretKey = (process.env.PAYMENT_SECRET_KEY?.trim().length ?? 0) > 0
    ? process.env.PAYMENT_SECRET_KEY!.trim()
    : TEST_KEY_FALLBACK;

  const tasa = await obtenerTasaBCV();
  const tasaBcv = tasa.ok ? tasa.tasa : 1;
  const precioUsd = 1.0; // El precio real se toma de la cartelera; usamos 1.00 como placeholder seguro

  // URL de retorno al completar el pago en PagoLink
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://teatrando-netxt.vercel.app';
  const successUrl = `${baseUrl}/checkout?pago_ok=1&asiento=${encodeURIComponent(asiento)}&obra=${encodeURIComponent(id_obra)}`;

  const nombre = (nombre_cliente || user.nombre || 'Espectador').trim();
  const nombreValido = nombre.length >= 3 ? nombre : 'Espectador Teatrando';
  const taxId = normalizarTaxId(user.id); // id de Supabase no es una cédula, se omite

  const payloadPagoLink: Record<string, unknown> = {
    amount: precioUsd.toFixed(2),
    currency: 'USD',
    description: `Boleto Teatrando · ${obra || 'Obra'} · Asiento ${asiento}`,
    customer: {
      name: nombreValido,
      email: email_cliente || user.email || 'tickets@teatrando.com',
    },
    metadata: {
      id_obra,
      asiento,
      fecha_funcion: fecha_funcion || '',
      usuario_id: user.id,
      modo: 'pagolink_hosted',
    },
    // afterCompletion: redirect de vuelta a Teatrando con el asiento confirmado
    afterCompletion: {
      type: 'redirect',
      url: successUrl,
    },
  };

  try {
    const res = await fetch('https://api.pagolink.co/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': secretKey,
      },
      body: JSON.stringify(payloadPagoLink),
    });

    if (res.ok) {
      const data = await res.json();
      logger.info('Sesión PagoLink hosted creada', {
        sessionId: data.sessionId,
        number: data.number,
        asiento,
        obra,
        usuario: user.email,
      });
      return Response.json({
        ok: true,
        sessionId: data.sessionId,
        number: data.number,
        checkoutUrl: data.checkoutUrl,
        shortUrl: data.shortUrl,
        expiresAt: data.expiresAt,
      });
    } else {
      const errorText = await res.text();
      logger.warn('Error al crear sesión PagoLink hosted', { errorText });
      return Response.json(
        { error: 'No se pudo crear la sesión de pago. Intenta de nuevo.' },
        { status: 502 }
      );
    }
  } catch (err: any) {
    logger.error('Error de red al conectar con PagoLink', { message: err.message });
    return Response.json(
      { error: 'Error de conexión con la pasarela de pago. Intenta de nuevo.' },
      { status: 503 }
    );
  }
}

export { POST };
