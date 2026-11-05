import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  maxWidth?: string | number;
}

/**
 * Hộp thoại Modal lớp phủ đa dụng (thay thế/mở rộng ConfirmDialog).
 * Tự động khóa cuộn trang, hỗ trợ phím Escape và click ngoài backdrop để đóng.
 */
export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 640 }: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop modal-backdrop--form"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" style={{ maxWidth }} ref={contentRef}>
        <div className="modal-card__header">
          <div>
            <h3 className="modal-card__title">{title}</h3>
            {subtitle && <p className="modal-card__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="modal-card__close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}
