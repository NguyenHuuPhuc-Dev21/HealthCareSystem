import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { AlertTriangle, ImagePlus, Lock, RefreshCw, Send, ShieldCheck, X } from 'lucide-react';
import { Alert } from '../../components';
import { CHAT_IMAGE_MAX_MB, CHAT_IMAGE_TYPES, CHAT_TEXT_MAX } from './chat.types';
import type { ChatRole, UiChatMessage } from './chat.types';
import { useConversation } from './useConversation';

export interface ChatPanelProps {
  bookingId: string;
  bookingCode?: string;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Vai trò của người đang xem — quyết định tin nào là "của mình". Mặc định PATIENT.
   * Component không phụ thuộc gì riêng của Patient Web, nên Nurse Web/App dùng lại được (`viewerRole="NURSE"`).
   */
  viewerRole?: ChatRole;
  /** `drawer`: ngăn kéo bên phải (mặc định) · `inline`: nhúng trong trang */
  variant?: 'drawer' | 'inline';
}

const hhmm = (iso: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function Bubble({ m, mine, isLastMine, onRetry, onDiscard }: { m: UiChatMessage; mine: boolean; isLastMine: boolean; onRetry: () => void; onDiscard: () => void }) {
  if (m.senderRole === 'SYSTEM' || m.type === 'SYSTEM_ALERT') {
    return <li className="chat-sys"><span>{m.content}</span></li>;
  }
  if (m.type === 'VOICE_CALL_LOG') {
    return <li className="chat-sys"><span>📞 {m.content}</span></li>;
  }

  return (
    <li className={`chat-row${mine ? ' is-mine' : ''}`}>
      <div className={`chat-bubble${m.status === 'error' ? ' is-error' : ''}${m.status === 'sending' ? ' is-sending' : ''}`}>
        {m.type === 'IMAGE' && m.imageUrl ? <a href={m.imageUrl} target="_blank" rel="noreferrer"><img src={m.imageUrl} alt="Ảnh trong cuộc trò chuyện" /></a> : <p>{m.content}</p>}
        <span className="chat-meta">
          {m.flagged && <AlertTriangle size={12} aria-label="Tin nhắn bị cảnh báo" />}
          {m.status === 'sending' ? 'Đang gửi…' : m.status === 'error' ? 'Chưa gửi được' : hhmm(m.createdAt)}
          {mine && m.status === 'sent' && isLastMine && <span> · {m.readAt ? 'Đã xem' : 'Đã gửi'}</span>}
        </span>
      </div>
      {m.status === 'error' && (
        <div className="chat-err" role="alert">
          <span>{m.errorMessage}</span>
          <button type="button" className="link-button" onClick={onRetry}><RefreshCw size={12} aria-hidden="true" /> Thử lại</button>
          <button type="button" className="link-button" onClick={onDiscard}>Xoá</button>
        </div>
      )}
    </li>
  );
}

/**
 * Khung chat trong ứng dụng (FR-CHAT-01) — dùng chung cho cả hai phía của một ca.
 * - Số điện thoại luôn bị ẩn; mọi trao đổi được lưu lại làm bằng chứng khi có tranh chấp.
 * - Tin có số điện thoại/link/thanh toán ngoài vẫn gửi nhưng người gửi nhận cảnh báo.
 * - Chỉ nhắn được khi ca đã xác nhận / đang thực hiện; ngoài khoảng đó chỉ đọc lại.
 */
export function ChatPanel({ bookingId, bookingCode, isOpen, onClose, viewerRole = 'PATIENT', variant = 'drawer' }: ChatPanelProps) {
  const { conversation, messages, loading, error, warning, dismissWarning, reload, send, sendPhoto, discard } = useConversation(bookingId, viewerRole, isOpen);
  const [text, setText] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);

  // Luôn cuộn xuống tin mới nếu người dùng đang ở cuối danh sách
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      stick.current = true;
      inputRef.current?.focus();
    }
  }, [isOpen, conversation?.isOpen]);

  useEffect(() => {
    if (!isOpen || variant !== 'drawer') return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, variant, onClose]);

  if (!isOpen) return null;

  const canWrite = !!conversation?.isOpen;
  const lastMineId = [...messages].reverse().find((m) => m.senderRole === viewerRole && m.status === 'sent')?.id;
  const trimmed = text.trim();

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || !canWrite || trimmed.length > CHAT_TEXT_MAX) return;
    stick.current = true;
    setText('');
    send(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!CHAT_IMAGE_TYPES.includes(file.type)) return setPhotoError('Chỉ gửi được ảnh JPG, PNG hoặc WebP.');
    if (file.size > CHAT_IMAGE_MAX_MB * 1024 * 1024) return setPhotoError(`Ảnh quá lớn (tối đa ${CHAT_IMAGE_MAX_MB} MB).`);
    setPhotoError(null);
    stick.current = true;
    sendPhoto(file);
  };

  const body = (
    <section className={`chat chat--${variant}`} role="dialog" aria-modal={variant === 'drawer'} aria-label={`Trò chuyện về ca ${bookingCode ?? conversation?.bookingCode ?? ''}`}>
      <header className="chat__head">
        <div>
          <b>{conversation?.counterpartName ?? 'Đang tải…'}</b>
          <small><ShieldCheck size={12} aria-hidden="true" /> Ca {bookingCode ?? conversation?.bookingCode ?? ''} · SĐT được ẩn hoàn toàn</small>
        </div>
        {variant === 'drawer' && <button type="button" className="icon-btn" aria-label="Đóng khung chat" onClick={onClose}><X size={20} /></button>}
      </header>

      {loading && <p className="chat__state skeleton">Đang tải cuộc trò chuyện…</p>}
      {error && !loading && (
        <div className="chat__state">
          <Alert title={error} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Thử lại</button>
        </div>
      )}

      {!loading && !error && (
        <ul ref={listRef} className="chat__list" role="log" aria-live="polite" aria-label="Tin nhắn" onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}>
          {messages.map((m) => (
            <Bubble key={m.id} m={m} mine={m.senderRole === viewerRole} isLastMine={m.id === lastMineId} onRetry={() => send(m.content, m.id)} onDiscard={() => discard(m.id)} />
          ))}
        </ul>
      )}

      {warning && (
        <div className="chat__warn" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <p>{warning.text}</p>
          <button type="button" className="icon-btn" aria-label="Ẩn cảnh báo" onClick={dismissWarning}><X size={14} /></button>
        </div>
      )}
      {photoError && <div className="field-error chat__perr" role="alert">{photoError}</div>}

      <form className="chat__composer" onSubmit={submit}>
        {canWrite ? (
          <>
            <button type="button" className="icon-btn" aria-label="Gửi ảnh" title="Gửi ảnh (JPG, PNG, WebP ≤ 10 MB)" onClick={() => fileRef.current?.click()}><ImagePlus size={20} /></button>
            <input ref={fileRef} type="file" hidden accept={CHAT_IMAGE_TYPES.join(',')} onChange={(e) => { onPickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={CHAT_TEXT_MAX + 200}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Nhập tin nhắn… (Enter để gửi)"
              aria-label="Nội dung tin nhắn"
            />
            <button type="submit" className="btn btn-primary chat__send" disabled={!trimmed || trimmed.length > CHAT_TEXT_MAX} aria-label="Gửi"><Send size={18} /></button>
          </>
        ) : (
          <p className="chat__closed"><Lock size={14} aria-hidden="true" /> {conversation ? 'Cuộc trò chuyện chỉ mở khi ca đã được xác nhận và đang diễn ra. Bạn có thể xem lại lịch sử.' : ' '}</p>
        )}
      </form>
      {trimmed.length > CHAT_TEXT_MAX - 100 && <div className="hint chat__count">{trimmed.length}/{CHAT_TEXT_MAX}</div>}
    </section>
  );

  if (variant === 'inline') return body;
  return (
    <div className="chat-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      {body}
    </div>
  );
}
