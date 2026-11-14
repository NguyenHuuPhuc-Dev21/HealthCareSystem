import { DISPUTE_LABEL, EXECUTION_LABEL, PAYMENT_LABEL } from '../booking.types';
import type { Booking } from '../booking.types';

type Axes = Pick<Booking, 'executionStatus' | 'paymentStatus' | 'disputeStatus'>;

/**
 * 3 huy hiệu trạng thái độc lập (SRS §2.2): thực hiện · thanh toán · khiếu nại.
 * Ba trục không suy ra nhau (vd. đã hoàn thành nhưng đang khiếu nại, tiền vẫn tạm giữ).
 */
export function StatusBadges({ booking }: { booking: Axes }) {
  const exec = EXECUTION_LABEL[booking.executionStatus];
  const pay = PAYMENT_LABEL[booking.paymentStatus];
  const dispute = DISPUTE_LABEL[booking.disputeStatus];

  return (
    <ul className="bk-badges" aria-label="Trạng thái ca">
      <li><span className="bk-badges__axis">Thực hiện</span><span className={`chip ${exec.tone}`}>{exec.text}</span></li>
      <li><span className="bk-badges__axis">Thanh toán</span><span className={`chip ${pay.tone}`}>{pay.text}</span></li>
      <li><span className="bk-badges__axis">Khiếu nại</span><span className={`chip ${dispute.tone}`}>{dispute.text}</span></li>
    </ul>
  );
}
