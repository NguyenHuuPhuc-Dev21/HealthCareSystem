/**
 * "Database" giả cho mock, lưu localStorage để F5 không mất dữ liệu.
 * Xoá sạch: localStorage.removeItem('mock_db') trong Console.
 */

const KEY = 'mock_db';

type Db = Record<string, Record<string, unknown>>; // userId → bảng → dữ liệu

function read(): Db {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Db;
  } catch {
    return {};
  }
}

export function getUserData<T>(userId: string, table: string, fallback: T): T {
  return (read()[userId]?.[table] as T) ?? fallback;
}

export function setUserData(userId: string, table: string, value: unknown): void {
  const db = read();
  db[userId] = { ...(db[userId] ?? {}), [table]: value };
  localStorage.setItem(KEY, JSON.stringify(db));
}

/** Token mock có dạng "mock-token-<userId>" (xem auth.handlers.ts). */
export function userIdFromHeaders(headers: Headers): string | null {
  const auth = headers.get('Authorization') ?? '';
  const match = auth.match(/^Bearer mock-token-(.+)$/);
  return match ? match[1] : null;
}
