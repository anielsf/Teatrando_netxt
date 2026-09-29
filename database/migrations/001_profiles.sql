-- ============================================================
-- MIGRACIÓN 001: Tabla profiles vinculada a Supabase Auth
-- Reemplaza la tabla `usuarios` con integración nativa a auth.users
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Crear tabla profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      VARCHAR(255),
  email       VARCHAR(255) UNIQUE NOT NULL,
  rol         VARCHAR(50) NOT NULL DEFAULT 'Usuario'
                CHECK (rol IN ('Visitante', 'Usuario', 'Crítico', 'Admin')),
  plan_suscripcion VARCHAR(100) NOT NULL DEFAULT 'Plan Básico (Gratis)'
                CHECK (plan_suscripcion IN (
                  'Plan Básico (Gratis)',
                  'Plan Bambalinas',
                  'Plan Crítico / VIP'
                )),
  avatar_url  TEXT,
  proveedor_auth VARCHAR(50) DEFAULT 'email', -- 'email' | 'google'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger: auto-crear perfil cuando se registra un nuevo usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, email, rol, plan_suscripcion, proveedor_auth)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'nombre_completo',
      NEW.raw_user_meta_data ->> 'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'rol', 'Usuario'),
    'Plan Básico (Gratis)',
    CASE
      WHEN NEW.app_metadata ->> 'provider' = 'google' THEN 'google'
      ELSE 'email'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Asignar trigger al evento de creación de usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Función: obtener rol del usuario actual (para uso en RLS)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT rol INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(user_role, 'Visitante');
END;
$$;
