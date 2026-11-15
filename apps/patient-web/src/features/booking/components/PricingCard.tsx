import { Info } from 'lucide-react';
import { formatVND } from '../../../lib/formatters';
import type { PricingQuote } from '../booking.types';

interface PricingCardProps {
  quote: PricingQuote;
  /** Ca theo giờ thì hiện "x giờ" cạnh tiền cơ bản */
  perHour?: boolean;
}

/**
 * Bảng giá minh bạch (FR-BOOK-01): tiền cơ bản + phụ phí đêm/lễ/bệnh nhân nặng = tổng.
 * Số liệu do backend tính; dòng "phí nền tảng" chỉ để minh bạch — đã nằm trong tổng, không cộng thêm.
 */
export function PricingCard({ quote, perHour }: PricingCardProps) {
  const rows: Array<{ label: string; note?: string; amount: number; show: boolean }> = [
    { label: 'Tiền dịch vụ', note: perHour ? `${quote.hours} giờ` : undefined, amount: quote.baseAmount, show: true },
    { label: 'Phụ phí ca đêm (+20%)', note: `${quote.nightHours} giờ trong 22:00–06:00`, amount: quote.nightSurcharge, show: quote.nightSurcharge > 0 },
    { label: 'Phụ phí ngày lễ', note: quote.holidayName ?? undefined, amount: quote.holidaySurcharge, show: quote.holidaySurcharge > 0 },
    { label: 'Phụ phí bệnh nhân nặng (+15%)', note: 'Từ 80 kg hoặc nằm tại giường', amount: quote.heavyPatientSurcharge, show: quote.heavyPatientSurcharge > 0 },
  ];

  return (
    <section className="card bk-price" aria-label="Chi tiết giá">
      <h3 className="step-card__title">Chi tiết giá</h3>
      <dl className="bk-price__rows">
        {rows.filter((r) => r.show).map((r) => (
          <div key={r.label} className="bk-price__row">
            <dt>
              {r.label}
              {r.note && <small>{r.note}</small>}
            </dt>
            <dd>{formatVND(r.amount)}</dd>
          </div>
        ))}
        <div className="bk-price__row bk-price__row--total">
          <dt>Tổng thanh toán</dt>
          <dd>{formatVND(quote.totalAmount)}</dd>
        </div>
        <div className="bk-price__row bk-price__row--info">
          <dt>
            Phí nền tảng ({Math.round(quote.platformFeeRate * 100)}%)
            <small>Đã bao gồm trong tổng, trừ vào thu nhập điều dưỡng khi quyết toán</small>
          </dt>
          <dd>{formatVND(quote.platformFee)}</dd>
        </div>
      </dl>
      <p className="bk-price__foot">
        <Info size={14} aria-hidden="true" /> Giá do hệ thống tính theo bảng giá hiện hành. Bạn không phải trả thêm khoản nào ngoài tổng thanh toán.
      </p>
    </section>
  );
}
