import { Banknote, Landmark } from 'lucide-react';
import type { PaymentMethod } from '../booking.types';

interface PaymentMethodSelectorProps {
  value: PaymentMethod | null;
  onChange: (m: PaymentMethod) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: PaymentMethod; icon: React.ReactNode; title: string; description: string }> = [
  {
    value: 'BANK_TRANSFER',
    icon: <Landmark size={22} />,
    title: 'Chuyển khoản trả trước (tạm giữ an toàn)',
    description:
      'Thanh toán 100% trong 15 phút. Tiền được tạm giữ và chỉ chuyển cho điều dưỡng sau khi ca hoàn thành. Hoàn tiền nếu không tìm được điều dưỡng.',
  },
  {
    value: 'CASH',
    icon: <Banknote size={22} />,
    title: 'Tiền mặt tại nhà',
    description: 'Thanh toán trực tiếp cho điều dưỡng khi kết thúc ca. Không cần trả trước.',
  },
];

/** Chọn phương thức thanh toán (FR-BOOK-01): chuyển khoản (escrow) hoặc tiền mặt. */
export function PaymentMethodSelector({ value, onChange, disabled }: PaymentMethodSelectorProps) {
  return (
    <fieldset className="card step-card bk-method" disabled={disabled}>
      <legend className="step-card__title">Phương thức thanh toán</legend>
      <div className="bk-choices" role="radiogroup" aria-label="Phương thức thanh toán">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={`choice bk-choice${value === o.value ? ' selected' : ''}`}
            onClick={() => onChange(o.value)}
          >
            <span className="bk-choice__icon" aria-hidden="true">{o.icon}</span>
            <span>
              <h4>{o.title}</h4>
              <p>{o.description}</p>
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
