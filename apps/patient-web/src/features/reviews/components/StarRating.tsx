import { useState } from 'react';
import { Star } from 'lucide-react';
import { RATING_TEXT } from '../reviews.api';

interface StarRatingProps {
  value: number;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

/** Chọn 1–5 sao: dùng được bằng bàn phím (mũi tên) và đọc được bằng trình đọc màn hình (radiogroup). */
export function StarRating({ value, onChange, disabled }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, (value || 0) + 1) as 1 | 2 | 3 | 4 | 5);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(1, (value || 2) - 1) as 1 | 2 | 3 | 4 | 5);
    }
  };

  return (
    <div className="stars">
      <div className="stars__row" role="radiogroup" aria-label="Điểm đánh giá" onKeyDown={onKey} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sao — ${RATING_TEXT[n]}`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            className={`stars__star${n <= shown ? ' is-on' : ''}`}
            onClick={() => onChange(n as 1 | 2 | 3 | 4 | 5)}
            onMouseEnter={() => !disabled && setHover(n)}
            disabled={disabled}
          >
            <Star size={34} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="stars__text" aria-live="polite">{shown ? RATING_TEXT[shown] : 'Chạm vào sao để đánh giá'}</p>
    </div>
  );
}
