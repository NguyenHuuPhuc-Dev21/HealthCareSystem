/**
 * Unified API Client for Nurse Mobile App
 */
const API_BASE_URL = 'http://localhost:3000/api/v1'; // Configurable via ENV

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
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

