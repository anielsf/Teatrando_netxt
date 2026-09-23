/**
 * middleware.ts — Teatrando
 *
 * Ejecuta en el Edge de Vercel antes de cada request.
 *
 * Responsabilidades:
 *   1. Rate Limiting (Upstash Redis) — protege toda la API
 *   2. Refresh de sesión de Supabase Auth
 *   3. Protección de rutas autenticadas
 *   4. Protección de /admin mediante profiles.rol
 *
 * IMPORTANTE:
 * El rol NO se obtiene desde:
 *   session.user.user_metadata.rol
 *
 * La fuente de verdad de roles en Teatrando es:
 *   public.profiles.rol
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
//
// Estas rutas requieren una sesión de Supabase.
//
// La autorización específica de Admin se comprueba
// posteriormente consultando public.profiles.
//
// ============================================================

const PROTECTED_ROUTES: Record<string, string[]> = {
  '/cuenta': ['Usuario', 'Crítico', 'Admin'],
  '/checkout': ['Usuario', 'Crítico', 'Admin'],
  '/admin': ['Admin'],
};


// ============================================================
// MIDDLEWARE
// ============================================================

export async function middleware(req: NextRequest) {

  // ----------------------------------------------------------
  // Respuesta inicial
  // ----------------------------------------------------------

  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });


  // ==========================================================
  // 1. RATE LIMITING — UPSTASH
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


      const ratelimit = new Ratelimit({

        redis: new Redis({
          url: upstashUrl,
          token: upstashToken,
        }),

        limiter: Ratelimit.slidingWindow(
          30,
          '1 m'
        ),

        analytics: false,
      });


      const ip =
        req.ip ??
        req.headers.get('x-forwarded-for') ??
        '127.0.0.1';


      const identifier =
        `teatrando:${ip}`;


      const {
        success,
        limit,
        remaining,
      } = await ratelimit.limit(identifier);


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

      // Fail-open:
      // Si Upstash falla, no bloqueamos la aplicación.

      console.error(
        '[Middleware] Error en Upstash:',
        error
      );
    }
  }


  // ==========================================================
  // 2. SUPABASE — REFRESH DE SESIÓN
  // ==========================================================

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;


  // Si faltan las variables, no intentamos crear
  // un cliente inválido de Supabase.

  if (!supabaseUrl || !supabaseAnonKey) {

    console.error(
      '[Middleware] Faltan las variables ' +
      'NEXT_PUBLIC_SUPABASE_URL o ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );

    return response;
  }


  const supabase = createServerClient(
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


          response =
            NextResponse.next({
              request: {
                headers: req.headers,
              },
            });


          response.cookies.set(
            {
              name,
              value,
              ...options,
            }
          );
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


          response =
            NextResponse.next({
              request: {
                headers: req.headers,
              },
            });


          response.cookies.set(
            {
              name,
              value: '',
              ...options,
            }
          );
        },
      },
    }
  );


  // ==========================================================
  // 3. OBTENER USUARIO AUTENTICADO
  // ==========================================================
  //
  // getUser() es preferible a confiar únicamente en
  // getSession() para autorización.
  //
  // Supabase valida el JWT y devuelve el usuario autenticado.
  //
  // ==========================================================

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser();


  const pathname =
    req.nextUrl.pathname;


  // ==========================================================
  // 4. DETERMINAR SI LA RUTA ESTÁ PROTEGIDA
  // ==========================================================

  let matchedRoute:
    | string
    | null = null;

  let allowedRoles:
    | string[]
    | null = null;


  for (
    const [route, roles]
    of Object.entries(PROTECTED_ROUTES)
  ) {

    if (
      pathname === route ||
      pathname.startsWith(`${route}/`)
    ) {

      matchedRoute = route;
      allowedRoles = roles;

      break;
    }
  }


  // Si la ruta no está protegida,
  // dejamos continuar.

  if (!matchedRoute || !allowedRoles) {

    return response;
  }


  // ==========================================================
  // 5. USUARIO NO AUTENTICADO
  // ==========================================================

  if (
    userError ||
    !user
  ) {

    const loginUrl =
      new URL('/auth', req.url);


    loginUrl.searchParams.set(
      'next',
      pathname
    );


    return NextResponse.redirect(
      loginUrl
    );
  }


  // ==========================================================
  // 6. OBTENER ROL DESDE public.profiles
  // ==========================================================
  //
  // ESTE ES EL CAMBIO IMPORTANTE.
  //
  // Antes:
  //
  // session.user.user_metadata?.rol
  //
  // Ahora:
  //
  // profiles.rol
  //
  // Esto coincide con:
  //
  // lib/auth.ts
  // hooks/useAuth.ts
  //
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
  // 7. ERROR AL OBTENER EL PERFIL
  // ==========================================================

  if (profileError) {

    console.error(
      '[Middleware] Error obteniendo perfil:',
      profileError.message
    );


    // No damos acceso a una ruta protegida
    // si no podemos determinar el rol.

    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }


  // ==========================================================
  // 8. PERFIL NO EXISTE
  // ==========================================================

  if (!profile) {

    console.warn(
      '[Middleware] Usuario sin perfil:',
      user.id
    );


    return NextResponse.redirect(
      new URL('/', req.url)
    );
  }


  // ==========================================================
  // 9. NORMALIZAR ROL
  // ==========================================================

  const userRole =
    String(profile.rol || 'Usuario')
      .trim();


  // ==========================================================
  // 10. COMPROBAR AUTORIZACIÓN
  // ==========================================================

  if (
    !allowedRoles.includes(userRole)
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
  // 11. TODO CORRECTO
  // ==========================================================

  return response;
}


// ============================================================
// CONFIGURACIÓN DEL MIDDLEWARE
// ============================================================

export const config = {

  matcher: [

    /*
     * Aplicar a todas las rutas excepto:
     *
     * - _next/static
     * - _next/image
     * - favicon.ico
     * - imágenes estáticas
     */

    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};