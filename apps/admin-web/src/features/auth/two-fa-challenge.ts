/** Giữ challenge 2FA giữa trang OTP → trang 2FA (sessionStorage, tự hết hạn). */

const KEY = 'admin_2fa_challenge';

export interface TwoFaChallenge {
  token: string;
  expiresAt: number; // epoch ms
  phone: string;
}

export function saveChallenge(token: string, expiresInSec: number, phone: string): void {
  const value: TwoFaChallenge = { token, expiresAt: Date.now() + expiresInSec * 1000, phone };
  sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function loadChallenge(): TwoFaChallenge | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as TwoFaChallenge;
    return value.expiresAt > Date.now() ? value : null;
  } catch {
    return null;
  }
}

export function clearChallenge(): void {
  sessionStorage.removeItem(KEY);
}
