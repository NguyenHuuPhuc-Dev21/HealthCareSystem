import React, { useId, useState } from 'react';
import { AlertCircle, AlertTriangle, Send, ShieldAlert } from 'lucide-react';
import { DisputeCategory, OpenDisputeInput } from '@healthcare-system/shared';
import { Modal, ModalCloseButton } from '../../../components';
import { EvidenceUploader, SelectedEvidenceFile } from './EvidenceUploader';
import { openDispute } from '../disputes.api';

export interface OpenDisputeModalProps {
  bookingId: string;
  bookingCode: string;
  patientName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (disputeId: string) => void;
}

const CATEGORY_LABELS: Record<DisputeCategory, { title: string; desc: string }> = {
  UNPROFESSIONAL_CONDUCT: {
    title: 'Hành vi xúc phạm / Môi trường nguy hiểm',
    desc: 'Người nhà hoặc bệnh nhân có hành vi bạo lực, xúc phạm danh dự, hoặc môi trường làm việc mất an toàn.',
  },
  CLINICAL_PROTOCOL_VIOLATION: {
    title: 'Bắt làm việc ngoài phạm vi chuyên môn',
    desc: 'Gia đình ép buộc thực hiện các thủ thuật không có chỉ định y khoa hoặc việc gia đình ngoài hợp đồng.',
  },
  FALSE_CLINICAL_DECLARATION: {
    title: 'Khai báo sai tình trạng người bệnh',
    desc: 'Tình trạng thực tế khác biệt nghiêm trọng so với hồ sơ ban đầu (ví dụ bệnh truyền nhiễm cấp tính không báo trước).',
  },
  PREMATURE_ABANDONMENT: {
    title: 'Khách hàng hủy ngang ca bất hợp lý',
    desc: 'Gia đình cho điều dưỡng về sớm vô cớ nhưng sau đó khiếu nại hoặc từ chối xác nhận ca.',
  },
};

export const OpenDisputeModal: React.FC<OpenDisputeModalProps> = ({
  bookingId,
  bookingCode,
  patientName,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const titleId = useId();

  const [category, setCategory] = useState<DisputeCategory>('UNPROFESSIONAL_CONDUCT');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<SelectedEvidenceFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = description.trim();
    if (trimmed.length < 20) {
      setErrorMessage('Mô tả khiếu nại phải có tối thiểu 20 ký tự để làm rõ sự việc.');
      return;
    }

    if (trimmed.length > 1000) {
      setErrorMessage('Mô tả khiếu nại không được vượt quá 1000 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const evidenceUrls = files.map((f) => f.previewUrl);
      const input: OpenDisputeInput = {
        category,
        description: trimmed,
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      };

      const res = await openDispute(bookingId, input);
      if (res.success && res.data) {
        onSuccess(res.data.dispute_id);
      } else {
        setErrorMessage(res.error?.message || 'Không thể tạo khiếu nại. Vui lòng thử lại.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối khi gửi khiếu nại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} titleId={titleId} maxWidth={600}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
          borderBottom: '1px solid var(--border-hairline)',
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={22} color="var(--alert-crimson)" aria-hidden="true" />
            <h2
              id={titleId}
              className="font-display"
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: 'var(--ink-primary)',
              }}
            >
              Mở khiếu nại ca trực
            </h2>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--ink-secondary)' }}>
            Mã ca: <b className="tabular-nums">{bookingCode}</b>
            {patientName && (
              <span>
                {' '}
                · Người bệnh: <b>{patientName}</b>
              </span>
            )}
          </p>
        </div>
        <ModalCloseButton onClick={onClose} />
      </div>

      {/* Warning banner */}
      <div
        role="note"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          background: 'var(--accent-ochre-soft)',
          border: '1px solid var(--accent-ochre)',
          color: '#78350F',
          fontSize: 13,
          lineHeight: 1.45,
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <div>
          <b>Lưu ý quan trọng:</b> Khi khiếu nại được tạo, việc quyết toán thù lao cho ca trực này sẽ
          được <b>tạm dừng đóng băng</b> để bảo vệ các bên cho tới khi Ban quản trị CareNest hoàn
          tất phân xử.
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            fontSize: 13.5,
            marginBottom: 14,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. Chọn loại khiếu nại */}
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="dispute-category-select"
            style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink-primary)',
              marginBottom: 6,
            }}
          >
            Lý do khiếu nại <span style={{ color: 'var(--alert-crimson)' }}>*</span>
          </label>
          <select
            id="dispute-category-select"
            value={category}
            onChange={(e) => setCategory(e.target.value as DisputeCategory)}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--border-hairline)',
              fontSize: 14,
              fontFamily: 'inherit',
              background: 'var(--surface-paper)',
              color: 'var(--ink-primary)',
            }}
          >
            {(Object.keys(CATEGORY_LABELS) as DisputeCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat].title}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 12.5, color: 'var(--ink-muted)', marginTop: 4 }}>
            {CATEGORY_LABELS[category].desc}
          </div>
        </div>

        {/* 2. Mô tả chi tiết */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <label
              htmlFor="dispute-description-input"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}
            >
              Mô tả chi tiết sự việc <span style={{ color: 'var(--alert-crimson)' }}>*</span>
            </label>
            <span
              className="tabular-nums"
              style={{
                fontSize: 12,
                color: description.length > 1000 ? 'var(--alert-crimson)' : 'var(--ink-muted)',
              }}
            >
              {description.length} / 1000
            </span>
          </div>

          <textarea
            id="dispute-description-input"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            maxLength={1000}
            placeholder="Mô tả cụ thể thời gian, diễn biến sự việc, hành vi vi phạm (tối thiểu 20 ký tự)..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1.5px solid var(--border-hairline)',
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
        </div>

        {/* 3. Tải lên bằng chứng */}
        <div style={{ marginBottom: 20 }}>
          <EvidenceUploader files={files} onChange={setFiles} disabled={submitting} maxFiles={5} />
        </div>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            borderTop: '1px solid var(--border-hairline)',
            paddingTop: 14,
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || description.trim().length < 20}
            style={{
              background: 'var(--alert-crimson)',
              borderColor: 'var(--alert-crimson)',
              color: '#fff',
            }}
          >
            <Send size={15} aria-hidden="true" />
            <span>{submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
