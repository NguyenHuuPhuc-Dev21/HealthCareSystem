import React, { useState } from 'react';
import { AlertCircle, Camera, X } from 'lucide-react';
import type { DepositPenaltyDto } from '@healthcare-system/shared';
import { formatVND } from '../../../lib/formatters';
import { PENALTY_REASON_LABELS } from '../deposit-labels';

export interface AppealPenaltyModalProps {
  penalty: DepositPenaltyDto;
  onClose: () => void;
  onSubmit: (reason: string, evidenceKeys?: string[]) => Promise<void>;
}

export const AppealPenaltyModal: React.FC<AppealPenaltyModalProps> = ({
  penalty,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [evidenceFiles, setEvidenceFiles] = useState<{ id: string; name: string }[]>([]);

  const isReasonValid = reason.trim().length >= 20;

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (evidenceFiles.length + files.length > 3) {
      setErrorMessage('Chỉ được đính kèm tối đa 3 tệp bằng chứng');
      return;
    }

    const newFiles: { id: string; name: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      newFiles.push({
        id: `ev-${Date.now()}-${i}`,
        name: files[i].name,
      });
    }
    setEvidenceFiles((prev) => [...prev, ...newFiles]);
    setErrorMessage(null);
  };

  const handleRemoveFile = (id: string) => {
    setEvidenceFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReasonValid || submitting) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      await onSubmit(
        reason.trim(),
        evidenceFiles.map((f) => f.id)
      );
      onClose();
    } catch (err: any) {
      if (err.code === 'APPEAL_WINDOW_CLOSED') {
        setErrorMessage('Khoản phạt này đã hết hạn khiếu nại (quá 3 ngày theo quy định).');
      } else {
        setErrorMessage(err.message || 'Lỗi gửi khiếu nại. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(15, 23, 42, 0.65)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-modal-title"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#ffffff',
          borderRadius: 18,
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            color: 'var(--text-secondary, #64748B)',
          }}
          aria-label="Đóng modal"
        >
          <X size={22} />
        </button>

        <h3
          id="appeal-modal-title"
          style={{ fontSize: '20px', fontWeight: 900, color: 'var(--navy, #0F172A)', margin: '0 0 8px' }}
        >
          Khiếu nại khoản trừ ký quỹ
        </h3>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary, #64748B)', margin: '0 0 16px' }}>
          Yêu cầu sẽ được chuyển đến Admin thẩm tra. Nếu khiếu nại được chấp thuận, số tiền phạt sẽ được hoàn trả đầy đủ
          vào ký quỹ.
        </p>

        {/* Thông tin khoản phạt bị trừ */}
        <div
          style={{
            padding: '12px 14px',
            background: 'var(--surface-subtle, #F8FAFC)',
            borderRadius: 12,
            border: '1px solid var(--border-hairline, #E2E8F0)',
            marginBottom: 18,
            fontSize: '14px',
            color: 'var(--navy, #0F172A)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary, #64748B)' }}>Lý do phạt:</span>
            <b>{PENALTY_REASON_LABELS[penalty.reason] || penalty.reason}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-secondary, #64748B)' }}>Mã đơn liên quan:</span>
            <b>{penalty.bookingCode || 'Không có'}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary, #64748B)' }}>Số tiền trừ:</span>
            <b style={{ color: '#DC2626' }}>-{formatVND(penalty.amount)}</b>
          </div>
        </div>

        {errorMessage && (
          <div
            style={{
              padding: '10px 14px',
              background: '#FEF2F2',
              color: '#DC2626',
              borderRadius: 8,
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Ô nhập lý do */}
          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
              <span>Lý do khiếu nại (bắt buộc tối thiểu 20 ký tự)</span>
              <span style={{ color: isReasonValid ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                {reason.trim().length} / 20
              </span>
            </label>
            <textarea
              className="input"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Trình bày rõ lý do khách quan (sự cố bất khả kháng, có xác nhận từ bệnh viện hoặc khách hàng)..."
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '15px',
                borderRadius: 10,
                marginTop: 6,
              }}
            />
          </div>

          {/* Đính kèm bằng chứng */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
              Ảnh minh chứng (tối đa 3 ảnh)
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {evidenceFiles.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    background: '#F1F5F9',
                    borderRadius: 8,
                    fontSize: '13px',
                    maxWidth: 160,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(f.id)}
                    style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} color="#64748B" />
                  </button>
                </div>
              ))}

              {evidenceFiles.length < 3 && (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: '#ffffff',
                    border: '1px dashed var(--border-hairline, #CBD5E1)',
                    borderRadius: 8,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--brand-jade, #166B58)',
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={16} />
                  <span>Chọn ảnh</span>
                  <input type="file" accept="image/*" onChange={handleFakeUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 18px', fontSize: '14.5px', borderRadius: 10 }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isReasonValid || submitting}
              style={{
                padding: '8px 22px',
                fontSize: '14.5px',
                fontWeight: 800,
                borderRadius: 10,
              }}
            >
              {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
