import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { NurseCredential, NurseProfile } from '@healthcare-system/shared';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { getOnboardingStatus } from '../onboarding/onboarding.api';
import { mapCredentialView, mapStatusToProfile } from '../onboarding/onboarding.types';
import { logoutServer } from './auth.api';
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

    // Khi khởi động lại hoặc F5: nếu đang chạy API thật và đã có phiên, đồng bộ profileStatus từ backend
    useEffect(() => {
        if (!session?.token || USE_MOCK_AUTH) return;
        let alive = true;
        getOnboardingStatus().then((res) => {
            if (!alive || !res.success) return;
            const updatedProfile = mapStatusToProfile(res.data, session.user.id);
            const updatedCreds = res.data.credentials.map((c) => mapCredentialView(c, session.user.id));
            setSession((prev) => {
                if (!prev) return prev;
                const next: SessionData = {
                    ...prev,
                    profile: updatedProfile,
                    credentials: updatedCreds,
                };
                localStorage.setItem(SESSION_KEY, JSON.stringify(next));
                return next;
            });
        });
        return () => {
            alive = false;
        };
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            login: (data) => {
                localStorage.setItem('access_token', data.token);
                if (data.refreshToken) {
                    localStorage.setItem('refresh_token', data.refreshToken);
                }
                localStorage.setItem(SESSION_KEY, JSON.stringify(data));
                setSession(data);
            },
            logout: () => {
                logoutServer();
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
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
