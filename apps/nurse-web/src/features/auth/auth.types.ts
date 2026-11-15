import type { NurseCredential, NurseProfile, UserRole } from '@healthcare-system/shared';

/** Người dùng tối thiểu mà FE cần sau khi verify OTP. */
export interface SessionUser {
    id: string;
    phone: string;
    full_name: string;
    role: UserRole;
}

/**
 * Dữ liệu phiên đăng nhập:
 * Cung cấp token, refresh token, thông tin người dùng và hồ sơ/văn bằng.
 */
export interface SessionData {
    token: string;
    refreshToken?: string;
    profileSource?: 'API' | 'MOCK';
    user: SessionUser;
    profile: NurseProfile | null;
    credentials: NurseCredential[];
}

export interface RequestOtpData {
    requestId: string;
    /** Giây phải chờ trước khi được gửi lại mã — lấy từ BE/config, không hardcode luật. */
    resendAfterSeconds: number;
    /** Giây mã còn hiệu lực. */
    expiresInSeconds: number;
    devOtp?: string;
}
