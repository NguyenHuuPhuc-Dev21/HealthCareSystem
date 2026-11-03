import { Check, Lock, Medal } from 'lucide-react';
import { useState } from 'react';
import { Alert, Button, ConfirmDialog } from '../../../components';
import type { NurseReviewDetail, NurseTier, VerifyNurseRequest } from '../nurse-verification.types';
import { TIER_LABEL } from '../nurse-verification.types';

interface DecisionPanelProps {
  detail: NurseReviewDetail;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: VerifyNurseRequest) => void;
}

const TIER_OPTIONS: Array<{ tier: NurseTier; title: string; description: string }> = [
  { tier: 'TIER_1_BASIC', title: 'Gán Cấp 1 — Chăm sóc cơ bản', description: 'Chỉ nhận dịch vụ không xâm lấn (Nhóm 1).' },
  { tier: 'TIER_2_SPECIALIST', title: 'Gán Cấp 2 — Chuyên môn', description: 'Thêm thủ thuật xâm lấn theo y lệnh (Nhóm 2) — cần GPHN còn hạn, đúng phạm vi.' },
];

/** A3 · "Quyết định thẩm định": chọn Tier → Duyệt, hoặc nhập lý do → Từ chối. Luôn có bước xác nhận. */
export function DecisionPanel({ detail, submitting, error, onSubmit }: DecisionPanelProps) {
  const isRenewal = detail.request_type === 'RENEWAL';
  // Cấp 2 chỉ mở khi backend xác nhận GPHN còn hiệu lực (FE không tự so ngày)
  const tier2Allowed = !!detail.gphn?.is_valid;
  const [tier, setTier] = useState<NurseTier>(
    detail.suggested_tier === 'TIER_2_SPECIALIST' && !tier2Allowed ? 'TIER_1_BASIC' : detail.suggested_tier
  );
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);
  const [lastAction, setLastAction] = useState<'approve' | 'reject' | null>(null);

  const approveLabel = isRenewal ? 'Duyệt GPHN gia hạn' : `Duyệt & gán ${TIER_LABEL[tier]}`;

  const askReject = () => {
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById('reject-reason')?.focus();
      return;
    }
    setConfirm('reject');
  };

  const submit = () => {
    setLastAction(confirm);
    if (confirm === 'approve') {
      onSubmit(isRenewal ? { decision: 'APPROVED' } : { decision: 'APPROVED', tier });
    } else if (confirm === 'reject') {
      onSubmit({ decision: 'REJECTED', rejection_reason: reason.trim() });
    }
    setConfirm(null);
  };

  return (
    <section className="card decision" aria-labelledby="decision-title">
      <h3 id="decision-title" className="decision__title">Quyết định thẩm định</h3>

      {isRenewal ? (
        <Alert tone="info" title="Hồ sơ gia hạn GPHN.">
          Duyệt GPHN mới thì điều dưỡng tự động trở lại / giữ Cấp 2, không cần duyệt lại toàn bộ hồ sơ.
        </Alert>
      ) : (
        <div className="tier-grid" role="radiogroup" aria-label="Cấp được gán">
          {TIER_OPTIONS.map((opt) => {
            const disabled = opt.tier === 'TIER_2_SPECIALIST' && !tier2Allowed;
            const selected = tier === opt.tier;
            return (
              <label key={opt.tier} className={`tier-option${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}>
                <input
                  type="radio"
                  name="tier"
                  value={opt.tier}
                  checked={selected}
                  disabled={disabled || submitting}
                  onChange={() => setTier(opt.tier)}
                />
                <span>
                  <b>{opt.title}{selected && <> <Check size={14} /></>}</b>
                  <small>
                    {disabled ? 'Không chọn được: hồ sơ chưa có GPHN còn hiệu lực.' : opt.description}
                  </small>
                </span>
              </label>
            );
          })}
        </div>
      )}

      {detail.retirement_submitted && (
        <p className="decision__note">
          <Medal size={15} /> Hồ sơ có <b>Quyết định nghỉ hưu</b> — chỉ dùng để gắn huy hiệu “Nhân viên y tế hưu trí”,{' '}
          <b>KHÔNG</b> dùng để mở dịch vụ xâm lấn. Dịch vụ xâm lấn chỉ mở bằng GPHN còn hạn.
        </p>
      )}

      <div className="field">
        <label htmlFor="reject-reason">Lý do từ chối (bắt buộc nếu từ chối hồ sơ)</label>
        <textarea
          id="reject-reason"
          className={`input textarea${reasonError ? ' is-invalid' : ''}`}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonError(false);
          }}
          placeholder="VD: Ảnh GPHN mờ, không đọc được số giấy phép — yêu cầu tải lại…"
          disabled={submitting}
        />
        {reasonError && <div className="field-error" role="alert">Nhập lý do để ứng viên biết cần bổ sung gì.</div>}
      </div>

      {error && <Alert title={error} />}

      <div className="decision__actions">
        <Button type="button" size="lg" onClick={() => setConfirm('approve')} disabled={submitting && lastAction !== 'approve'} loading={submitting && lastAction === 'approve'}>
          <Check size={17} style={{ verticalAlign: -3, marginRight: 6 }} aria-hidden="true" />{approveLabel}
        </Button>
        <Button type="button" size="lg" variant="secondary" className="btn-danger-outline" onClick={askReject} disabled={submitting && lastAction !== 'reject'} loading={submitting && lastAction === 'reject'}>
          Từ chối hồ sơ
        </Button>
      </div>

      <p className="audit-note">
        <Lock size={13} /> Quyết định được ghi vào nhật ký kiểm toán (người duyệt — reviewed_by, thời điểm và cấp được gán). Điều dưỡng
        chỉ nhận ca sau khi nạp đủ ký quỹ theo cấu hình hệ thống.
      </p>

      {confirm === 'approve' && (
        <ConfirmDialog
          title={isRenewal ? 'Duyệt GPHN gia hạn?' : `Duyệt hồ sơ và gán ${TIER_LABEL[tier]}?`}
          confirmLabel="Xác nhận duyệt"
          onConfirm={submit}
          onCancel={() => setConfirm(null)}
        >
          <b>{detail.full_name}</b>{' '}
          {isRenewal
            ? 'sẽ được khôi phục / giữ Cấp 2 với GPHN mới.'
            : `sẽ được kích hoạt ở ${TIER_LABEL[tier]}${tier === 'TIER_2_SPECIALIST' ? ' (mở dịch vụ xâm lấn Nhóm 2)' : ' (chỉ dịch vụ không xâm lấn)'}.`}{' '}
          Quyết định được ghi nhật ký kiểm toán.
        </ConfirmDialog>
      )}
      {confirm === 'reject' && (
        <ConfirmDialog
          title="Từ chối hồ sơ này?"
          confirmLabel="Xác nhận từ chối"
          tone="danger"
          onConfirm={submit}
          onCancel={() => setConfirm(null)}
        >
          <b>{detail.full_name}</b> sẽ nhận thông báo kèm lý do: “{reason.trim()}”.
        </ConfirmDialog>
      )}
    </section>
  );
}
