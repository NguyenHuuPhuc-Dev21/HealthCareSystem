import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseDialogA11yOptions {
  open: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Shared accessible dialog behavior:
 * - Closes on Escape
 * - Traps Tab / Shift+Tab focus within the dialog container
 * - Locks body scroll while open
 * - Restores focus to the triggering element on close
 */
export function useDialogA11y({ open, onClose, containerRef }: UseDialogA11yOptions): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    const previousFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab' || !containerRef.current) return;
      const focusables = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);

      if (focusables.length === 0) {
        e.preventDefault();
        containerRef.current.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first || !containerRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (!active || active === last || !containerRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocused && typeof previousFocused.focus === 'function') {
        previousFocused.focus();
      }
    };
  }, [open, containerRef]);
}

export interface ModalProps {
  open?: boolean;
  onClose: () => void;
  titleId?: string;
  ariaLabel?: string;
  maxWidth?: number;
  closeOnBackdrop?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  open = true,
  onClose,
  titleId,
  ariaLabel,
  maxWidth = 560,
  closeOnBackdrop = true,
  overlayClassName = 'modal-backdrop',
  panelClassName = 'card modal-panel',
  panelStyle,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useDialogA11y({
    open,
    onClose,
    containerRef: panelRef,
  });

  if (!open) return null;

  return (
    <div
      className={overlayClassName}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-label={ariaLabel}
        tabIndex={-1}
        style={
          panelClassName.includes('job-detail-dialog')
            ? panelStyle
            : { maxWidth, ...panelStyle }
        }
      >
        {children}
      </div>
    </div>
  );
};

export interface ModalCloseButtonProps {
  onClick: () => void;
  label?: string;
}

export const ModalCloseButton: React.FC<ModalCloseButtonProps> = ({
  onClick,
  label = 'Đóng',
}) => (
  <button
    type="button"
    onClick={onClick}
    className="btn btn-secondary modal-close-btn"
    aria-label={label}
    title={label}
  >
    <X size={20} aria-hidden="true" />
  </button>
);

