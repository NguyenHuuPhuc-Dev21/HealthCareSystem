import { Link } from 'react-router-dom';
import { Check, Lock, Wallet } from 'lucide-react';
import { formatDateTime, formatVND } from '../../../lib/formatters';
import type { Booking } from '../../booking/booking.types';

type EscrowBooking = Pick<Booking, 'paymentMethod' | 'paymentStatus' | 'executionStatus' | 'disputeStatus' | 'escrow'> & {
  totalAmount: number;
};

interface EscrowIndicatorProps {
  booking: EscrowBooking;
  /** Dạng gọn (một dòng) cho danh sách đơn */
  compact?: boolean;
}

const STEPS = ['Đã nạp tiền', 'Đang tạm giữ', 'Giải ngân'] as const;

/**
 * Chỉ báo "tiền đang được nền tảng tạm giữ" cho đơn chuyển khoản trả trước (FR-PAY-01/02, BR-04).
 * Đơn tiền mặt không có escrow nên không hiển thị gì.
 */
export function EscrowIndicator({ booking, compact }: EscrowIndicatorProps) {
  if (booking.paymentMethod !== 'BANK_TRANSFER') return null;

  const { paymentStatus: pay, executionStatus: exec, disputeStatus: dispute, escrow } = booking;
  if (pay === 'UNPAID' && (exec === 'EXPIRED' || exec === 'CANCELLED')) return null;

  const frozen = escrow?.frozenByDispute || dispute === 'OPEN' || dispute === 'UNDER_REVIEW';
  const held = pay === 'ESCROW_HELD';
  const amount = escrow?.heldAmount ?? booking.totalAmount;

  let title: string;
  let detail: string;
  let step: 0 | 1 | 2;
  if (pay === 'UNPAID') {
    title = 'Chưa nạp tiền';
    detail = 'Hoàn tất chuyển khoản để tiền được tạm giữ an toàn — điều dưỡng chỉ nhận tiền sau khi ca hoàn thành.';
    step = 0;
  } else if (held && frozen) {
    title = `Đang tạm giữ ${formatVND(amount)} · đóng băng do khiếu nại`;
    detail = 'Khoản tiền không được giải ngân trong lúc Admin xem xét khiếu nại.';
    step = 1;
  } else if (held) {
    title = `Đang tạm giữ ${formatVND(amount)}`;
    detail =
      exec === 'COMPLETED' && escrow?.releaseAt
        ? `Tự giải ngân cho điều dưỡng lúc ${formatDateTime(escrow.releaseAt)} (24 giờ sau check-out) hoặc khi bạn xác nhận hoàn thành. Có khiếu nại thì giữ lại.`
        : 'Nền tảng giữ khoản này cho tới khi ca hoàn thành; điều dưỡng chưa nhận được tiền.';
    step = 1;
  } else if (pay === 'SETTLED' || pay === 'PARTIALLY_SETTLED') {
    title = 'Đã giải ngân cho điều dưỡng';
    detail = 'Ca đã quyết toán xong, không còn khoản nào đang tạm giữ.';
    step = 2;
  } else {
    title = 'Đã hoàn tiền';
    detail = 'Khoản tiền đã được hoàn về cho bạn.';
    step = 2;
  }

  if (compact) {
    return (
      <p className="esc-compact" title={detail}>
        {pay === 'REFUNDED' ? (
          <Link to="/refunds">Đã hoàn tiền · xem chi tiết</Link>
        ) : (
          <>
            <Lock size={13} aria-hidden="true" /> {title}
          </>
        )}
      </p>
    );
  }

  return (
    <section className={`card esc${frozen && held ? ' esc--frozen' : ''}`} aria-label="Tiền đang tạm giữ (escrow)">
      <div className="esc__head">
        <span className="esc__icon" aria-hidden="true">{step === 2 ? <Wallet size={20} /> : <Lock size={20} />}</span>
        <div>
          <b>{title}</b>
          <p>{detail}</p>
        </div>
      </div>
      <ol className="esc__steps" aria-label="Tiến trình tiền">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'done' : i === step ? 'now' : ''} aria-current={i === step ? 'step' : undefined}>
            <span aria-hidden="true">{i < step ? <Check size={13} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {pay === 'REFUNDED' && <Link to="/refunds" className="link-strong">Xem chi tiết hoàn tiền →</Link>}
    </section>
  );
}
