import React from 'react';
import { Navigate } from 'react-router-dom';
import { ProfileStatus } from '@healthcare-system/shared';
import { useAuth } from '../features/auth/AuthContext';
import type { SessionData } from '../features/auth/auth.types';

export type GateZone = 'onboarding' | 'pending' | 'active' | 'locked';

/** Khu vực mà một phiên đăng nhập thuộc về — suy ra duy nhất từ profile_status. */
export function zoneOf(session: SessionData): GateZone {
    if (!session.profile) return 'onboarding';
    switch (session.profile.profile_status) {
        case ProfileStatus.ACTIVE:
            return 'active';
        case ProfileStatus.PENDING_VERIFICATION:
            return 'pending';
        case ProfileStatus.SUSPENDED:
        case ProfileStatus.BANNED:
            return 'locked';
        default:
            return 'pending';
    }
}

export function homePathOf(session: SessionData): string {
    switch (zoneOf(session)) {
        case 'onboarding':
            return '/onboarding';
        case 'pending':
            return '/pending';
        case 'locked':
            return '/locked';
        case 'active':
            return '/';
        default:
            return '/login';
    }
}

/**
 * Cổng route theo profile_status (FR-AUTH-01/02):
 * hồ sơ PENDING_VERIFICATION không vào được khu vực điều dưỡng đã duyệt
 * dù gõ URL trực tiếp. Đây là lớp FE — BE vẫn phải chặn 403 ở API.
 */
export const ProtectedRoute: React.FC<{ zone: GateZone; children: React.ReactNode }> = ({
    zone,
    children,
}) => {
    const { session } = useAuth();
    if (!session) return <Navigate to="/login" replace />;
    if (zoneOf(session) !== zone) return <Navigate to={homePathOf(session)} replace />;
    return <>{children}</>;
};