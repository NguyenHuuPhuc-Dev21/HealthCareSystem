import { createApiClient, type ApiResponse } from '@healthcare-system/shared';
import { env } from './env';
import { loadAccessToken, loadRefreshToken, saveAccessToken, saveRefreshToken } from './storage';

export type { ApiResponse };

let inMemoryToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let isRefreshing = false;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  void saveAccessToken(token);
}

export async function getAuthToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const stored = await loadAccessToken();
  inMemoryToken = stored;
  return stored;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

const baseRequest = createApiClient({
  getBaseUrl: () => env.apiBaseUrl,
  getToken: getAuthToken,
});

interface RefreshTokenResponse {
  user: {
    id: string;
    phone: string;
    fullName: string;
    role: string;
  };
  tokens: {
    tokenType: string;
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
  };
}

/**
 * apiClient cho Nurse App:
 * Hỗ trợ tự động gắn Bearer token và thử làm mới token (refresh token) 1 lần khi gặp lỗi 401.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const res = await baseRequest<T>(endpoint, options);

  if (!res.success && res.error?.code === 'HTTP_401' && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/verify-otp')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const storedRefreshToken = await loadRefreshToken();
        if (storedRefreshToken) {
          const refreshRes = await baseRequest<RefreshTokenResponse>('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });

          if (refreshRes.success && refreshRes.data?.tokens) {
            const { accessToken, refreshToken: newRefreshToken } = refreshRes.data.tokens;
            setAuthToken(accessToken);
            if (newRefreshToken) {
              await saveRefreshToken(newRefreshToken);
            }
            isRefreshing = false;
            // Thử lại request ban đầu 1 lần với token mới
            return await baseRequest<T>(endpoint, options);
          }
        }
      } catch {
        // Refresh thất bại
      } finally {
        isRefreshing = false;
      }
    }

    // Nếu không có refresh token hoặc refresh thất bại: đăng xuất về màn login
    setAuthToken(null);
    await saveRefreshToken(null);
    if (unauthorizedHandler) {
      unauthorizedHandler();
    }
  }

  return res;
}
