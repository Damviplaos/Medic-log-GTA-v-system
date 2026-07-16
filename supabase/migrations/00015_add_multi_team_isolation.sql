-- =============================================
-- Multi-Team Isolation: Add teams table + team_id to all relevant tables
-- =============================================

-- 1. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add team_id to profiles (user belongs to a team)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3. Add team_id to channels
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 4. Add team_id to user_presence
ALTER TABLE public.user_presence ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 5. Add team_id to queue_pointer
ALTER TABLE public.queue_pointer ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 6. Add team_id to roles
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 7. Add team_id to role_criteria
ALTER TABLE public.role_criteria ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 8. Add team_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 9. Add team_id to role_permissions
ALTER TABLE public.role_permissions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 10. Add team_id to time_logs
ALTER TABLE public.time_logs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 11. Add team_id to weekly_stats
ALTER TABLE public.weekly_stats ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 12. Add team_id to presence_logs
ALTER TABLE public.presence_logs ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- 13. Add team_id to warnings
ALTER TABLE public.warnings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 14. Add team_id to system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;

-- 15. Add team_id to queue_pointer unique constraint
ALTER TABLE public.queue_pointer DROP CONSTRAINT IF EXISTS queue_pointer_pkey;
ALTER TABLE public.queue_pointer ADD PRIMARY KEY (id);

-- 16. Performance indexes
CREATE INDEX IF NOT EXISTS idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX IF NOT EXISTS idx_channels_team_id ON public.channels(team_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_team_id ON public.user_presence(team_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_roles_team_id ON public.roles(team_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_team_id ON public.user_roles(team_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_team_id ON public.time_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON public.time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_started_at ON public.time_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_team_id ON public.weekly_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_weekly_stats_user_id ON public.weekly_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_team_id ON public.warnings(team_id);
CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON public.warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_logs_team_id ON public.presence_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_team_id ON public.role_permissions(team_id);

-- 17. Create default team for existing data
INSERT INTO public.teams (id, name, invite_code, owner_id)
SELECT
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Default Team',
  '0001',
  (SELECT id FROM auth.users LIMIT 1)
ON CONFLICT (id) DO NOTHING;

-- 18. Migrate existing data to default team
UPDATE public.profiles SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.channels SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;
UPDATE public.roles SET team_id = '00000000-0000-0000-0000-000000000001' WHERE team_id IS NULL;

-- 19. RLS policies for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can see teams
CREATE POLICY teams_select_authenticated ON public.teams
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only super_admin can create teams
CREATE POLICY teams_insert_admin ON public.teams
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'super_admin')
  );

-- Owner or super_admin can update
CREATE POLICY teams_update_owner ON public.teams
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'super_admin')
  );

-- Owner or super_admin can delete
CREATE POLICY teams_delete_owner ON public.teams
  FOR DELETE USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'super_admin')
  );

-- 20. Add invite_code to profiles (for joining teams)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;

-- 21. team_type column for super_admin to distinguish
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT 'standard';
