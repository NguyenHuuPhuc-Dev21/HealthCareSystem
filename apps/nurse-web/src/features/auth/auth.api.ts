import { UserRole } from '@healthcare-system/shared';
import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK_AUTH } from '../../lib/mock-flags';
import { getOnboardingStatus } from '../onboarding/onboarding.api';
import { mapCredentialView, mapStatusToProfile } from '../onboarding/onboarding.types';
import { mockRequestOtp, mockVerifyOtp } from './auth.mock';
import type { RequestOtpData, SessionData } from './auth.types';

export const USE_MOCK = USE_MOCK_AUTH;

export type VerifyOutcome =
  | { status: 'AUTHENTICATED'; session: SessionData }
  | { status: 'REGISTRATION_REQUIRED'; registrationToken: string }
  | { status: 'SECOND_FACTOR_REQUIRED' };

interface BeVerifyAuthenticated {
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

interface BeVerifyRegistration {
  status: 'REGISTRATION_REQUIRED';
  registrationToken: string;
  expiresInSeconds: number;
}

interface BeVerifySecondFactor {
  status: 'SECOND_FACTOR_REQUIRED';
  challengeToken: string;
  expiresInSeconds: number;
  enrolled: boolean;
}

type BeVerifyResponse = BeVerifyAuthenticated | BeVerifyRegistration | BeVerifySecondFactor;

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

export async function requestOtp(phone: string): Promise<ApiResponse<RequestOtpData>> {
  if (USE_MOCK_AUTH) return mockRequestOtp(phone);
  const res = await apiClient<{ expiresInSeconds: number; resendAfterSeconds: number; devOtp?: string }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
  if (!res.success) return res as unknown as ApiResponse<RequestOtpData>;

  if (res.data.devOtp) {
    sessionStorage.setItem('dev_otp', res.data.devOtp);
  } else {
    sessionStorage.removeItem('dev_otp');
  }

  return {
    success: true,
    data: {
      requestId: `req-${Date.now()}`,
      resendAfterSeconds: res.data.resendAfterSeconds,
      expiresInSeconds: res.data.expiresInSeconds,
      devOtp: res.data.devOtp,
    },
  };
}

async function buildSessionFromAuth(data: BeVerifyAuthenticated): Promise<ApiResponse<SessionData>> {
  if (data.user.role !== UserRole.NURSE) {
    return fail('ROLE_MISMATCH', 'Tài khoản này không phải là điều dưỡng. Vui lòng sử dụng đúng cổng đăng nhập.');
  }

  localStorage.setItem('access_token', data.tokens.accessToken);
  localStorage.setItem('refresh_token', data.tokens.refreshToken);

  const statusRes = await getOnboardingStatus();
  const profile = statusRes.success ? mapStatusToProfile(statusRes.data, data.user.id) : null;
  const credentials = statusRes.success ? statusRes.data.credentials.map((c) => mapCredentialView(c, data.user.id)) : [];

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

export async function verifyOtp(phone: string, otp: string): Promise<ApiResponse<VerifyOutcome>> {
  if (USE_MOCK_AUTH) {
    const mockRes = await mockVerifyOtp(phone, otp);
    if (!mockRes.success) return mockRes as unknown as ApiResponse<VerifyOutcome>;
    return {
      success: true,
      data: {
        status: 'AUTHENTICATED',
        session: {
          ...mockRes.data,
          profileSource: 'MOCK',
        },
      },
    };
  }

  const res = await apiClient<BeVerifyResponse>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
  if (!res.success) return res as unknown as ApiResponse<VerifyOutcome>;

  if (res.data.status === 'AUTHENTICATED') {
    const sRes = await buildSessionFromAuth(res.data);
    if (!sRes.success) return sRes as unknown as ApiResponse<VerifyOutcome>;
    return {
      success: true,
      data: { status: 'AUTHENTICATED', session: sRes.data },
    };
  }

  if (res.data.status === 'REGISTRATION_REQUIRED') {
    return {
      success: true,
      data: { status: 'REGISTRATION_REQUIRED', registrationToken: res.data.registrationToken },
    };
  }

  return fail('SECOND_FACTOR_UNSUPPORTED', 'Tài khoản yêu cầu xác thực 2 bước không được hỗ trợ trên cổng này.');
}

export async function completeRegistration(
  registrationToken: string,
  fullName: string,
): Promise<ApiResponse<SessionData>> {
  const res = await apiClient<BeVerifyAuthenticated>('/auth/complete-registration', {
    method: 'POST',
    body: JSON.stringify({
      registrationToken,
      fullName,
      role: 'NURSE',
    }),
  });
  if (!res.success) return res as unknown as ApiResponse<SessionData>;
  return buildSessionFromAuth(res.data);
}

export async function logoutServer(): Promise<void> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (refreshToken) {
    await apiClient('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}
