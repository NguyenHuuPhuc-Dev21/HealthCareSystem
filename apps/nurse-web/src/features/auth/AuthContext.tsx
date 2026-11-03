import React, { createContext, useContext, useMemo, useState } from 'react';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import type { SessionData } from './auth.types';

const SESSION_KEY = 'carenest_nurse_session';

interface AuthContextValue {
    session: SessionData | null;
    login: (data: SessionData) => void;
    logout: () => void;
    /** Cập nhật hồ sơ trong phiên (sau khi nộp onboarding / duyệt GPHN). */
    updateProfile: (profile: NurseProfile | null, credentials?: NurseCredential[]) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): SessionData | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? (JSON.parse(raw) as SessionData) : null;
    } catch {
        return null;
    }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<SessionData | null>(loadSession);

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            login: (data) => {
                // api-client.ts đọc token ở key 'access_token' — phải ghi đúng key này.
                localStorage.setItem('access_token', data.token);
                localStorage.setItem(SESSION_KEY, JSON.stringify(data));
                setSession(data);
            },
            logout: () => {
                localStorage.removeItem('access_token');
                localStorage.removeItem(SESSION_KEY);
                setSession(null);
            },
            updateProfile: (profile, credentials) => {
                setSession((prev) => {
                    if (!prev) return prev;
                    const next: SessionData = {
                        ...prev,
                        profile,
                        credentials: credentials ?? prev.credentials,
                    };
                    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
                    return next;
                });
            },
        }),
        [session],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
    return ctx;
}