import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Modal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { openDispute } from '../disputes.api';
import type { OpenDisputeOutcome } from '../disputes.api';
import { CUSTOMER_CATEGORIES, MAX_EVIDENCE_FILES } from '../disputes.types';
import type { DisputeCategory } from '../disputes.types';
import { EvidenceUploader } from './EvidenceUploader';

interface FileDisputeModalProps {
  bookingId: string | null;
  bookingCode?: string;
  onClose: () => void;
  onFiled: (outcome: OpenDisputeOutcome) => void;
}

const MIN_DESC = 10;
const MAX_DESC = 2000;

const CODE_MESSAGE: Record<string, string> = {
  DISPUTE_EXISTS: 'Ca này đã có một khiếu nại đang mở.',
  DISPUTE_WINDOW_CLOSED: 'Đã quá thời hạn khiếu nại (trong ca hoặc trong 24 giờ sau khi điều dưỡng check-out).',
  INVALID_EVIDENCE: 'Có tệp bằng chứng không hợp lệ. Hãy gỡ tệp đó và chọn lại.',
};

/**
 * Khiếu nại ca (FR-DISP-01): chọn nhóm lý do, mô tả, đính kèm tối đa 5 tệp bằng chứng.
 * Khi khiếu nại được mở, tiền đang tạm giữ bị đóng băng — điều dưỡng có 24 giờ để phản hồi, rồi Admin quyết định.
 */
export function FileDisputeModal({ bookingId, bookingCode, onClose, onFiled }: FileDisputeModalProps) {
  const [category, setCategory] = useState<DisputeCategory | null>(null);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<OpenDisputeOutcome | null>(null);

  useEffect(() => {
    if (bookingId) {
      setCategory(null);
      setDescription('');
      setFiles([]);
      setError(null);
      setFiled(null);
    }
  }, [bookingId]);

  const tooShort = description.trim().length < MIN_DESC;
  const canSubmit = !!category && !tooShort && !submitting;

  const submit = async () => {
    if (!bookingId || !category) return;
    setSubmitting(true);
    setError(null);
    const res = await openDispute({ bookingId, category, description: description.trim(), files });
    setSubmitting(false);
    if (!res.success) {
      setError(CODE_MESSAGE[res.error?.code ?? ''] ?? getErrorMessage(res.error, 'Chưa gửi được khiếu nại. Vui lòng thử lại.'));
      return;
    }
    setFiled(res.data);
  };

  return (
    <Modal
      isOpen={!!bookingId}
      onClose={() => (filed ? onFiled(filed) : onClose())}
      title={filed ? 'Đã gửi khiếu nại' : 'Khiếu nại về ca chăm sóc'}
      subtitle={bookingCode ? `Ca ${bookingCode}` : undefined}
      maxWidth={620}
    >
      {filed ? (
        <div className="dp-done">
          <Alert tone="success" title="Khiếu nại của bạn đã được ghi nhận.">
            Tiền đang tạm giữ của ca được đóng băng cho tới khi Admin quyết định. Điều dưỡng có 24 giờ để phản hồi; bạn sẽ nhận thông báo khi có cập nhật.
          </Alert>
          {filed.evidenceSkipped && (
            <Alert tone="info" title="Chưa đính kèm được bằng chứng.">
              Khiếu nại đã mở nhưng hệ thống chưa nhận được tệp bằng chứng của bạn (tính năng đính kèm lúc mở khiếu nại đang được hoàn thiện). Hãy giữ lại ảnh/tài liệu để cung cấp cho Admin khi được yêu cầu.
            </Alert>
          )}
          {!filed.evidenceSkipped && filed.attached > 0 && <p className="ns-muted">Đã đính kèm {filed.attached} tệp bằng chứng.</p>}
          <div className="step-card__actions">
            <Link to="/disputes" className="btn btn-secondary" onClick={() => onFiled(filed)}>Xem khiếu nại của tôi</Link>
            <Button type="button" onClick={() => onFiled(filed)}>Đóng</Button>
          </div>
        </div>
      ) : (
        <>
          <Alert tone="info" title="Trước khi gửi">
            Nếu người bệnh đang nguy hiểm, hãy gọi 115 trước. Khiếu nại sẽ đóng băng khoản tiền của ca này tới khi được xử lý.
          </Alert>

          <div className="field">
            <span className="field-label">Vấn đề bạn gặp là gì? <span className="req">*</span></span>
            <div className="dp-cats" role="radiogroup" aria-label="Nhóm lý do khiếu nại">
              {CUSTOMER_CATEGORIES.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={category === c.value} className={`choice${category === c.value ? ' selected' : ''}`} onClick={() => setCategory(c.value)} disabled={submitting}>
                  <h4>{c.title}</h4>
                  <p>{c.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="dp-desc">Mô tả chi tiết <span className="req">*</span></label>
            <textarea
              id="dp-desc"
              className={`input rv-comment${description && tooShort ? ' is-invalid' : ''}`}
              rows={5}
              maxLength={MAX_DESC}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chuyện gì đã xảy ra, vào lúc nào, ảnh hưởng ra sao…"
              disabled={submitting}
            />
            <div className="hint rv-count">{description.trim().length}/{MAX_DESC}{tooShort && description ? ` · cần ít nhất ${MIN_DESC} ký tự` : ''}</div>
          </div>

          <div className="field">
            <span className="field-label">Bằng chứng đính kèm <span className="ns-muted">(không bắt buộc, tối đa {MAX_EVIDENCE_FILES} tệp)</span></span>
            <EvidenceUploader files={files} onChange={setFiles} disabled={submitting} />
          </div>

          {error && <Alert title={error} />}

          <div className="step-card__actions">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>Huỷ</Button>
            <Button variant="danger" type="button" onClick={submit} loading={submitting} disabled={!canSubmit}>Gửi khiếu nại</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
