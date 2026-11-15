import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Lock,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { detectOffPlatformContact } from '@healthcare-system/shared';
import { useConversation } from './useConversation';

export interface ChatPanelProps {
  bookingId: string;
  bookingCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  bookingId,
  bookingCode,
  isOpen,
  onClose,
}) => {
  const { conversation, messages, loading, send, retry } = useConversation(
    bookingId,
    isOpen
  );

  const [inputText, setInputText] = useState('');
  const [showWarningConfirm, setShowWarningConfirm] = useState(false);
  const [pendingText, setPendingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAttemptSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    // Client-side detection (FR-CHAT-01)
    const scan = detectOffPlatformContact(trimmed);
    if (scan.hasOffPlatformContact) {
      setPendingText(trimmed);
      setShowWarningConfirm(true);
      return;
    }

    send(trimmed);
    setInputText('');
  };

  const handleConfirmSendWarning = () => {
    if (pendingText) {
      send(pendingText);
      setInputText('');
      setPendingText('');
      setShowWarningConfirm(false);
    }
  };

  const counterpartName = conversation?.counterpartName || 'Khách hàng';
  const counterpartPhone = conversation?.counterpartPhoneMasked || '09•• ••• 123';
  const isConversationOpen = conversation?.isOpen ?? false;

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div
      className="chat-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Cuộc trò chuyện với ${counterpartName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="chat-drawer">
        {/* 1. Header */}
        <div className="chat-header">
          <div className="chat-header__info">
            <div className="chat-header__avatar" aria-hidden="true">
              {getInitials(counterpartName)}
            </div>
            <div>
              <div className="chat-header__name" title={counterpartName}>
                {counterpartName}
              </div>
              <div className="chat-header__sub">
                <span className="tabular-nums">{counterpartPhone}</span>
                {' · '}
                <span style={{ color: isConversationOpen ? 'var(--brand-jade)' : 'var(--ink-muted)' }}>
                  {isConversationOpen ? 'Đang hoạt động' : 'Đã đóng ca'}
                </span>
                {bookingCode && ` · ${bookingCode}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                width: 38,
                height: 38,
                minHeight: 38,
                padding: 0,
                borderRadius: '50%',
              }}
              title={`Gọi tổng đài ẩn danh tới ${counterpartPhone}`}
              onClick={() => {
                alert(
                  `Tính năng gọi thoại ẩn danh CareNest (FR-CHAT-01) bảo mật số điện thoại thực tế (${counterpartPhone}). Tổng đài VoIP đang kết nối...`
                );
              }}
              aria-label="Gọi thoại ẩn danh"
            >
              <Phone size={17} color="var(--brand-jade)" />
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                width: 38,
                height: 38,
                minHeight: 38,
                padding: 0,
                borderRadius: '50%',
              }}
              onClick={onClose}
              aria-label="Đóng bảng chat"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. Top System Security Notice */}
        <div className="chat-system-notice">
          <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
          <div>
            <b>Bảo mật CareNest (FR-CHAT-01):</b> Số điện thoại hai bên được che giấu. Hệ thống tự
            động quét và cảnh báo các số điện thoại hoặc gợi ý giao dịch ngoài ứng dụng.
          </div>
        </div>

        {/* 3. Messages Body */}
        <div className="chat-body" role="log" aria-live="polite">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
              Đang tải lịch sử trao đổi...
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--ink-muted)' }}>
              Chưa có tin nhắn nào trong ca trực này.
            </div>
          ) : (
            messages.map((m) => {
              if (m.senderRole === 'SYSTEM' || m.type === 'SYSTEM_ALERT') {
                return (
                  <div key={m.id} className="chat-bubble--system">
                    <Lock size={13} style={{ display: 'inline', marginRight: 4 }} aria-hidden="true" />
                    <span>{m.content}</span>
                  </div>
                );
              }

              const isMe = m.senderRole === 'NURSE';
              const timeFormatted = new Date(m.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={m.id}
                  className={`chat-bubble-row ${isMe ? 'chat-bubble-row--me' : 'chat-bubble-row--them'}`}
                >
                  <div
                    className={`chat-bubble ${isMe ? 'chat-bubble--me' : 'chat-bubble--them'}`}
                  >
                    <div>{m.content}</div>

                    {/* Flagged warning badge */}
                    {m.flagged && (
                      <div className="chat-bubble__flagged" role="alert">
                        <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                        <span>
                          Cảnh báo: Không chia sẻ số điện thoại cá nhân hoặc nhận thanh toán ngoài ứng dụng.
                        </span>
                      </div>
                    )}

                    <div className="chat-bubble__time">
                      {timeFormatted}
                      {isMe && m.status === 'sending' && ' · Đang gửi...'}
                      {isMe && m.status === 'sent' && (m.readAt ? ' · Đã đọc' : ' · Đã gửi')}
                    </div>
                  </div>

                  {/* Error state & Retry */}
                  {isMe && m.status === 'error' && (
                    <div className="chat-bubble__error">
                      <span>Lỗi không thể gửi tin nhắn</span>
                      <button
                        type="button"
                        onClick={() => retry(m.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ minHeight: 26, padding: '2px 8px', fontSize: 12 }}
                      >
                        <RefreshCw size={12} />
                        Gửi lại
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 4. Pre-send Warning Confirmation Modal / Bar */}
        {showWarningConfirm && (
          <div
            style={{
              padding: '12px 16px',
              background: '#FFFBEB',
              borderTop: '1px solid #FCD34D',
              borderBottom: '1px solid #FCD34D',
              fontSize: 13,
              color: '#92400E',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <div>
                <b>Cảnh báo an toàn CareNest:</b> Tin nhắn của bạn chứa dãy số giống số điện thoại
                hoặc đề cập thanh toán ngoài ứng dụng. Hệ thống sẽ ghi nhận và kiểm duyệt tin nhắn
                này.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowWarningConfirm(false);
                  setPendingText('');
                }}
                style={{ fontSize: 12.5, minHeight: 32, padding: '4px 10px' }}
              >
                Chỉnh sửa lại
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmSendWarning}
                style={{ fontSize: 12.5, minHeight: 32, padding: '4px 12px' }}
              >
                Vẫn gửi
              </button>
            </div>
          </div>
        )}

        {/* 5. Footer / Input Row */}
        <div className="chat-footer">
          {!isConversationOpen ? (
            <div className="chat-locked-notice">
              <Lock size={18} style={{ margin: '0 auto 4px', display: 'block', color: 'var(--ink-muted)' }} aria-hidden="true" />
              <b>Kênh nhắn tin đang khóa</b>
              <div>Chỉ nhắn tin được khi ca đã được xác nhận. Hội thoại đóng khi ca trực hoàn tất.</div>
            </div>
          ) : (
            <form onSubmit={handleAttemptSend}>
              <div className="chat-input-row">
                <textarea
                  className="chat-input"
                  rows={1}
                  placeholder="Nhắn tin với người nhà/khách hàng..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAttemptSend();
                    }
                  }}
                  aria-label="Nhập nội dung tin nhắn"
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!inputText.trim()}
                  style={{
                    height: 48,
                    minHeight: 48,
                    padding: '0 16px',
                    borderRadius: 12,
                    flexShrink: 0,
                  }}
                  aria-label="Gửi tin nhắn"
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </div>

              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--ink-muted)',
                  textAlign: 'center',
                  marginTop: 8,
                }}
              >
                Lịch sử chat được lưu trữ vĩnh viễn làm bằng chứng giải quyết khiếu nại (FR-CHAT-01)
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
