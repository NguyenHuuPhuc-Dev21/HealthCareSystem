import { useEffect, useState } from 'react';
import { Alert, Button, Modal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { formatVND } from '../../../lib/formatters';
import { cancelBooking, getCancelPreview } from '../refunds.api';
import type { CancelPreview, RefundRecord } from '../refunds.types';
import { SCENARIO_TITLE } from '../refunds.types';

interface CancelBookingModalProps {
  bookingId: string | null;
  bookingCode?: string;
  onClose: () => void;
  onCancelled: (refund: RefundRecord | null) => void;
}

type PreviewState = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: CancelPreview };

/** Huỷ ca: cho khách thấy trước phí huỷ và số tiền được hoàn theo ma trận §5.2 (kịch bản 1–3) rồi mới xác nhận. */
export function CancelBookingModal({ bookingId, bookingCode, onClose, onCancelled }: CancelBookingModalProps) {
  const [preview, setPreview] = useState<PreviewState>({ state: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    setPreview({ state: 'loading' });
    setError(null);
    getCancelPreview(bookingId).then((res) => {
      if (cancelled) return;
      setPreview(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Chưa xem được chính sách huỷ của ca này.') });
    });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const confirm = async () => {
    if (!bookingId) return;
    setSubmitting(true);
    setError(null);
    const res = await cancelBooking(bookingId);
    setSubmitting(false);
    if (!res.success) {
      setError(getErrorMessage(res.error, 'Chưa huỷ được ca. Vui lòng thử lại.'));
      return;
    }
    onCancelled(res.data.refund);
  };

  const p = preview.state === 'ready' ? preview.data : null;
  const hasMoney = !!p && p.amountPaid > 0;

  return (
    <Modal isOpen={!!bookingId} onClose={onClose} title={`Huỷ ca ${bookingCode ?? ''}`.trim()} subtitle="Xem trước phí huỷ và số tiền bạn được hoàn." maxWidth={560}>
      {preview.state === 'loading' && <p className="skeleton">Đang tính phí huỷ…</p>}
      {preview.state === 'error' && <Alert title={preview.message} />}

      {p && (
        <>
          <p className="rf-scenario">
            <b>{SCENARIO_TITLE[p.scenario]}</b>
            <span className="ns-muted"> · còn {p.hoursBeforeStart.toString().replace('.', ',')} giờ tới giờ bắt đầu</span>
          </p>

          {hasMoney ? (
            <dl className="rf-lines">
              <div><dt>Số tiền bạn đã trả (đang tạm giữ)</dt><dd>{formatVND(p.amountPaid)}</dd></div>
              <div><dt>Phí huỷ ({p.feePercent}%)</dt><dd>{formatVND(p.amountPaid - p.refundAmount)}</dd></div>
              {p.nurseCompensation > 0 && <div className="rf-sub"><dt>→ Đền bù điều dưỡng giữ lịch</dt><dd>{formatVND(p.nurseCompensation)}</dd></div>}
              {p.platformShare > 0 && <div className="rf-sub"><dt>→ Nền tảng thu</dt><dd>{formatVND(p.platformShare)}</dd></div>}
              <div className="rf-total"><dt>Bạn được hoàn ({p.refundPercent}%)</dt><dd>{formatVND(p.refundAmount)}</dd></div>
            </dl>
          ) : p.paymentMethod === 'CASH' ? (
            <Alert tone="info" title="Đơn tiền mặt không phát sinh hoàn tiền.">
              Bạn chưa trả trước nên không có khoản nào được hoàn; phí huỷ (nếu có) không thu qua hệ thống — ca chỉ được ghi vào lịch sử huỷ của bạn.
            </Alert>
          ) : (
            <Alert tone="info" title="Chưa có khoản tiền nào bị trừ.">Ca chưa được thanh toán nên huỷ không mất phí.</Alert>
          )}

          {hasMoney && <p className="ns-muted rf-note">Tiền hoàn được chuyển về nguồn thanh toán ban đầu; bạn theo dõi tiến độ ở mục "Theo dõi hoàn tiền".</p>}
        </>
      )}

      {error && <Alert title={error} />}

      <div className="step-card__actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Giữ ca</Button>
        <Button variant="danger" type="button" onClick={confirm} loading={submitting} disabled={!p}>Xác nhận huỷ ca</Button>
      </div>
    </Modal>
  );
}
