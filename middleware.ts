/**
 * middleware.ts — Teatrando
 * Ejecuta en el Edge de Vercel antes de cada request
 * Responsabilidades:
 *   1. Rate Limiting (Upstash Redis) — protege toda la API
 *   2. Refresh de sesión de Supabase Auth (cookies HTTPOnly)
 *   3. Protección de rutas por rol (RBAC)
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// Rutas que requieren autenticación y el rol mínimo
const PROTECTED_ROUTES: Record<string, string[]> = {
  '/cuenta':   ['Usuario', 'Crítico', 'Admin'],
  '/checkout': ['Usuario', 'Crítico', 'Admin'],
  '/admin':    ['Admin'],
};

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({ request: { headers: req.headers } });

  // ─── 1. Rate Limiting (opcional — requiere Upstash configurado) ───
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (
    upstashUrl && upstashToken &&
    upstashUrl !== 'PENDIENTE_CONFIGURAR' &&
    req.nextUrl.pathname.startsWith('/api/')
  ) {
    try {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis }     = await import('@upstash/redis');

      const ratelimit = new Ratelimit({
        redis: new Redis({ url: upstashUrl, token: upstashToken }),
        limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 req/min por IP
        analytics: false,
      });

      const ip = req.ip ?? req.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const identifier = `teatrando:${ip}`;
      const { success, limit, remaining } = await ratelimit.limit(identifier);

      if (!success) {
        return NextResponse.json(
          { error: 'Demasiadas solicitudes. Intenta nuevamente en un momento.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit':     String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'Retry-After':           '60',
            },
          }
        );
      }
    } catch {
      // Si Upstash falla, dejamos pasar (fail-open) — loguear en producción
    }
  }

  // ─── 2. Refresh de sesión de Supabase (cookies HTTPOnly) ──────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        req.cookies.set({ name, value, ...options } as any);
        response = NextResponse.next({ request: { headers: req.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        req.cookies.set({ name, value: '', ...options } as any);
        response = NextResponse.next({ request: { headers: req.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  // ─── 3. Protección de rutas (RBAC) ────────────────────────────────
  const pathname = req.nextUrl.pathname;

  for (const [route, allowedRoles] of Object.entries(PROTECTED_ROUTES)) {
    if (pathname.startsWith(route)) {
      if (!session) {
        const loginUrl = new URL('/auth', req.url);
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Obtener rol desde los metadatos del usuario
      const userRole = session.user.user_metadata?.rol || 'Usuario';
      if (!allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Aplicar a todas las rutas excepto archivos estáticos y _next
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
