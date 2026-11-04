/**
 * Lưu phiên đăng nhập phía client.
 *
 * Hiện dùng localStorage để giữ đúng cách api-client.ts đang làm (key 'access_token').
 * ⚠️ Chưa chốt với BE-1: nếu backend chuyển sang httpOnly cookie thì chỉ cần sửa file này.
 */

const TOKEN_KEY = 'access_token';
const USER_KEY = 'auth_user';

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser<T>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: unknown): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/* ---------- Thông báo khi backend trả 401 (token hết hạn / bị thu hồi) ---------- */

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export function notifyUnauthorized(): void {
  unauthorizedListeners.forEach((listener) => listener());
}
