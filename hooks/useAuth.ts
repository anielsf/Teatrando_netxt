/**
 * Hook: useAuth
 * Encapsula la lógica de autenticación de Supabase
 * y los helpers de roles del sistema
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAppStore, type TeatrandoUser } from '@/store/appStore';
import type { Session, User } from '@supabase/supabase-js';

export interface UseAuthReturn {
  user: TeatrandoUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCritic: boolean;
  hasFreeFees: boolean;
  rol: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  register: (nombre: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
<<<<<<< HEAD
=======
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
>>>>>>> ce05389 (se agrego la configuracion de area de administrador, critico, se ajustaron los roles, se actualizaron los flujos y se agrego opción de recuperación de clave)
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { user, setUser } = useAppStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        syncUserProfile(session.user.id);
      }
      setLoading(false);
    });

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (session?.user) {
          await syncUserProfile(session.user.id);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncUserProfile = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      setUser({
        id: userId,
        email: profile.email,
        nombre: profile.nombre || '',
        rol: profile.rol || 'Usuario',
        plan: profile.plan_suscripcion || 'Plan Básico (Gratis)',
        avatar_url: profile.avatar_url,
      });
    }
  }, [supabase, setUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, user: data.user };
  }, [supabase]);

  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, [supabase]);

  const register = useCallback(async (nombre: string, email: string, password: string) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', nombre, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error };
    return { success: true };
  }, []);

<<<<<<< HEAD
=======
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
      redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, [supabase]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, [supabase]);

>>>>>>> ce05389 (se agrego la configuracion de area de administrador, critico, se ajustaron los roles, se actualizaron los flujos y se agrego opción de recuperación de clave)
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase, setUser]);

  // Helpers de rol
  const isAuthenticated = !!session;
  const isAdmin    = user?.rol === 'Admin';
  const isCritic   = user?.rol === 'Crítico' || user?.rol === 'Admin';
  const hasFreeFees = user?.plan === 'Plan Bambalinas' || user?.plan === 'Plan Crítico / VIP';

  return {
    user,
    session,
    loading,
    isAuthenticated,
    isAdmin,
    isCritic,
    hasFreeFees,
    rol: user?.rol || null,
    login,
    loginWithGoogle,
    register,
<<<<<<< HEAD
=======
    resetPassword,
    updatePassword,
>>>>>>> ce05389 (se agrego la configuracion de area de administrador, critico, se ajustaron los roles, se actualizaron los flujos y se agrego opción de recuperación de clave)
    logout,
  };
}