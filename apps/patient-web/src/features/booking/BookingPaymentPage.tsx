import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Copy, QrCode, TimerOff } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { formatMmSs, useCountdown } from '../auth/useCountdown';
import { getBooking, simulatePaymentForMock } from './booking.api';
import type { Booking } from './booking.types';

const TOTAL_SECONDS = 15 * 60; // PAYMENT_TIMEOUT_MINUTES
const POLL_MS = 4000;
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; booking: Booking };

/** Màn chờ thanh toán: đồng hồ đếm ngược 15 phút (thời gian giữ chỗ) và tự cập nhật khi cổng thanh toán xác nhận. */
export function BookingPaymentPage() {
  const { id = '' } = useParams();
  const { user, signOut } = useAuth();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [simulating, setSimulating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await getBooking(id);
    setLoad((prev) =>
      res.success
        ? { state: 'ready', booking: res.data }
        : prev.state === 'ready' ? prev : { state: 'error', message: getErrorMessage(res.error, 'Không tải được thông tin ca.') },
    );
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const booking = load.state === 'ready' ? load.booking : null;
  const waiting = booking?.executionStatus === 'DRAFT';

  // Hỏi lại trạng thái định kỳ khi còn chờ — webhook cổng thanh toán xử lý ở backend
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting, refresh]);

  const expiresMs = booking?.paymentExpiresAt ? Date.parse(booking.paymentExpiresAt) : 0;
  const secondsLeft = useCountdown(expiresMs);

  // Hết giờ: hỏi backend để lấy trạng thái chính thức (EXPIRED)
  useEffect(() => {
    if (waiting && expiresMs && secondsLeft === 0) refresh();
  }, [waiting, expiresMs, secondsLeft, refresh]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* trình duyệt chặn clipboard — bỏ qua */
    }
  };

  const simulate = async () => {
    setSimulating(true);
    await simulatePaymentForMock(id);
    setSimulating(false);
    refresh();
  };

  const body = () => {
    if (load.state === 'loading') return <div className="card step-card skeleton">Đang tải…</div>;
    if (load.state === 'error') return <Alert title={load.message} />;
    const b = load.booking;

    if (b.paymentStatus === 'ESCROW_HELD') {
      return (
        <section className="card step-card bk-pay bk-pay--ok" aria-live="polite">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h2>Đã nhận thanh toán</h2>
          <p>Số tiền {formatVND(b.pricing.totalAmount)} đang được tạm giữ an toàn. Chúng tôi đang {b.invitedNurse ? `chuyển lời mời tới điều dưỡng ${b.invitedNurse.fullName}` : 'tìm điều dưỡng phù hợp cho bạn'}.</p>
          <Link to="/bookings" className="btn btn-primary btn-lg">Xem đơn của tôi</Link>
        </section>
      );
    }

    if (b.executionStatus === 'EXPIRED' || b.executionStatus === 'CANCELLED') {
      return (
        <section className="card step-card bk-pay bk-pay--expired" aria-live="polite">
          <TimerOff size={44} aria-hidden="true" />
          <h2>Ca đã hết hạn thanh toán</h2>
          <p>Ca {b.code} không được thanh toán trong 15 phút nên đã tự huỷ. Chưa có khoản tiền nào bị trừ.</p>
          <Link to="/bookings/new" className="btn btn-primary btn-lg">Đặt ca mới</Link>
        </section>
      );
    }

    const pct = Math.max(0, Math.min(100, (secondsLeft / TOTAL_SECONDS) * 100));
    const bank = b.bankTransfer;
    return (
      <>
        <section className="card step-card bk-pay" aria-live="off">
          <p className="bk-pay__label">Hoàn tất thanh toán trong</p>
          <div className={`bk-timer${secondsLeft <= 120 ? ' bk-timer--low' : ''}`} role="timer" aria-label={`Còn ${formatMmSs(secondsLeft)}`}>
            {formatMmSs(secondsLeft)}
          </div>
          <div className="bk-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <p className="step-card__sub">Quá thời gian này, ca sẽ tự huỷ và bạn cần đặt lại.</p>
        </section>

        <section className="card step-card bk-bank" aria-labelledby="bank-title">
          <h3 id="bank-title" className="step-card__title">Chuyển khoản {formatVND(b.pricing.totalAmount)}</h3>
          <div className="bk-bank__grid">
            <div className="bk-qr" role="img" aria-label="Mã QR chuyển khoản (mô phỏng)">
              <QrCode size={96} aria-hidden="true" />
              <small>Mã VietQR sẽ hiển thị ở đây khi nối cổng thanh toán</small>
            </div>
            {bank && (
              <dl className="bk-summary">
                {([
                  ['Ngân hàng', bank.bankName],
                  ['Số tài khoản', bank.accountNumber],
                  ['Chủ tài khoản', bank.accountName],
                  ['Số tiền', String(b.pricing.totalAmount)],
                  ['Nội dung chuyển khoản', bank.transferContent],
                ] as const).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {label === 'Số tiền' ? formatVND(b.pricing.totalAmount) : value}
                      {(label === 'Số tài khoản' || label === 'Nội dung chuyển khoản' || label === 'Số tiền') && (
                        <button type="button" className="icon-btn bk-copy" aria-label={`Sao chép ${label}`} onClick={() => copy(label, value)}>
                          {copied === label ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <Alert tone="info" title="Nhập đúng nội dung chuyển khoản.">Hệ thống tự xác nhận khi nhận được tiền — bạn không cần bấm gì thêm, trang này sẽ tự cập nhật.</Alert>
          {USE_MOCK && (
            <div className="bk-mock">
              <span>Chỉ có khi chạy dữ liệu giả:</span>
              <Button type="button" variant="secondary" size="sm" onClick={simulate} loading={simulating}>Giả lập: cổng thanh toán đã nhận tiền</Button>
            </div>
          )}
        </section>
      </>
    );
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head">
        <h1>Thanh toán ca {booking?.code ?? ''}</h1>
        {booking && <p>{booking.serviceLabel} · {booking.patientName} · {formatDateTime(booking.startAt)}</p>}
      </div>
      <div className="bk-narrow">{body()}</div>
    </PatientLayout>
  );
}
