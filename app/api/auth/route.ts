/**
 * API Route: /api/auth
 * Maneja: registro de usuario y datos del perfil actual
 * Login/Logout se maneja directamente desde el cliente con supabase.auth
 */
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withErrorHandler, logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/auth';

// Función interna para obtener el usuario y perfil actual
async function handleGET() {
  const user = await getAuthUser();
  if (!user) {
    return Response.json({ authenticated: false }, { status: 200 });
  }
  return Response.json({ authenticated: true, usuario: user });
}

// Función interna para registrar nuevo usuario (complementa el signUp de Supabase)
async function handlePOST(req: Request) {
  const body = await req.json();
  const { action, email, password, nombre } = body;

  const supabase = createSupabaseServerClient();

  if (action === 'register') {
    if (!email || !password || !nombre) {
      return Response.json(
        { error: 'Nombre, email y contraseña son requeridos.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password,
      options: {
        data: {
          nombre_completo: nombre.trim(),
          rol: 'Usuario',
        },
      },
    });

    if (error) {
      logger.warn('Error en registro de usuario', { email, error: error.message });
      return Response.json({ error: error.message }, { status: 400 });
    }

    logger.info('Nuevo usuario registrado', { email, userId: data.user?.id });
    return Response.json({
      success: true,
      usuario: data.user,
      message: 'Registro exitoso. Revisa tu correo para confirmar tu cuenta.',
    });
  }

  return Response.json({ error: 'Acción no reconocida' }, { status: 400 });
}

// Exportaciones formales que Next.js leerá para los métodos HTTP
export const GET = withErrorHandler(handleGET);
export const POST = withErrorHandler(handlePOST);
