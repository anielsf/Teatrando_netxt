-- ============================================================
-- MIGRACIÓN 003: Actualizaciones al esquema existente
-- Ejecutar DESPUÉS de 001 y 002
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─────────────────────────────────────
-- 1. Columnas faltantes en carteleras
-- ─────────────────────────────────────
ALTER TABLE public.carteleras
  ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS calificacion_promedio DECIMAL(3,2) DEFAULT 0.00;

-- ─────────────────────────────────────
-- 2. Columnas UUID en tickets para RLS
-- ─────────────────────────────────────
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS usuario_uuid UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_tickets_usuario_uuid ON public.tickets(usuario_uuid);

-- ─────────────────────────────────────
-- 3. Columnas UUID en interacciones
-- ─────────────────────────────────────
ALTER TABLE public.interacciones
  ADD COLUMN IF NOT EXISTS usuario_uuid UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interacciones_usuario_uuid ON public.interacciones(usuario_uuid);

-- ─────────────────────────────────────
-- 4. Columnas UUID en suscripciones
-- ─────────────────────────────────────
ALTER TABLE public.suscripciones
  ADD COLUMN IF NOT EXISTS usuario_uuid UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario_uuid ON public.suscripciones(usuario_uuid);

-- ─────────────────────────────────────
-- 5. Nueva tabla: temas_estacionales
-- ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.temas_estacionales (
  id              SERIAL PRIMARY KEY,
  nombre          VARCHAR(100) NOT NULL,
  descripcion     TEXT,
  activo          BOOLEAN DEFAULT FALSE,
  fecha_inicio    DATE,
  fecha_fin       DATE,
  -- Colores (formato hex #RRGGBB)
  color_primario       VARCHAR(7) DEFAULT '#c9a24b',
  color_secundario     VARCHAR(7) DEFAULT '#8b1a2e',
  color_acento         VARCHAR(7) DEFAULT '#d4af37',
  color_fondo          VARCHAR(7) DEFAULT '#0d0507',
  color_texto          VARCHAR(7) DEFAULT '#f5e6c8',
  color_texto_suave    VARCHAR(7) DEFAULT '#d8c9b3',
  -- Forma de botones
  border_radius        VARCHAR(20) DEFAULT '6px',
  -- Imágenes
  hero_image_url       TEXT,
  hero_image_mobile_url TEXT,
  logo_variant_url     TEXT,
  -- Tipografía opcional
  font_familia         VARCHAR(100) DEFAULT 'Playfair Display',
  -- Metadata
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Solo un tema activo a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_tema_unico_activo
  ON public.temas_estacionales(activo)
  WHERE activo = TRUE;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS on_tema_updated ON public.temas_estacionales;
CREATE TRIGGER on_tema_updated
  BEFORE UPDATE ON public.temas_estacionales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed: tema base por defecto (paleta oro/vino actual)
INSERT INTO public.temas_estacionales (
  nombre, descripcion, activo,
  color_primario, color_secundario, color_acento,
  color_fondo, color_texto, color_texto_suave,
  border_radius, font_familia
) VALUES (
  'Tema Base Teatrando',
  'Tema predeterminado con paleta oro y vino tinto',
  TRUE,
  '#c9a24b', '#8b1a2e', '#d4af37',
  '#0d0507', '#f5e6c8', '#d8c9b3',
  '6px', 'Playfair Display'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────
-- 6. Índices de performance
-- ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_carteleras_visible ON public.carteleras(visible);
CREATE INDEX IF NOT EXISTS idx_carteleras_fecha ON public.carteleras(fecha);
CREATE INDEX IF NOT EXISTS idx_interacciones_obra ON public.interacciones(id_obra);
CREATE INDEX IF NOT EXISTS idx_interacciones_tipo ON public.interacciones(tipo);
CREATE INDEX IF NOT EXISTS idx_tickets_email ON public.tickets(email_cliente);
CREATE INDEX IF NOT EXISTS idx_profiles_rol ON public.profiles(rol);
