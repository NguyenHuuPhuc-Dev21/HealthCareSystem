import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface FormModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Đang gửi: khoá nút đóng và phím Esc để không bỏ dở thao tác */
  busy?: boolean;
  wide?: boolean;
}

/** Hộp thoại biểu mẫu (nội dung cuộn được). Esc hoặc bấm nền để đóng. */
export function FormModal({ title, subtitle, onClose, children, busy = false, wide = false }: FormModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`modal modal--form${wide ? ' modal--wide' : ''}`}>
        <div className="modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="modal__close" aria-label="Đóng" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
