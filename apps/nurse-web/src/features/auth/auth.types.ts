import type { NurseCredential, NurseProfile, UserRole } from '@healthcare-system/shared';

/** Người dùng tối thiểu mà FE cần sau khi verify OTP. */
export interface SessionUser {
    id: string;
    phone: string;
    full_name: string;
    role: UserRole;
}

/**
 * Dữ liệu phiên đăng nhập — ĐIỂM CHỐT CONTRACT VỚI BE-1:
 * response `POST /auth/verify-otp` hiện trong scaffold chỉ có { token, user }.
 * FE Giai đoạn 1 cần thêm `profile` (null nếu điều dưỡng chưa nộp hồ sơ) để biết
 * điều hướng theo profile_status. Nếu BE không trả kèm, thay bằng
 * `GET /nurse/profile/me` ngay sau đăng nhập — nhưng phải chốt một trong hai.
 */
export interface SessionData {
    token: string;
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
}