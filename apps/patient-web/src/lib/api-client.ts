/**
 * Unified API Client for Patient Web
 * Base URL: /api/v1
 */

const API_BASE_URL = '/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
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

