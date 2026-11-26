import { useState } from 'react';
import { Alert, Button, ConfirmDialog } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { formatVND } from '../../../lib/formatters';
import { resolveDispute } from '../disputes.api';
import { NOTES_MAX, NOTES_MIN } from '../disputes.types';
import type { Dispute, Resolution, ResolveResult } from '../disputes.types';

interface ResolvePanelProps {
  dispute: Dispute;
  /** Gọi sau khi phán quyết thành công để trang tải lại chi tiết */
  onResolved: () => void;
}

interface Option {
  value: Resolution;
  title: string;
  effect: string;
}

const BOOKING_OPTIONS: Option[] = [
  { value: 'RESOLVED_NURSE', title: 'Bác bỏ khiếu nại', effect: 'Gỡ đóng băng; phần thu nhập của điều dưỡng được giải ngân (ngay nếu ca đã check-out, nếu chưa thì sau check-out).' },
  { value: 'RESOLVED_CUSTOMER', title: 'Chấp nhận khiếu nại', effect: 'Hoàn 100% số tiền đang giữ cho khách; trừ TrustScore của điều dưỡng theo cấu hình TRUST_PENALTY_DISPUTE_UPHELD. Có thể trừ thêm ký quỹ để bồi thường (không kháng cáo được).' },
];

const APPEAL_OPTIONS: Option[] = [
  { value: 'RESOLVED_NURSE', title: 'Chấp nhận kháng cáo', effect: 'Hoàn lại khoản phạt vào ký quỹ của điều dưỡng (giao dịch PENALTY_REVERSAL).' },
  { value: 'RESOLVED_CUSTOMER', title: 'Từ chối kháng cáo', effect: 'Giữ nguyên khoản phạt; không có tiền nào dịch chuyển.' },
];

const SUMMARY: Array<[keyof ResolveResult, string]> = [
  ['refunded', 'Hoàn cho khách'],
  ['released', 'Giải ngân cho điều dưỡng'],
  ['depositDeducted', 'Trừ ký quỹ điều dưỡng'],
  ['penaltyReversed', 'Hoàn lại khoản phạt'],
];

/**
 * Phán quyết khiếu nại. Quyết định cuối cùng, không hoàn tác, ghi nhật ký kiểm toán RESOLVE_DISPUTE.
 * Mỗi lựa chọn hiển thị rõ hệ quả về tiền và TrustScore; phải nhập ghi chú (≥ 10 ký tự) và xác nhận lần nữa.
 */
export function ResolvePanel({ dispute, onResolved }: ResolvePanelProps) {
  const appeal = dispute.kind === 'PENALTY_APPEAL';
  const options = appeal ? APPEAL_OPTIONS : BOOKING_OPTIONS;
  const [choice, setChoice] = useState<Resolution | null>(null);
  const [notes, setNotes] = useState('');
  const [deduction, setDeduction] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolveResult | null>(null);

  const len = notes.trim().length;
  const dedNum = deduction.trim() === '' ? undefined : Number(deduction.replace(/[.\s,]/g, ''));
  const dedValid = dedNum === undefined || (Number.isInteger(dedNum) && dedNum >= 0);
  const showDeduction = !appeal && choice === 'RESOLVED_CUSTOMER';
  const valid = !!choice && len >= NOTES_MIN && len <= NOTES_MAX && (!showDeduction || dedValid);

  const submit = async () => {
    if (!choice) return;
    setBusy(true);
    setError(null);
    const res = await resolveDispute(dispute.id, { resolution: choice, notes: notes.trim(), ...(showDeduction && dedNum ? { depositDeduction: dedNum } : {}) });
    setBusy(false);
    setConfirming(false);
    if (!res.success) {
      setError(res.error?.code === 'DISPUTE_CLOSED' ? 'Khiếu nại này đã được xử lý trước đó (có thể bởi Admin khác). Hãy tải lại trang.' : getErrorMessage(res.error, 'Chưa lưu được quyết định. Vui lòng thử lại.'));
      return;
    }
    setResult(res.data);
  };

  if (result) {
    return (
      <section className="card dsp-card" aria-labelledby="dsp-result">
        <h3 id="dsp-result" className="section-title">Đã phán quyết</h3>
        <Alert tone="success" title={result.outcome === 'RESOLVED_CUSTOMER' ? (appeal ? 'Đã từ chối kháng cáo.' : 'Đã chấp nhận khiếu nại.') : appeal ? 'Đã chấp nhận kháng cáo.' : 'Đã bác bỏ khiếu nại.'}>
          Quyết định đã được ghi vào nhật ký kiểm toán (RESOLVE_DISPUTE) và hai bên đã được thông báo.
        </Alert>
        <dl className="dsp-summary">
          {SUMMARY.filter(([k]) => Number(result[k]) > 0).map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{formatVND(Number(result[k]))}</dd></div>)}
          {result.trustScoreDelta !== 0 && <div><dt>TrustScore điều dưỡng</dt><dd>{result.trustScoreDelta}</dd></div>}
        </dl>
        <Button onClick={onResolved}>Xong</Button>
      </section>
    );
  }

  return (
    <section className="card dsp-card" aria-labelledby="dsp-decide">
      <h3 id="dsp-decide" className="section-title">{appeal ? 'Quyết định kháng cáo' : 'Phán quyết'}</h3>
      <div className="dsp-options" role="radiogroup" aria-label="Quyết định">
        {options.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={choice === o.value} className={`choice${choice === o.value ? ' selected' : ''}`} onClick={() => setChoice(o.value)} disabled={busy}>
            <h4>{o.title}</h4>
            <p>{o.effect}</p>
          </button>
        ))}
      </div>

      {showDeduction && (
        <div className="field">
          <label htmlFor="dsp-ded">Trừ ký quỹ điều dưỡng để bồi thường <span className="muted">(tuỳ chọn, VNĐ)</span></label>
          <input id="dsp-ded" className={`input${!dedValid ? ' is-invalid' : ''}`} inputMode="numeric" placeholder="0" value={deduction} onChange={(e) => setDeduction(e.target.value)} disabled={busy} />
          {!dedValid && <div className="field-error">Nhập số nguyên không âm.</div>}
          <div className="field-hint">Khoản trừ này là phạt DISPUTE_UPHELD — điều dưỡng không kháng cáo lại được.</div>
        </div>
      )}

      <div className="field">
        <label htmlFor="dsp-notes">Ghi chú quyết định <span className="req">*</span> <span className="muted">(hai bên đều xem được; lưu vào nhật ký kiểm toán)</span></label>
        <textarea id="dsp-notes" className="input textarea" rows={4} maxLength={NOTES_MAX} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={busy} placeholder="Nêu căn cứ: bằng chứng nào, đối chiếu nhật ký GPS/chat/ca ra sao…" />
        <div className="field-hint">{len}/{NOTES_MAX}{len > 0 && len < NOTES_MIN ? ` · cần ít nhất ${NOTES_MIN} ký tự` : ''}</div>
      </div>

      {error && <Alert title={error} />}
      <div className="modal-actions">
        <Button type="button" variant={choice === 'RESOLVED_CUSTOMER' && !appeal ? 'danger' : 'primary'} onClick={() => setConfirming(true)} disabled={!valid}>Xác nhận quyết định…</Button>
      </div>

      {confirming && choice && (
        <ConfirmDialog
          title="Xác nhận quyết định cuối cùng?"
          confirmLabel={options.find((o) => o.value === choice)!.title}
          tone={choice === 'RESOLVED_CUSTOMER' && !appeal ? 'danger' : 'primary'}
          busy={busy}
          onConfirm={submit}
          onCancel={() => setConfirming(false)}
        >
          <b>{options.find((o) => o.value === choice)!.title}</b> — {options.find((o) => o.value === choice)!.effect}
          {showDeduction && dedNum ? <> Trừ ký quỹ <b>{formatVND(dedNum)}</b>.</> : null}
          <br />Quyết định không thể hoàn tác.
        </ConfirmDialog>
      )}
    </section>
  );
}
