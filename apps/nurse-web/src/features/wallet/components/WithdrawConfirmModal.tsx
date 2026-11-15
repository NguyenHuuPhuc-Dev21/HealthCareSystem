import React, { useEffect, useState } from 'react';
import { AlertCircle, Building2, CheckCircle, Loader2 } from 'lucide-react';
import type { BankAccountDto } from '@healthcare-system/shared';
import { Button, Modal, ModalCloseButton } from '../../../components';
import { formatVND } from '../../../lib/formatters';

export interface WithdrawConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void>;
  amount: number;
  bankAccount: BankAccountDto | null;
  availableBalance: number;
  loading: boolean;
  errorMessage?: string | null;
}

export const WithdrawConfirmModal: React.FC<WithdrawConfirmModalProps> = ({
  open,
  onClose,
  onConfirm,
  amount,
  bankAccount,
  availableBalance,
  loading,
  errorMessage,
}) => {
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Generate new idempotencyKey whenever the modal opens
  useEffect(() => {
    if (open) {
      const generatedKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      setIdempotencyKey(generatedKey);
    }
  }, [open]);

  if (!open) return null;

  const remainingBalance = Math.max(0, availableBalance - amount);

  const handleConfirm = async () => {
    if (loading || !idempotencyKey) return;
    await onConfirm(idempotencyKey);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      titleId="withdraw-modal-title"
      ariaLabel="Xác nhận yêu cầu rút tiền"
      maxWidth={520}
      closeOnBackdrop={!loading}
    >
      <div style={{ padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--brand-jade-soft)',
                color: 'var(--brand-jade)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Building2 size={24} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="withdraw-modal-title"
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ink-primary)',
                }}
              >
                Xác nhận yêu cầu rút tiền
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 14.5, color: 'var(--ink-secondary)' }}>
                Vui lòng rà soát kỹ thông tin tài khoản thụ hưởng
              </p>
            </div>
          </div>
          <ModalCloseButton onClick={onClose} label="Đóng cửa sổ xác nhận" />
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--alert-crimson-soft)',
              color: 'var(--alert-crimson)',
              fontSize: 14.5,
              marginBottom: 16,
              border: '1px solid #FECACA',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div
          style={{
            background: 'var(--surface-subtle)',
            borderRadius: 14,
            padding: '20px 22px',
            marginBottom: 18,
            border: '1px solid var(--border-hairline)',
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--ink-muted)',
              marginBottom: 4,
            }}
          >
            Số tiền chuyển khoản
          </div>
          <div
            className="tabular-nums"
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--brand-jade)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {formatVND(amount)}
          </div>
        </div>

        <table className="withdraw-summary-table">
          <tbody>
            <tr>
              <td>Ngân hàng nhận</td>
              <td>{bankAccount?.bankName ?? 'Chưa liên kết'}</td>
            </tr>
            <tr>
              <td>Số tài khoản</td>
              <td className="tabular-nums">{bankAccount?.accountMasked ?? '—'}</td>
            </tr>
            <tr>
              <td>Chủ tài khoản</td>
              <td>{bankAccount?.accountHolder ?? '—'}</td>
            </tr>
            <tr>
              <td>Số dư khả dụng hiện tại</td>
              <td className="tabular-nums">{formatVND(availableBalance)}</td>
            </tr>
            <tr>
              <td>Số dư còn lại dự kiến</td>
              <td className="tabular-nums" style={{ color: 'var(--ink-primary)' }}>
                {formatVND(remainingBalance)}
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 10,
            background: 'var(--brand-jade-soft)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--brand-jade)',
            fontSize: 14,
            marginBottom: 24,
            lineHeight: 1.5,
          }}
        >
          <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
          <div>
            Tiền chuyển trực tiếp về tài khoản chính chủ đã xác thực. Yêu cầu sẽ được chuyển đến bộ
            phận kế toán xét duyệt theo kỳ làm việc.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            style={{ minWidth: 110 }}
          >
            Hủy bỏ
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || !bankAccount}
            style={{ minWidth: 170 }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" aria-hidden="true" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              'Xác nhận rút tiền'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

