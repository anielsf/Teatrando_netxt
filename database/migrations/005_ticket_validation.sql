-- ============================================================
-- MIGRACIÓN 005: Control de Estado de Boletos y Validación en Taquilla (QR)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Agregar columnas para control de canje en puerta/taquilla
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS estado VARCHAR(32) DEFAULT 'emitido',
  ADD COLUMN IF NOT EXISTS utilizado BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_utilizacion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validado_por VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON public.tickets(estado);
CREATE INDEX IF NOT EXISTS idx_tickets_utilizado ON public.tickets(utilizado);

-- 2. Asegurar que Admin y Grupo th puedan validar tickets en taquilla
DROP POLICY IF EXISTS "tickets_admin_update" ON public.tickets;
CREATE POLICY "tickets_staff_update" ON public.tickets
  FOR UPDATE USING (public.get_user_role() IN ('Admin', 'Grupo th'));
