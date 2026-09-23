-- ============================================================
-- MIGRACIÓN 004: Rol Grupo TH, Identificador de Grupo, Aforo y Estadísticas Semanales
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Actualizar restricción de roles en profiles para incluir 'Grupo th'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_rol_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('Visitante', 'Usuario', 'Crítico', 'Admin', 'Grupo th'));

-- 2. Columnas en carteleras para identificar al Grupo Teatral creador y el aforo disponible
ALTER TABLE public.carteleras
  ADD COLUMN IF NOT EXISTS grupo_teatral VARCHAR(255) DEFAULT 'Compañía Teatral Residente',
  ADD COLUMN IF NOT EXISTS id_usuario_grupo UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS butacas_disponibles INT DEFAULT 80,
  ADD COLUMN IF NOT EXISTS aforo_total INT DEFAULT 80;

CREATE INDEX IF NOT EXISTS idx_carteleras_grupo_teatral ON public.carteleras(grupo_teatral);
CREATE INDEX IF NOT EXISTS idx_carteleras_id_usuario_grupo ON public.carteleras(id_usuario_grupo);

-- 3. Tabla para estadísticas históricas de semanas pasadas (Microteatral Caracas / Teatro Municipal)
CREATE TABLE IF NOT EXISTS public.estadisticas_semanales (
  id SERIAL PRIMARY KEY,
  semana_numero INT NOT NULL,
  titulo_evento VARCHAR(255) DEFAULT 'Microteatral Caracas (Semanas 1 y 2)',
  salas_activas INT DEFAULT 22,
  capacidad_semanal INT DEFAULT 14000,
  entradas_semana INT DEFAULT 2707,
  crecimiento_porcentaje VARCHAR(50) DEFAULT '+8.45%',
  valoracion_critica DECIMAL(3,2) DEFAULT 4.94,
  -- JSON de ventas por día: [{dia, promo, cantidad}]
  entradas_por_dia JSONB DEFAULT '[
    {"dia": "Miér", "promo": "3×1", "cantidad": 740},
    {"dia": "Jue", "promo": "2×1", "cantidad": 450},
    {"dia": "Vie", "promo": "2×1", "cantidad": 550},
    {"dia": "Sáb", "promo": "T.Plana", "cantidad": 493},
    {"dia": "Dom", "promo": "2×1", "cantidad": 474}
  ]',
  -- Top salas por asistencia: [{sala, asistencia}]
  top_salas JSONB DEFAULT '[
    {"sala": "Sala 7", "asistencia": 515},
    {"sala": "Sala 19", "asistencia": 420},
    {"sala": "Sala 21", "asistencia": 415},
    {"sala": "Sala 6", "asistencia": 390},
    {"sala": "Sala 15", "asistencia": 370},
    {"sala": "Sala 9", "asistencia": 310}
  ]',
  -- Comparativa Comedia vs Drama: {comedia_s1, drama_s1, otros_s1, comedia_s2, drama_s2, otros_s2}
  generos_comparativa JSONB DEFAULT '{
    "comedia_s1": 2150,
    "drama_s1": 380,
    "otros_s1": 50,
    "comedia_s2": 2400,
    "drama_s2": 295,
    "otros_s2": 60
  }',
  nota_salas TEXT DEFAULT 'Sala 7 lidera con 515 espectadores en la segunda semana.',
  nota_generos TEXT DEFAULT 'Drama cayó un 22.25% en la segunda semana, mientras Comedia mantiene el 64% de la cartelera (14 de 22 salas).',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed inicial de la Semana 2 del Microteatral Caracas
INSERT INTO public.estadisticas_semanales (
  semana_numero, titulo_evento, salas_activas, capacidad_semanal, entradas_semana, crecimiento_porcentaje, valoracion_critica
) VALUES (
  2, 'Microteatral Caracas (Semanas 1 y 2)', 22, 14000, 2707, '+8.45%', 4.94
) ON CONFLICT DO NOTHING;

-- 4. Actualizar políticas RLS para permitir a Grupo th gestionar carteleras
DROP POLICY IF EXISTS "carteleras_admin_write" ON public.carteleras;
DROP POLICY IF EXISTS "carteleras_admin_grupo_th_write" ON public.carteleras;
CREATE POLICY "carteleras_admin_grupo_th_write" ON public.carteleras
  FOR INSERT WITH CHECK (public.get_user_role() IN ('Admin', 'Grupo th'));

DROP POLICY IF EXISTS "carteleras_admin_update" ON public.carteleras;
DROP POLICY IF EXISTS "carteleras_admin_grupo_th_update" ON public.carteleras;
CREATE POLICY "carteleras_admin_grupo_th_update" ON public.carteleras
  FOR UPDATE USING (public.get_user_role() IN ('Admin', 'Grupo th'));

DROP POLICY IF EXISTS "carteleras_admin_delete" ON public.carteleras;
DROP POLICY IF EXISTS "carteleras_admin_grupo_th_delete" ON public.carteleras;
CREATE POLICY "carteleras_admin_grupo_th_delete" ON public.carteleras
  FOR DELETE USING (public.get_user_role() IN ('Admin', 'Grupo th'));

-- Políticas RLS para estadisticas_semanales
ALTER TABLE public.estadisticas_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estadisticas_public_read" ON public.estadisticas_semanales;
CREATE POLICY "estadisticas_public_read" ON public.estadisticas_semanales
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "estadisticas_admin_write" ON public.estadisticas_semanales;
CREATE POLICY "estadisticas_admin_write" ON public.estadisticas_semanales
  FOR ALL USING (public.get_user_role() = 'Admin');
