import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { getAccessToken } from '../../lib/session';
import type { ChatMessage, Conversation, SendMessageResult } from './chat.types';
import { CHAT_IMAGE_MAX_MB, CHAT_IMAGE_TYPES } from './chat.types';

/** GET /bookings/:id/conversation — id hội thoại = id ca; tối đa 500 tin mới nhất, cũ → mới. */
export function getConversation(bookingId: string) {
  return apiClient<Conversation>(`/bookings/${bookingId}/conversation`);
}

/** POST /bookings/:id/messages — văn bản. Tin bị quét trúng (số điện thoại, link, thanh toán ngoài) vẫn được gửi nhưng kèm `warning`. */
export function sendText(bookingId: string, content: string) {
  return apiClient<SendMessageResult>(`/bookings/${bookingId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
}

const fail = <T>(code: string, message: string): ApiResponse<T> => ({ success: false, data: null as unknown as T, error: { code, message } });

/**
 * Gửi ảnh: (1) xin link tải → (2) PUT ảnh → (3) POST tin `IMAGE` kèm `imageKey`.
 * Server mã hoá lại ảnh và xoá EXIF/GPS trước khi hiển thị (ảnh chụp tại nhà mang theo vị trí).
 */
export async function sendImage(bookingId: string, file: File): Promise<ApiResponse<SendMessageResult>> {
  if (!CHAT_IMAGE_TYPES.includes(file.type)) return fail('IMAGE_TYPE_NOT_ALLOWED', 'Chỉ gửi được ảnh JPG, PNG hoặc WebP.');
  if (file.size > CHAT_IMAGE_MAX_MB * 1024 * 1024) return fail('IMAGE_TOO_LARGE', `Ảnh quá lớn (tối đa ${CHAT_IMAGE_MAX_MB} MB).`);

  const up = await apiClient<{ objectKey: string; uploadUrl: string; contentType: string }>(`/bookings/${bookingId}/messages/image-upload-url`, {
    method: 'POST',
    body: JSON.stringify({ contentType: file.type }),
  });
  if (!up.success) return fail(up.error?.code ?? 'UPLOAD_URL_FAILED', up.error?.message ?? 'Chưa gửi được ảnh.');
  try {
    const put = await fetch(up.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': up.data.contentType }, body: file });
    if (!put.ok) return fail('IMAGE_UPLOAD_FAILED', 'Tải ảnh lên chưa thành công. Vui lòng thử lại.');
  } catch {
    return fail('NETWORK_ERROR', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
  }
  return apiClient<SendMessageResult>(`/bookings/${bookingId}/messages`, { method: 'POST', body: JSON.stringify({ type: 'IMAGE', imageKey: up.data.objectKey }) });
}

/** POST /conversations/:id/read — đánh dấu mọi tin MÀ MÌNH NHẬN được tới tin này là đã đọc. */
export function markRead(conversationId: string, lastMessageId: string) {
  return apiClient<{ success: boolean }>(`/conversations/${conversationId}/read`, { method: 'POST', body: JSON.stringify({ lastMessageId }) });
}

export type ChatRealtimeEvent =
  | { type: 'NEW_MESSAGE'; message: ChatMessage }
  | { type: 'READ'; conversationId: string; readerRole: 'PATIENT' | 'NURSE'; upTo: string };

/**
 * WebSocket `/ws/chat?conversationId=<bookingId>&access_token=<JWT>` (server → client: NEW_MESSAGE, READ, CALL_*).
 * Gửi tin luôn qua POST (để backend quét + lưu trước). Tự kết nối lại; `onStatus(false)` để UI chuyển sang hỏi định kỳ.
 */
export function subscribeChat(conversationId: string, onEvent: (e: ChatRealtimeEvent) => void, onStatus?: (connected: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let timer: number | undefined;
  let attempt = 0;
  let closed = false;

  const connect = () => {
    const token = getAccessToken();
    if (!token || closed) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${proto}//${window.location.host}/ws/chat?conversationId=${encodeURIComponent(conversationId)}&access_token=${encodeURIComponent(token)}`);
    } catch {
      schedule();
      return;
    }
    ws.onopen = () => {
      attempt = 0;
      onStatus?.(true);
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (msg?.type === 'NEW_MESSAGE' || msg?.type === 'READ') onEvent(msg as ChatRealtimeEvent);
      } catch {
        /* bỏ qua */
      }
    };
    ws.onclose = () => {
      onStatus?.(false);
      schedule();
    };
    ws.onerror = () => ws?.close();
  };

  const schedule = () => {
    if (closed) return;
    attempt += 1;
    timer = window.setTimeout(connect, Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5)));
  };

  connect();
  return () => {
    closed = true;
    window.clearTimeout(timer);
    ws?.close();
  };
}
