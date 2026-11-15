import { createApiClient, type ApiResponse } from '@healthcare-system/shared';
import { env } from './env';
import { loadAccessToken, saveAccessToken } from './storage';

export type { ApiResponse };

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  void saveAccessToken(token);
}

export async function getAuthToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;
  const stored = await loadAccessToken();
  inMemoryToken = stored;
  return stored;
}

export const apiClient = createApiClient({
  getBaseUrl: () => env.apiBaseUrl,
  getToken: getAuthToken,
});
