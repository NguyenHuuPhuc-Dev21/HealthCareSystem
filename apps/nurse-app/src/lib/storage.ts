import EncryptedStorage from 'react-native-encrypted-storage';
import type { SessionData } from '@healthcare-system/shared';

const ACCESS_TOKEN_KEY = 'carenest_access_token';
const REFRESH_TOKEN_KEY = 'carenest_refresh_token';
const SESSION_KEY = 'carenest_nurse_session';

export async function saveAccessToken(token: string | null): Promise<void> {
  try {
    if (token) {
      await EncryptedStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      await EncryptedStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // Fallback gracefully in Jest / non-native test environments
  }
}

export async function loadAccessToken(): Promise<string | null> {
  try {
    return await EncryptedStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function saveSession(session: SessionData | null): Promise<void> {
  try {
    if (!session) {
      await EncryptedStorage.removeItem(SESSION_KEY);
      await EncryptedStorage.removeItem(ACCESS_TOKEN_KEY);
      await EncryptedStorage.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await EncryptedStorage.setItem(SESSION_KEY, JSON.stringify(session));
    await EncryptedStorage.setItem(ACCESS_TOKEN_KEY, session.token);
    if (session.refreshToken) {
      await EncryptedStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }
  } catch {
    // Ignore when native encrypted storage is unavailable in unit tests
  }
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const raw = await EncryptedStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

