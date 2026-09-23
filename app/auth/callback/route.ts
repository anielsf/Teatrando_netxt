/**
 * API Route: /auth/callback
 * Intercambia el code de OAuth (Google SSO) por una sesión de Supabase
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Si falla el intercambio, redirigir a login con error
  return NextResponse.redirect(
    new URL('/auth?error=oauth_callback_failed', requestUrl.origin)
  );
}
