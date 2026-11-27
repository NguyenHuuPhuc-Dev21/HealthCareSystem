/**
 * Unified API Client for Nurse Web
 * Base URL: /api/v1
 */

const API_BASE_URL = '/api/v1';
const SESSION_KEY = 'carenest_nurse_session';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

let unauthorizedHandler: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function clearStoredAuth(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem(SESSION_KEY);
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;

      const json = (await res.json()) as ApiResponse<{
        accessToken?: string;
        refreshToken?: string;
        tokens?: { accessToken?: string; refreshToken?: string };
      }>;
      const tokens = json.data?.tokens ?? json.data;
      const newAccess = tokens?.accessToken;
      const newRefresh = tokens?.refreshToken;
      if (!json.success || !newAccess) return null;

      localStorage.setItem('access_token', newAccess);
      if (newRefresh) {
        localStorage.setItem('refresh_token', newRefresh);
      }
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          parsed.token = newAccess;
          if (newRefresh) parsed.refreshToken = newRefresh;
          localStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        }
      } catch {
        // ignore malformed session cache
      }
      return newAccess;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function buildHeaders(options: RequestInit, tokenOverride?: string | null): Headers {
  const token = tokenOverride !== undefined ? tokenOverride : localStorage.getItem('access_token');
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && (!headers.has('Authorization') || tokenOverride !== undefined)) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: buildHeaders(options),
  });

  const isAuthBypassEndpoint =
    endpoint.includes('/auth/refresh') ||
    endpoint.includes('/auth/request-otp') ||
    endpoint.includes('/auth/verify-otp') ||
    endpoint.includes('/auth/complete-registration');

  if (response.status === 401 && !isAuthBypassEndpoint) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: buildHeaders(options, newAccessToken),
      });
    } else {
      clearStoredAuth();
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
  }

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

