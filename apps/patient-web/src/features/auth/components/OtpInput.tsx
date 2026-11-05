import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * 6 ô nhập OTP: tự nhảy ô, Backspace lùi ô, dán cả mã 6 số,
 * autoComplete="one-time-code" để điện thoại gợi ý mã từ SMS.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  invalid = false,
  autoFocus = false,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const focusAt = (index: number) => {
    const target = refs.current[Math.max(0, Math.min(length - 1, index))];
    target?.focus();
    target?.select();
  };

  const setDigitAt = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join('').slice(0, length));
  };

  const handleInput = (index: number, raw: string) => {
    const only = raw.replace(/\D/g, '');
    if (!only) return;
    if (only.length > 1) {
      // Bàn phím / trình duyệt điền nhiều số cùng lúc (autofill)
      const merged = (value.slice(0, index) + only).slice(0, length);
      onChange(merged);
      focusAt(merged.length);
      return;
    }
    setDigitAt(index, only);
    focusAt(index + 1);
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[index]) {
        setDigitAt(index, '');
      } else if (index > 0) {
        setDigitAt(index - 1, '');
        focusAt(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    focusAt(pasted.length);
  };

  return (
    <div className="otp-row" role="group" aria-label="Mã OTP 6 chữ số">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={invalid ? 'is-invalid' : undefined}
          value={digit}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          disabled={disabled}
          aria-label={`Chữ số thứ ${i + 1}`}
          aria-invalid={invalid}
        />
      ))}
    </div>
  );
}
