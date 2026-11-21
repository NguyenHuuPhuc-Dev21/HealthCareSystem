import { useEffect, useState } from 'react';
import { Alert, Button, Modal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { PricingCard } from '../../booking/components/PricingCard';
import { quoteExtension, requestExtension } from '../booking-tracking.api';
import type { ExtendQuote, ShiftExtension } from '../booking-tracking.types';
import { MAX_EXTENSION_HOURS } from '../booking-tracking.types';

interface ExtendModalProps {
  bookingId: string;
  isOpen: boolean;
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  onClose: () => void;
  onRequested: (ext: ShiftExtension) => void;
}

/** Gia hạn ca theo bội số 1 giờ (FR-SHIFT-03). Chuyển khoản: nạp thêm vào escrow; tiền mặt: cộng vào hoá đơn cuối ca. */
export function ExtendModal({ bookingId, isOpen, paymentMethod, onClose, onRequested }: ExtendModalProps) {
  const [hours, setHours] = useState(1);
  const [quote, setQuote] = useState<{ state: 'loading' | 'error' | 'ready'; data?: ExtendQuote; message?: string }>({ state: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setQuote({ state: 'loading' });
    quoteExtension(bookingId, hours).then((res) => {
      if (cancelled) return;
      setQuote(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Chưa tính được giá gia hạn.') });
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId, hours, isOpen]);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen, hours]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const res = await requestExtension(bookingId, hours);
    setSubmitting(false);
    if (!res.success) {
      setError(getErrorMessage(res.error, 'Chưa gửi được yêu cầu gia hạn.'));
      return;
    }
    onRequested(res.data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gia hạn ca" subtitle="Chọn số giờ muốn thêm — điều dưỡng cần đồng ý và không vướng ca kế tiếp." maxWidth={560}>
      <div className="field">
        <span className="field-label">Số giờ gia hạn</span>
        <div className="chip-select" role="group" aria-label="Số giờ gia hạn">
          {Array.from({ length: MAX_EXTENSION_HOURS }, (_, i) => i + 1).map((h) => (
            <button key={h} type="button" className={hours === h ? 'selected' : ''} aria-pressed={hours === h} onClick={() => setHours(h)} disabled={submitting}>
              +{h} giờ
            </button>
          ))}
        </div>
      </div>

      {quote.state === 'loading' && <p className="skeleton">Đang tính giá…</p>}
      {quote.state === 'error' && <Alert title={quote.message} />}
      {quote.state === 'ready' && quote.data && <PricingCard quote={quote.data} perHour />}

      <Alert tone="info" title={paymentMethod === 'BANK_TRANSFER' ? 'Nạp thêm vào escrow' : 'Thanh toán cuối ca'}>
        {paymentMethod === 'BANK_TRANSFER'
          ? 'Bạn chuyển thêm khoản này để được tạm giữ an toàn; gia hạn chỉ có hiệu lực sau khi nhận tiền và điều dưỡng đồng ý.'
          : 'Khoản gia hạn được cộng vào hoá đơn tiền mặt thanh toán cho điều dưỡng khi kết thúc ca.'}
      </Alert>

      {error && <Alert title={error} />}

      <div className="step-card__actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Để sau</Button>
        <Button type="button" onClick={submit} loading={submitting} disabled={quote.state !== 'ready'}>Gửi yêu cầu gia hạn</Button>
      </div>
    </Modal>
  );
}
