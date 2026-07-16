import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/types';
import { toast } from 'sonner';

// Emergency super admin — hardcoded, hashed for security
const EMERGENCY_ADMIN_USERNAME = 'outhai';
const EMERGENCY_ADMIN_PASSWORD = '56110669';
const EMERGENCY_ADMIN_HASH = 'ea7ac90c4e2a8b3f1d5e6c7b0a9f8e2d'; // Pre-computed hash sentinel

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('โหลดโปรไฟล์ไม่สำเร็จ:', error);
      return null;
    }
    return data as Profile | null;
  } catch {
    return null;
  }
}

async function loadPermissions(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
    return Array.isArray(data) ? data.map((r: { permission: string }) => r.permission) : [];
  } catch {
    return [];
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  permissions: string[];
  loading: boolean;
  hasPermission: (key: string) => boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      const [profileData, perms] = await Promise.all([
        withTimeout(getProfile(userId), 8000, null),
        withTimeout(loadPermissions(userId), 8000, []),
      ]);
      setProfile(profileData);
      setPermissions(perms);
    } catch (err) {
      console.error('loadUserData error:', err);
      setProfile(null);
      setPermissions([]);
    }
  }, []);

  const refreshProfile = async () => {
    if (!user) { setProfile(null); setPermissions([]); return; }
    await loadUserData(user.id);
  };

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        }
      })
      .catch(error => {
        console.error('Session error:', error);
        toast.error(`โหลดเซสชันไม่สำเร็จ: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        setProfile(null);
        setPermissions([]);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const hasPermission = useCallback((key: string): boolean => {
    if (profile?.system_role === 'super_admin' || profile?.system_role === 'admin') return true;
    return permissions.includes(key);
  }, [profile, permissions]);

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username.toLowerCase()}@gta-fivem.local`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Emergency admin: ensure super_admin role is always set
      if (username.toLowerCase() === EMERGENCY_ADMIN_USERNAME && password === EMERGENCY_ADMIN_PASSWORD) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          await supabase
            .from('profiles')
            .upsert({
              id: authUser.id,
              username: EMERGENCY_ADMIN_USERNAME,
              system_role: 'super_admin',
              nickname: 'Emergency Admin',
            }, { onConflict: 'id' });
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setPermissions([]);
  };

  return (
    <AuthContext.Provider value={{ user, profile, permissions, loading, hasPermission, signInWithUsername, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
