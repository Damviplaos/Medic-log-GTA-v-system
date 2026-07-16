import { supabase } from '@/db/supabase';
import type { Team } from '@/types/types';

export async function getTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? (data as Team[]) : [];
}

export async function getMyTeams(): Promise<Team[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .or(`owner_id.eq.${user.id},id.in.(select team_id from profiles where id='${user.id}')`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return Array.isArray(data) ? (data as Team[]) : [];
}

export async function createTeam(name: string): Promise<Team> {
  const { data, error } = await supabase.functions.invoke('manage-team', {
    body: { action: 'create_team', name },
    method: 'POST',
  });
  if (error) {
    const msg = await error?.context?.text?.();
    throw new Error(msg || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as Team;
}

export async function joinTeam(inviteCode: string): Promise<Team> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('ไม่ได้เข้าสู่ระบบ');

  const { data: team, error: findError } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', inviteCode.trim())
    .maybeSingle();
  if (findError || !team) throw new Error('รหัสทีมไม่ถูกต้อง');

  const { error } = await supabase
    .from('profiles')
    .update({ team_id: team.id })
    .eq('id', user.id);
  if (error) throw error;

  return team as Team;
}

export async function switchTeam(teamId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('ไม่ได้เข้าสู่ระบบ');

  const { error } = await supabase
    .from('profiles')
    .update({ team_id: teamId })
    .eq('id', user.id);
  if (error) throw error;
}

export async function getTeamByInviteCode(inviteCode: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('invite_code', inviteCode.trim())
    .maybeSingle();
  if (error) return null;
  return data as Team | null;
}

export async function deleteTeam(teamId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('ไม่ได้เข้าสู่ระบบ');

  const { data: team } = await supabase.from('teams').select('owner_id').eq('id', teamId).maybeSingle();
  const { data: profile } = await supabase.from('profiles').select('system_role').eq('id', user.id).maybeSingle();

  if (team?.owner_id !== user.id && profile?.system_role !== 'super_admin') {
    throw new Error('ไม่มีสิทธิ์ลบแผนกนี้');
  }

  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}
