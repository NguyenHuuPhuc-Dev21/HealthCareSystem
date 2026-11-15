/**
 * Mock API rất nhẹ, không cần cài thêm thư viện: chặn window.fetch cho các route đã khai báo,
 * route nào chưa có handler thì vẫn đi ra mạng như bình thường.
 * Format trả về giống backend: { success, data } hoặc { success: false, error }.
 */

export interface MockResult {
  status: number;
  body: unknown;
}

export interface MockRequest {
  /** JSON đã parse, hoặc FormData nếu là multipart */
  body: any;
  headers: Headers;
  /** Tham số trên đường dẫn, vd. route '/patients/profiles/:id' → { id } */
  params: Record<string, string>;
}

export type MockHandler = (body: any, req: MockRequest) => MockResult;

export const ok = (data: unknown): MockResult => ({ status: 200, body: { success: true, data } });

export const fail = (status: number, code: string, message: string, details?: unknown): MockResult => ({
  status,
  body: { success: false, error: { code, message, details } },
});

const MOCK_DELAY_MS = 600;

/** Tìm handler khớp "METHOD /path", hỗ trợ tham số dạng :id. */
function matchRoute(routes: Record<string, MockHandler>, method: string, path: string) {
  for (const [key, handler] of Object.entries(routes)) {
    const [m, pattern] = key.split(' ');
    if (m !== method) continue;
    const names: string[] = [];
    const regex = new RegExp(
      '^' + pattern.replace(/:([a-zA-Z_]+)/g, (_s, name: string) => {
        names.push(name);
        return '([^/]+)';
      }) + '$'
    );
    const found = path.match(regex);
    if (found) {
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(found[i + 1])]));
      return { handler, params };
    }
  }
  return null;
}

export function installMockFetch(routes: Record<string, MockHandler>): void {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const path = new URL(url, window.location.origin).pathname;
    const matched = matchRoute(routes, method, path);

    if (!matched) return realFetch(input, init);
    const { handler, params } = matched;

    let body: unknown = undefined;
    if (init?.body instanceof FormData) {
      body = init.body;
    } else if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    const headers = new Headers(init?.headers);
    const result = handler(body, { body, headers, params });
    console.info(`[mock] ${method} ${path} → ${result.status}`);

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
