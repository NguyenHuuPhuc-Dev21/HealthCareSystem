import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearSession, getAccessToken, getStoredUser, onUnauthorized, saveSession } from '../../lib/session';
import type { AuthUser } from './auth.types';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signIn: (accessToken: string, user: AuthUser) => void;
  signOut: () => void;
  /** Cập nhật một phần thông tin user sau khi backend xác nhận (vd. kyc_status sau khi nộp eKYC). */
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readInitialUser(): AuthUser | null {
  return getAccessToken() ? getStoredUser<AuthUser>() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readInitialUser);

  const signIn = useCallback((accessToken: string, nextUser: AuthUser) => {
    saveSession(accessToken, nextUser);
    setUser(nextUser);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const token = getAccessToken();
      if (token) saveSession(token, next);
      return next;
    });
  }, []);

  // Backend trả 401 ở bất kỳ API nào → đăng xuất, RequireAuth sẽ đưa về /login
  useEffect(() => onUnauthorized(signOut), [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, signIn, signOut, updateUser }),
    [user, signIn, signOut, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
