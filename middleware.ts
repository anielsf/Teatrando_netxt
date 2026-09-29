/**
 * middleware.ts — Teatrando
 *
 * Responsabilidades:
 *
 * 1. Rate Limiting de API mediante Upstash
 * 2. Refresh de sesión de Supabase
 * 3. Protección de rutas autenticadas
 * 4. Consulta del rol desde public.profiles
 */

import {
  createServerClient,
  type CookieOptions,
} from '@supabase/ssr';

import {
  type NextRequest,
  NextResponse,
} from 'next/server';


// ============================================================
// RUTAS PROTEGIDAS
// ============================================================

const PROTECTED_ROUTES: Record<string, string[]> = {
  '/cuenta': [
    'Usuario',
    'Crítico',
    'Admin',
  ],

  '/checkout': [
    'Usuario',
    'Crítico',
    'Admin',
  ],

  '/admin': [
    'Admin',
    'Grupo th',
  ],
};


// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(
  req: NextRequest
) {

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });


  // ==========================================================
  // 1. RATE LIMITING
  // ==========================================================

  const upstashUrl =
    process.env.UPSTASH_REDIS_REST_URL;

  const upstashToken =
    process.env.UPSTASH_REDIS_REST_TOKEN;


  if (
    upstashUrl &&
    upstashToken &&
    upstashUrl !== 'PENDIENTE_CONFIGURAR' &&
    req.nextUrl.pathname.startsWith('/api/')
  ) {

    try {

      const { Ratelimit } =
        await import('@upstash/ratelimit');

      const { Redis } =
        await import('@upstash/redis');


      const ratelimit =
        new Ratelimit({

          redis: new Redis({
            url: upstashUrl,
            token: upstashToken,
          }),

          limiter:
            Ratelimit.slidingWindow(
              30,
              '1 m'
            ),

          analytics: false,
        });


      const ip =
        req.ip ??
        req.headers.get(
          'x-forwarded-for'
        ) ??
        '127.0.0.1';


      const {
        success,
        limit,
        remaining,
      } = await ratelimit.limit(
        `teatrando:${ip}`
      );


      if (!success) {

        return NextResponse.json(
          {
            error:
              'Demasiadas solicitudes. ' +
              'Intenta nuevamente en un momento.',
          },
          {
            status: 429,

            headers: {
              'X-RateLimit-Limit':
                String(limit),

              'X-RateLimit-Remaining':
                String(remaining),

              'Retry-After':
                '60',
            },
          }
        );
      }

    } catch (error) {

      console.error(
        '[Middleware] Error Upstash:',
        error
      );

      // Fail-open:
      // si Upstash falla no bloqueamos la aplicación.
    }
  }


  // ==========================================================
  // 2. SUPABASE
  // ==========================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {

    console.error(
      '[Middleware] Faltan variables de Supabase.'
    );

    return response;
  }


  const supabase =
    createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {

          get(name: string) {
            return req.cookies.get(name)?.value;
          },

          set(
            name: string,
            value: string,
            options: CookieOptions
          ) {

            req.cookies.set({
              name,
              value,
              ...options,
            } as any);

            response.cookies.set({
              name,
              value,
              ...options,
            });
          },

          remove(
            name: string,
            options: CookieOptions
          ) {

            req.cookies.set({
              name,
              value: '',
              ...options,
            } as any);

            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      }
    );


  // ==========================================================
  // 3. OBTENER USUARIO
  // ==========================================================
  //
  // getUser() valida el usuario contra Supabase.
  //
  // No utilizamos:
  //
  // user_metadata.rol
  //
  // ==========================================================

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser();


  // ==========================================================
  // 4. IDENTIFICAR RUTA
  // ==========================================================

  const pathname =
    req.nextUrl.pathname;


  let matchedRoute:
    string | null = null;

  let allowedRoles:
    string[] | null = null;


  for (
    const [route, roles]
    of Object.entries(PROTECTED_ROUTES)
  ) {

    const matches =
      pathname === route ||
      pathname.startsWith(
        `${route}/`
      );


    if (matches) {

      matchedRoute = route;
      allowedRoles = roles;

      break;
    }
  }


  // Ruta pública

  if (
    !matchedRoute ||
    !allowedRoles
  ) {

    return response;
  }


  // ==========================================================
  // 5. SESIÓN REQUERIDA
  // ==========================================================

  if (
    userError ||
    !user
  ) {

    const loginUrl =
      new URL(
        '/auth',
        req.url
      );


    loginUrl.searchParams.set(
      'next',
      pathname
    );


    return NextResponse.redirect(
      loginUrl
    );
  }


  // ==========================================================
  // 6. OBTENER ROL DESDE profiles
  // ==========================================================

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();


  // ==========================================================
  // 7. ERROR CONSULTANDO PROFILE
  // ==========================================================

  if (profileError) {

    console.error(
      '[Middleware] Error obteniendo perfil:',
      profileError.message
    );


    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }


  // ==========================================================
  // 8. PERFIL NO EXISTE
  // ==========================================================

  if (!profile) {

    console.warn(
      '[Middleware] Perfil no encontrado:',
      user.id
    );


    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }


  // ==========================================================
  // 9. ROL
  // ==========================================================

  const userRole =
    String(
      profile.rol || 'Usuario'
    ).trim();


  // ==========================================================
  // 10. AUTORIZACIÓN
  // ==========================================================

  if (
    !allowedRoles.includes(
      userRole
    )
  ) {

    console.warn(
      '[Middleware] Acceso denegado:',
      {
        userId: user.id,
        pathname,
        userRole,
        allowedRoles,
      }
    );


    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }


  // ==========================================================
  // 11. AUTORIZADO
  // ==========================================================

  return response;
}


// ============================================================
// CONFIGURACIÓN
// ============================================================

export const config = {

  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};