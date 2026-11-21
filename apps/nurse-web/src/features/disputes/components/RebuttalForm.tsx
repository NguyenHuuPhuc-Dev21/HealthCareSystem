import React, { useState } from 'react';
import { AlertCircle, Clock, Send, ShieldAlert } from 'lucide-react';
import { EvidenceUploader, SelectedEvidenceFile } from './EvidenceUploader';
import { submitDisputeRebuttal } from '../disputes.api';
import { formatDateTime } from '../../../lib/formatters';

export interface RebuttalFormProps {
  disputeId: string;
  rebuttalDueAt?: string;
  onSuccess: () => void;
}

export const RebuttalForm: React.FC<RebuttalFormProps> = ({
  disputeId,
  rebuttalDueAt,
  onSuccess,
}) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<SelectedEvidenceFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = content.trim();
    if (trimmed.length < 10) {
      setErrorMessage('Nội dung phản hồi cần tối thiểu 10 ký tự.');
      return;
    }

    if (trimmed.length > 1500) {
      setErrorMessage('Nội dung phản hồi không được vượt quá 1500 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      // Giả lập lấy URLs của bằng chứng đã upload (trong môi trường mock/s3)
      const evidenceUrls = files.map((f) => f.previewUrl);
      const res = await submitDisputeRebuttal(disputeId, trimmed, evidenceUrls);

      if (res.success) {
        onSuccess();
      } else {
        setErrorMessage(res.error?.message || 'Không thể gửi phản hồi. Vui lòng thử lại.');
      }
    } catch {
      setErrorMessage('Lỗi kết nối khi gửi phản hồi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '22px 24px',
        border: '1.5px solid var(--accent-ochre)',
        background: 'var(--surface-paper)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <ShieldAlert size={22} color="var(--accent-ochre)" aria-hidden="true" />
        <div>
          <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--ink-primary)' }}>
            Gửi phản hồi giải trình (Rebuttal)
          </h3>
          {rebuttalDueAt && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13,
                color: 'var(--accent-ochre)',
                marginTop: 2,
                fontWeight: 600,
              }}
            >
              <Clock size={14} aria-hidden="true" />
              <span>Hạn chót gửi phản hồi: {formatDateTime(rebuttalDueAt)}</span>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: 'var(--ink-secondary)', margin: '0 0 16px', lineHeight: 1.45 }}>
        Vui lòng trình bày rõ ràng, khách quan các tình tiết diễn ra trong ca trực và đính kèm bằng
        chứng (ảnh chụp phiếu theo dõi, tin nhắn trao đổi, biên lai...) để ban quản trị thẩm tra
        bảo vệ quyền lợi của bạn.
      </p>

      {errorMessage && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--alert-crimson-soft)',
            color: 'var(--alert-crimson)',
            border: '1px solid #FECACA',
            fontSize: 13.5,
            marginBottom: 16,
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
              htmlFor="rebuttal-textarea"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-primary)' }}
            >
              Nội dung giải trình <span style={{ color: 'var(--alert-crimson)' }}>*</span>
            </label>
            <span
              className="tabular-nums"
              style={{
                fontSize: 12.5,
                color: content.length > 1500 ? 'var(--alert-crimson)' : 'var(--ink-muted)',
              }}
            >
              {content.length} / 1500
            </span>
          </div>

          <textarea
            id="rebuttal-textarea"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={submitting}
            maxLength={1500}
            placeholder="Mô tả chi tiết những gì đã diễn ra, quy trình kỹ thuật đã áp dụng, thỏa thuận với người nhà..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1.5px solid var(--border-hairline)',
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
        </div>

        {/* Upload bằng chứng */}
        <div style={{ marginBottom: 20 }}>
          <EvidenceUploader files={files} onChange={setFiles} disabled={submitting} maxFiles={5} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || content.trim().length < 10}
            style={{ minHeight: 42, padding: '0 20px', fontSize: 14.5 }}
          >
            <Send size={16} aria-hidden="true" />
            <span>{submitting ? 'Đang gửi phản hồi...' : 'Gửi văn bản phản hồi'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
