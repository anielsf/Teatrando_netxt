/**
 * Helpers de autenticación y autorización para API Routes
 * Extrae el usuario del JWT de Supabase y verifica roles
 */
import { createSupabaseServerClient } from './supabase/server';
import { logger } from './logger';

export type UserRole = 'Visitante' | 'Usuario' | 'Crítico' | 'Admin';

export interface AuthUser {
  id: string;
  email: string;
  rol: UserRole;
  plan: string;
  nombre: string;
}

/**
 * Extrae el usuario autenticado del request actual.
 * Retorna null si no hay sesión válida.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select(
        'nombre, rol, plan_suscripcion'
      )
      .eq('id', user.id)
      .single();

    if (
      profileError ||
      !profile
    ) {
      logger.warn(
        'Perfil no encontrado para usuario autenticado',
        {
          userId: user.id,
          error: profileError?.message,
        }
      );

      return null;
    }

    return {
      id: user.id,

      email:
        user.email || '',

      rol:
        (profile.rol as UserRole) ||
        'Usuario',

      plan:
        profile.plan_suscripcion ||
        'Plan Básico (Gratis)',

      nombre:
        profile.nombre ||
        user.email?.split('@')[0] ||
        'Usuario',
    };

  } catch (err) {

    logger.error(
      'Error en getAuthUser',
      {
        message:
          (err as Error).message,
      }
    );

    return null;
  }
}

/**
 * Verifica que el usuario tenga el rol requerido.
 * Retorna Response 401/403 si no cumple, null si está autorizado.
 */
export async function requireAuth(
  allowedRoles: UserRole[] = ['Usuario', 'Crítico', 'Admin']
): Promise<{ user: AuthUser } | Response> {
  const user = await getAuthUser();

  if (!user) {
    return Response.json(
      { error: 'Autenticación requerida. Por favor inicia sesión.' },
      { status: 401 }
    );
  }

  if (!allowedRoles.includes(user.rol)) {
    logger.warn('Acceso denegado por rol insuficiente', {
      userId: user.id,
      userRole: user.rol,
      requiredRoles: allowedRoles,
    });
    return Response.json(
      { error: 'No tienes permisos para realizar esta acción.' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Shortcut: solo Admin
 */
export function requireAdmin() {
  return requireAuth(['Admin']);
}

/**
 * Shortcut: Crítico o Admin
 */
export function requireCriticOrAdmin() {
  return requireAuth(['Crítico', 'Admin']);
}
