import { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Alert, Button } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { formatDateTime } from '../../../lib/formatters';
import { getBookingConversation } from '../disputes.api';
import { REASON_LABEL } from '../disputes.types';
import type { AdminConversation } from '../disputes.types';

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: AdminConversation };

/**
 * Lịch sử chat của ca làm bằng chứng (FR-CHAT-01). Chỉ tải khi Admin chủ động bấm vì MỖI LẦN ĐỌC bị ghi nhật ký kiểm toán (VIEW_CHAT_HISTORY).
 * Tin bị quét trúng số điện thoại / liên kết / thanh toán ngoài được đánh dấu để Admin dễ thấy.
 */
export function ChatEvidence({ bookingId }: { bookingId: string }) {
  const [load, setLoad] = useState<Load>({ state: 'idle' });

  const open = async () => {
    setLoad({ state: 'loading' });
    const res = await getBookingConversation(bookingId);
    setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được lịch sử chat.') });
  };

  return (
    <section className="card dsp-card" aria-labelledby="dsp-chat">
      <h3 id="dsp-chat" className="section-title">Lịch sử chat của ca</h3>

      {load.state === 'idle' && (
        <>
          <Alert tone="info" title="Việc xem được ghi nhật ký kiểm toán.">Chat chứa trao đổi riêng giữa khách và điều dưỡng; chỉ mở khi cần cho việc phán quyết. Mỗi lần mở sẽ ghi một bản ghi VIEW_CHAT_HISTORY (người xem, ca, địa chỉ IP).</Alert>
          <Button variant="secondary" onClick={open}>Mở lịch sử chat</Button>
        </>
      )}
      {load.state === 'loading' && <p className="muted">Đang tải…</p>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={open}>Thử lại</Button></Alert>}

      {load.state === 'ready' && (
        <>
          <p className="muted">
            {load.data.customerName} ↔ {load.data.nurseName ?? '—'} · {load.data.messages.length} tin
            {load.data.flaggedCount > 0 && <> · <b className="dsp-flag"><ShieldAlert size={13} aria-hidden="true" /> {load.data.flaggedCount} tin bị cảnh báo</b></>}
          </p>
          <ul className="dsp-chat">
            {load.data.messages.map((m) => (
              <li key={m.id} className={`dsp-chat__row${m.senderRole === 'NURSE' ? ' is-nurse' : ''}${m.flagged ? ' is-flagged' : ''}`}>
                <div className="dsp-chat__who"><b>{m.senderName}</b> <span>{m.senderRole === 'NURSE' ? 'Điều dưỡng' : m.senderRole === 'PATIENT' ? 'Khách' : 'Hệ thống'}</span><time>{formatDateTime(m.createdAt)}</time></div>
                <p>{m.type === 'IMAGE' && m.imageUrl ? <a href={m.imageUrl} target="_blank" rel="noreferrer">📷 Mở ảnh</a> : m.content}</p>
                {m.flagged && m.flagReasons.length > 0 && (
                  <small className="dsp-flag"><AlertTriangle size={12} aria-hidden="true" /> {m.flagReasons.map((r) => REASON_LABEL[r]).join(', ')}</small>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
