import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Hộp thoại xác nhận cho thao tác quan trọng (không dùng window.confirm). Esc để đóng. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal">
        <h3 id="confirm-title">{title}</h3>
        <div className="modal-sub">{children}</div>
        <div className="modal-actions">
          <Button ref={cancelRef} variant="secondary" type="button" onClick={onCancel} disabled={busy}>
            Huỷ
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} type="button" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
