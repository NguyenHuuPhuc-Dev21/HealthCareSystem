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
  localStorage.removeItem(MFA_KEY);
}

/**
 * Bằng chứng phiên này đã qua 2FA (TOTP). Chỉ trang xác thực 2FA được gọi `markMfaVerified()`;
 * `RequireAuth` từ chối mọi phiên Admin thiếu dấu này (vd. token cũ, phiên dựng tay) → bắt đăng nhập lại.
 * Đây là lớp chặn ở giao diện; backend vẫn là nơi quyết định (Admin chỉ có token sau 2FA).
 */
const MFA_KEY = 'auth_mfa_verified';
export function markMfaVerified(): void {
  try {
    localStorage.setItem(MFA_KEY, '1');
  } catch {
    /* localStorage bị chặn → phiên không có bằng chứng → bị chặn ở RequireAuth */
  }
}
export function hasMfaProof(): boolean {
  try {
    return localStorage.getItem(MFA_KEY) === '1';
  } catch {
    return false;
  }
}

/** Lý do bị đăng xuất, hiện ở màn đăng nhập một lần. */
const REASON_KEY = 'admin_logout_reason';
export type LogoutReason = 'idle' | 'mfa';
export function setLogoutReason(r: LogoutReason): void {
  try {
    sessionStorage.setItem(REASON_KEY, r);
  } catch {
    /* bỏ qua */
  }
}
/** Đọc lý do (không xoá — React StrictMode chạy khởi tạo state hai lần); gọi clearLogoutReason() sau khi đã hiển thị. */
export function peekLogoutReason(): LogoutReason | null {
  try {
    return sessionStorage.getItem(REASON_KEY) as LogoutReason | null;
  } catch {
    return null;
  }
}
export function clearLogoutReason(): void {
  try {
    sessionStorage.removeItem(REASON_KEY);
  } catch {
    /* bỏ qua */
  }
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
