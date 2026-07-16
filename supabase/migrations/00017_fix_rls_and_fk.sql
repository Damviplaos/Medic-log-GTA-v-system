-- =============================================
-- Fix RLS + add missing FK constraints
-- =============================================

-- Allow any authenticated user to create teams (edge function uses service_role anyway, this is fallback)
DROP POLICY IF EXISTS teams_insert_admin ON public.teams;
CREATE POLICY teams_insert_authenticated ON public.teams
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Ensure time_logs channel_id FK uses SET NULL on delete
ALTER TABLE public.time_logs DROP CONSTRAINT IF EXISTS time_logs_channel_id_fkey;
ALTER TABLE public.time_logs ADD CONSTRAINT time_logs_channel_id_fkey
  FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE SET NULL;
