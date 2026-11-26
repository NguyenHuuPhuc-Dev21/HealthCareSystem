import { getAccessToken, notifyUnauthorized } from './session';

export interface DownloadResult {
  ok: boolean;
  /** Mã lỗi backend (vd. EXPORT_TOO_LARGE, INVALID_PERIOD) hoặc NETWORK_ERROR */
  code?: string;
  message?: string;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Tải một tệp từ API cần đăng nhập (trình duyệt không gắn được Authorization vào link thường). */
export async function downloadFromApi(endpoint: string, fallbackName: string): Promise<DownloadResult> {
  const token = getAccessToken();
  let res: Response;
  try {
    res = await fetch(`/api/v1${endpoint}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Không kết nối được máy chủ.' };
  }
  if (!res.ok) {
    if (res.status === 401 && token) notifyUnauthorized();
    const body = await res.json().catch(() => ({}));
    return { ok: false, code: body?.error?.code ?? `HTTP_${res.status}`, message: body?.error?.message };
  }
  const cd = res.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
  return { ok: true };
}

/** Lưu văn bản CSV tạo ở phía giao diện (có BOM UTF-8 để Excel đọc đúng tiếng Việt). */
export function downloadCsvText(rows: Array<Array<string | number>>, filename: string) {
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // chặn công thức bảng tính (CSV injection)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
  saveBlob(new Blob([text], { type: 'text/csv;charset=utf-8' }), filename);
}
