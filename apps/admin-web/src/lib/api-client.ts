/**
 * Unified API Client for Admin Web Portal
 * Base URL: /api/v1
 */

import { getAccessToken, notifyUnauthorized } from './session';

const API_BASE_URL = '/api/v1';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    // Mất mạng, backend chưa chạy, CORS...
    return {
      success: false,
      data: null as unknown as T,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.',
      },
    };
  }

  if (!response.ok) {
    // Đang có phiên mà bị 401 → phiên hết hạn, báo cho AuthProvider đăng xuất
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }

    const errorBody = await response.json().catch(() => ({}));
    return {
      success: false,
      data: null as unknown as T,
      error: {
        code: errorBody.error?.code || `HTTP_${response.status}`,
        message: errorBody.error?.message || response.statusText,
        details: errorBody.error?.details,
      },
    };
  }

  return response.json();
}
