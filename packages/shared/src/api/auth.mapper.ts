import { UserRole } from '../enums';
import type { SessionData } from '../contracts/auth.contracts';
import type { OnboardingStatusDto } from '../contracts/onboarding.contracts';
import { mapCredentialView, mapStatusToProfile } from '../contracts/onboarding.contracts';

export interface BeVerifyAuthenticated {
  status: 'AUTHENTICATED';
  user: {
    id: string;
    phone: string;
    fullName: string;
    role: UserRole;
    kycStatus: string;
  };
  tokens: {
    tokenType: string;
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
  };
}

export interface BuildSessionResult {
  success: boolean;
  data: SessionData | null;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Xây dựng SessionData từ kết quả trả về của backend sau khi xác thực thành công (verify-otp / complete-registration).
 * Dùng chung giữa nurse-web và nurse-app.
 */
export function buildSessionFromAuth(
  data: BeVerifyAuthenticated,
  onboardingStatus?: OnboardingStatusDto | null
): BuildSessionResult {
  if (data.user.role !== UserRole.NURSE) {
    return {
      success: false,
      data: null,
      error: {
        code: 'ROLE_MISMATCH',
        message: 'Tài khoản này không phải là điều dưỡng. Vui lòng sử dụng đúng cổng đăng nhập.',
      },
    };
  }

  const profile = onboardingStatus ? mapStatusToProfile(onboardingStatus, data.user.id) : null;
  const credentials = onboardingStatus
    ? onboardingStatus.credentials.map((c) => mapCredentialView(c, data.user.id))
    : [];

  const session: SessionData = {
    token: data.tokens.accessToken,
    refreshToken: data.tokens.refreshToken,
    profileSource: 'API',
    user: {
      id: data.user.id,
      phone: data.user.phone,
      full_name: data.user.fullName,
      role: data.user.role,
    },
    profile,
    credentials,
  };

  return { success: true, data: session };
}
