import React, { useState } from 'react';
import { Star } from 'lucide-react';

export interface StarInputProps {
  value: number; // 0..5
  onChange: (rating: 1 | 2 | 3 | 4 | 5) => void;
  disabled?: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Rất không hài lòng (Sự cố / Khó phối hợp)',
  2: 'Chưa hài lòng (Khó phối hợp)',
  3: 'Bình thường (Đúng thỏa thuận)',
  4: 'Hài lòng (Gia đình hỗ trợ tốt)',
  5: 'Rất hài lòng (Chu đáo, tuyệt vời)',
};

export const StarInput: React.FC<StarInputProps> = ({ value, onChange, disabled = false }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const activeValue = hoverValue ?? value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(5, (value || 0) + 1) as 1 | 2 | 3 | 4 | 5;
      onChange(next);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const prev = Math.max(1, (value || 1) - 1) as 1 | 2 | 3 | 4 | 5;
      onChange(prev);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(5);
    }
  };

  return (
    <div style={{ textAlign: 'center', margin: '14px 0 20px' }}>
      <div
        role="radiogroup"
        aria-label="Đánh giá từ 1 đến 5 sao"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '6px 12px',
          borderRadius: 14,
          background: 'var(--surface-canvas)',
          border: '1px solid var(--border-hairline)',
        }}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeValue;

          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} trên 5 sao`}
              disabled={disabled}
              onClick={() => onChange(star as 1 | 2 | 3 | 4 | 5)}
              onMouseEnter={() => setHoverValue(star)}
              onMouseLeave={() => setHoverValue(null)}
              style={{
                width: 52,
                height: 52,
                minHeight: 52,
                padding: 0,
                borderRadius: 12,
                border: 'none',
                background: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'grid',
                placeItems: 'center',
                transition: 'transform 0.15s ease, color 0.15s ease',
                transform: star === activeValue ? 'scale(1.15)' : 'scale(1)',
                color: isFilled ? '#F59E0B' : '#D1D5DB',
              }}
            >
              <Star
                size={34}
                fill={isFilled ? '#F59E0B' : 'transparent'}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {/* Descriptive text for chosen rating */}
      <div
        style={{
          marginTop: 10,
          minHeight: 24,
          fontSize: 15,
          fontWeight: 600,
          color:
            activeValue > 0
              ? activeValue <= 2
                ? 'var(--alert-crimson)'
                : activeValue === 3
                ? 'var(--accent-ochre)'
                : 'var(--brand-jade)'
              : 'var(--ink-muted)',
          transition: 'color 0.15s ease',
        }}
      >
        {activeValue > 0 ? RATING_LABELS[activeValue] : 'Chọn số sao để đánh giá'}
      </div>
    </div>
  );
};
