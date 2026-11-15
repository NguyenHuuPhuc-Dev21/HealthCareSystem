import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  NurseTier,
  ProfileStatus,
  UserRole,
  type NurseCredential,
  type NurseProfile,
  type SessionData,
} from '@healthcare-system/shared';
import { setAuthToken } from '../../lib/api-client';
import { IS_DEV } from '../../lib/hardware-providers';
import { loadSession, saveSession } from '../../lib/storage';

export type AppZone = 'auth' | 'onboarding' | 'pending' | 'locked' | 'active';

interface AuthContextValue {
  hydrated: boolean;
  session: SessionData | null;
  zone: AppZone;
  login: (data: SessionData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: NurseProfile | null, credentials?: NurseCredential[]) => Promise<void>;
  enterDevZone: (targetZone: Exclude<AppZone, 'auth'>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function resolveAppZone(session: SessionData | null): AppZone {
  if (!session) return 'auth';
  const status = session.profile?.profile_status;
  if (!status) return 'onboarding';
  if (status === ProfileStatus.PENDING_VERIFICATION) return 'pending';
  if (status === ProfileStatus.SUSPENDED || status === ProfileStatus.BANNED) return 'locked';
  return 'active';
}

function makeDevSession(targetZone: Exclude<AppZone, 'auth'>): SessionData {
  const now = new Date().toISOString();
  const baseUser = {
    id: 'dev-nurse-mai',
    phone: '0902222222',
    full_name: 'Trần Thị Mai',
    role: UserRole.NURSE,
  };

  if (targetZone === 'onboarding') {
    return {
      token: 'dev-sample-token',
      profileSource: 'MOCK',
      user: baseUser,
      profile: null,
      credentials: [],
    };
  }

  const profileStatus =
    targetZone === 'pending'
      ? ProfileStatus.PENDING_VERIFICATION
      : targetZone === 'locked'
      ? ProfileStatus.SUSPENDED
      : ProfileStatus.ACTIVE;

  return {
    token: 'dev-sample-token',
    profileSource: 'MOCK',
    user: baseUser,
    profile: {
      user_id: baseUser.id,
      tier: NurseTier.TIER_2_SPECIALIST,
      gphn_number: '00123/GPHN-ĐN',
      gphn_expiry_date: '2027-04-12',
      scope_of_practice: 'Chăm sóc sau phẫu thuật, thay băng, tiêm truyền',
      years_of_exp: 12,
      is_retired_medical_staff: true,
      is_online: true,
      trust_score: 92,
      rating_avg: 4.9,
      profile_status: profileStatus,
      suspended_reason:
        targetZone === 'locked' ? 'Tạm khóa tài khoản mẫu để kiểm thử màn hình bị khóa.' : null,
      created_at: now,
      updated_at: now,
    },
    credentials: [],
  };
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  autoStartDevSession?: boolean;
}> = ({ children, autoStartDevSession = IS_DEV }) => {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadSession().then((stored) => {
      if (!mounted) return;
      if (stored) {
        setAuthToken(stored.token);
        setSession(stored);
      } else if (autoStartDevSession) {
        const dev = makeDevSession('active');
        setAuthToken(dev.token);
        setSession(dev);
      }
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, [autoStartDevSession]);

  const login = useCallback(async (data: SessionData) => {
    setAuthToken(data.token);
    await saveSession(data);
    setSession(data);
  }, []);

  const logout = useCallback(async () => {
    setAuthToken(null);
    await saveSession(null);
    setSession(null);
  }, []);

  const updateProfile = useCallback(
    async (profile: NurseProfile | null, credentials?: NurseCredential[]) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next: SessionData = {
          ...prev,
          profile,
          credentials: credentials ?? prev.credentials,
        };
        void saveSession(next);
        return next;
      });
    },
    []
  );

  const enterDevZone = useCallback(async (targetZone: Exclude<AppZone, 'auth'>) => {
    const dev = makeDevSession(targetZone);
    setAuthToken(dev.token);
    await saveSession(dev);
    setSession(dev);
  }, []);

  const zone = useMemo(() => resolveAppZone(session), [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      session,
      zone,
      login,
      logout,
      updateProfile,
      enterDevZone,
    }),
    [hydrated, session, zone, login, logout, updateProfile, enterDevZone]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}

