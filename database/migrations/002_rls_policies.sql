-- ============================================================
-- MIGRACIÓN 002: Row Level Security (RLS) — Todas las tablas
-- Ejecutar DESPUÉS de 001_profiles.sql
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────
-- TABLA: profiles
-- ─────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve y edita su propio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admin puede ver y editar todos los perfiles
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: carteleras
-- ─────────────────────────────────────
ALTER TABLE public.carteleras ENABLE ROW LEVEL SECURITY;

-- Lectura pública: solo carteleras visibles
CREATE POLICY "carteleras_public_read" ON public.carteleras
  FOR SELECT USING (visible = true);

-- Admin puede leer todas (incluidas las ocultas)
CREATE POLICY "carteleras_admin_read_all" ON public.carteleras
  FOR SELECT USING (public.get_user_role() = 'Admin');

-- Solo Admin puede crear/editar/eliminar
CREATE POLICY "carteleras_admin_write" ON public.carteleras
  FOR INSERT WITH CHECK (public.get_user_role() = 'Admin');

CREATE POLICY "carteleras_admin_update" ON public.carteleras
  FOR UPDATE USING (public.get_user_role() = 'Admin');

CREATE POLICY "carteleras_admin_delete" ON public.carteleras
  FOR DELETE USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: teatros
-- ─────────────────────────────────────
ALTER TABLE public.teatros ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "teatros_public_read" ON public.teatros
  FOR SELECT USING (true);

-- Solo Admin puede modificar
CREATE POLICY "teatros_admin_write" ON public.teatros
  FOR ALL USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: tickets
-- ─────────────────────────────────────
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Usuario ve solo sus propios tickets (comparando UUID con profiles.id)
CREATE POLICY "tickets_owner_read" ON public.tickets
  FOR SELECT USING (
    usuario_uuid = auth.uid()
    OR public.get_user_role() = 'Admin'
  );

-- Usuario autenticado puede crear tickets
CREATE POLICY "tickets_auth_insert" ON public.tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin puede actualizar cualquier ticket
CREATE POLICY "tickets_admin_update" ON public.tickets
  FOR UPDATE USING (public.get_user_role() = 'Admin');

-- Admin puede eliminar tickets
CREATE POLICY "tickets_admin_delete" ON public.tickets
  FOR DELETE USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: interacciones
-- ─────────────────────────────────────
ALTER TABLE public.interacciones ENABLE ROW LEVEL SECURITY;

-- Lectura pública de todas las interacciones
CREATE POLICY "interacciones_public_read" ON public.interacciones
  FOR SELECT USING (true);

-- Solo usuarios autenticados pueden insertar
CREATE POLICY "interacciones_auth_insert" ON public.interacciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- El autor puede borrar sus propias interacciones
CREATE POLICY "interacciones_owner_delete" ON public.interacciones
  FOR DELETE USING (
    usuario_uuid = auth.uid()
    OR public.get_user_role() = 'Admin'
  );

-- Críticos y Admin pueden destacar interacciones
CREATE POLICY "interacciones_critic_update" ON public.interacciones
  FOR UPDATE USING (
    public.get_user_role() IN ('Crítico', 'Admin')
  );


-- ─────────────────────────────────────
-- TABLA: suscripciones
-- ─────────────────────────────────────
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;

-- Usuario ve solo sus propias suscripciones
CREATE POLICY "suscripciones_owner_read" ON public.suscripciones
  FOR SELECT USING (
    usuario_uuid = auth.uid()
    OR public.get_user_role() = 'Admin'
  );

-- Cualquier usuario autenticado puede insertar (al pagar)
CREATE POLICY "suscripciones_auth_insert" ON public.suscripciones
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Admin puede actualizar estado de suscripciones
CREATE POLICY "suscripciones_admin_update" ON public.suscripciones
  FOR UPDATE USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: estadisticas_teatro
-- ─────────────────────────────────────
ALTER TABLE public.estadisticas_teatro ENABLE ROW LEVEL SECURITY;

-- Lectura pública de estadísticas
CREATE POLICY "estadisticas_public_read" ON public.estadisticas_teatro
  FOR SELECT USING (true);

-- Solo Admin puede actualizar estadísticas manualmente
CREATE POLICY "estadisticas_admin_write" ON public.estadisticas_teatro
  FOR ALL USING (public.get_user_role() = 'Admin');


-- ─────────────────────────────────────
-- TABLA: temas_estacionales (nueva)
-- ─────────────────────────────────────
ALTER TABLE public.temas_estacionales ENABLE ROW LEVEL SECURITY;

-- Lectura pública del tema activo
CREATE POLICY "temas_public_read" ON public.temas_estacionales
  FOR SELECT USING (true);

-- Solo Admin puede crear/editar temas
CREATE POLICY "temas_admin_write" ON public.temas_estacionales
  FOR ALL USING (public.get_user_role() = 'Admin');
