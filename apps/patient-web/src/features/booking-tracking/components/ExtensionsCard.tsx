import { useState } from 'react';
import { Hourglass } from 'lucide-react';
import { Button } from '../../../components';
import { formatDateTime, formatVND } from '../../../lib/formatters';
import { formatMmSs, useCountdown } from '../../auth/useCountdown';
import { simulateExtensionPaymentForMock } from '../booking-tracking.api';
import type { ExtensionStatus, ShiftExtension } from '../booking-tracking.types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

const STATUS: Record<ExtensionStatus, { text: string; tone: '' | 'teal' | 'amber' | 'red' }> = {
  AWAITING_PAYMENT: { text: 'Chờ nạp tiền', tone: 'amber' },
  AWAITING_NURSE: { text: 'Chờ điều dưỡng đồng ý', tone: 'amber' },
  CONFIRMED: { text: 'Đã gia hạn', tone: 'teal' },
  DECLINED: { text: 'Điều dưỡng từ chối', tone: 'red' },
  EXPIRED: { text: 'Hết hạn nạp tiền', tone: 'red' },
};

function Row({ bookingId, ext, onChanged }: { bookingId: string; ext: ShiftExtension; onChanged: () => void }) {
  const left = useCountdown(ext.paymentExpiresAt ? Date.parse(ext.paymentExpiresAt) : 0);
  const [busy, setBusy] = useState(false);
  const status = STATUS[ext.status];

  const simulate = async () => {
    setBusy(true);
    await simulateExtensionPaymentForMock(bookingId, ext.id);
    setBusy(false);
    onChanged();
  };

  return (
    <li className="bt-ext">
      <div className="bt-ext__head">
        <b>+{ext.hours} giờ · {formatVND(ext.amount)}</b>
        <span className={`chip ${status.tone}`}>{status.text}</span>
      </div>
      <small className="ns-muted">Yêu cầu lúc {formatDateTime(ext.createdAt)} · {ext.paymentMethod === 'CASH' ? 'cộng vào hoá đơn tiền mặt' : 'nạp thêm vào escrow'}</small>

      {ext.status === 'AWAITING_PAYMENT' && ext.bankTransfer && (
        <div className="bt-ext__pay">
          <p>
            Chuyển <b>{formatVND(ext.amount)}</b> tới <b>{ext.bankTransfer.accountNumber}</b> ({ext.bankTransfer.accountName}), nội dung <b>{ext.bankTransfer.transferContent}</b>.
            Còn <b className={left <= 120 ? 'bt-low' : undefined}>{formatMmSs(left)}</b> để nạp tiền.
          </p>
          {USE_MOCK && (
            <Button type="button" variant="secondary" size="sm" onClick={simulate} loading={busy}>Giả lập: cổng thanh toán đã nhận tiền</Button>
          )}
        </div>
      )}
      {ext.status === 'DECLINED' && <small className="ns-muted">Ca vẫn kết thúc theo giờ cũ. Bạn có thể thử gia hạn số giờ khác.</small>}
    </li>
  );
}

/** Danh sách yêu cầu gia hạn và trạng thái của từng yêu cầu. */
export function ExtensionsCard({ bookingId, extensions, onChanged }: { bookingId: string; extensions: ShiftExtension[]; onChanged: () => void }) {
  if (extensions.length === 0) return null;
  return (
    <section className="card step-card bt-card" aria-labelledby="bt-ext">
      <h3 id="bt-ext" className="step-card__title"><Hourglass size={18} aria-hidden="true" /> Gia hạn ca</h3>
      <ul className="bt-exts">
        {extensions.map((e) => <Row key={e.id} bookingId={bookingId} ext={e} onChanged={onChanged} />)}
      </ul>
    </section>
  );
}
