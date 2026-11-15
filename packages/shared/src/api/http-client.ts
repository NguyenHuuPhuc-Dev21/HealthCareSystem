export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiErrorPayload;
}

export interface ApiClientConfig {
  getBaseUrl: () => string;
  getToken?: () => string | null | Promise<string | null>;
}

interface RawErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * Creates a platform-agnostic API client usable by both nurse-web and nurse-app.
 */
export function createApiClient(config: ApiClientConfig) {
  return async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const token = config.getToken ? await config.getToken() : null;
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${config.getBaseUrl()}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as RawErrorEnvelope;
      return {
        success: false,
        data: null as unknown as T,
        error: {
          code: errorBody.error?.code || `HTTP_${response.status}`,
          message: errorBody.error?.message || response.statusText || 'Yêu cầu thất bại',
          details: errorBody.error?.details,
        },
      };
    }

    return (await response.json()) as ApiResponse<T>;
  };
}
