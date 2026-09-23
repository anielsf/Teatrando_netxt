/**
 * Cliente de Supabase para Server Components, API Routes y Middleware
 * Maneja cookies de forma segura con Next.js
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // En Server Components de solo lectura no se puede escribir cookies
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Silencioso en Server Components de solo lectura
          }
        },
      },
    }
  );
}

/**
 * Cliente con SERVICE_ROLE para operaciones de administrador
 * NUNCA exponer al cliente — solo usar en API Routes del servidor
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey === 'PENDIENTE_CONFIGURAR') {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no configurada. Ver .env.local.example'
    );
  }

  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
