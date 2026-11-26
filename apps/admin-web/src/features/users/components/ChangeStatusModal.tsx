import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, FormModal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { updateUserStatus } from '../users.api';
import { BLOCKER_LABEL, REASON_MAX, REASON_MIN } from '../users.types';
import type { AdminUserDetail, BookingRef, ChangeStatusResult, ChangeableStatus, ReactivationBlocker } from '../users.types';

interface ChangeStatusModalProps {
  user: AdminUserDetail;
  to: ChangeableStatus;
  onClose: () => void;
  /** Gọi khi đã đổi thành công và Admin đóng hộp thoại kết quả */
  onChanged: () => void;
}

const TITLE: Record<ChangeableStatus, string> = {
  ACTIVE: 'Kích hoạt lại tài khoản',
  SUSPENDED: 'Tạm khoá tài khoản',
  BANNED: 'Cấm vĩnh viễn tài khoản',
};

const CONSEQUENCE = {
  SUSPENDED: {
    NURSE: 'Điều dưỡng không nhận được ca mới. Các ca đã xác nhận nhưng chưa bắt đầu quay về tìm người thay (khách không mất phí, escrow giữ nguyên). Ca đang chạy không bị ảnh hưởng. Nạp ký quỹ hay nộp hoa hồng KHÔNG tự mở khoá — chỉ Admin mở.',
    PATIENT: 'Khách vẫn đăng nhập, xem và thanh toán các đặt chỗ hiện có nhưng không tạo được đặt chỗ mới.',
  },
  BANNED: {
    NURSE: 'Cấm VĨNH VIỄN: thu hồi mọi phiên đăng nhập ngay, hồ sơ và tài khoản đều bị cấm; không thể khôi phục. Ca chưa bắt đầu được giao lại.',
    PATIENT: 'Cấm VĨNH VIỄN: thu hồi mọi phiên đăng nhập ngay; không thể khôi phục. Đặt chỗ chưa hoàn tất cần Admin xử lý (hoàn tiền) theo quy trình hiện có.',
  },
} as const;

const BookingList = ({ title, items }: { title: string; items: BookingRef[] }) =>
  items.length === 0 ? null : (
    <div className="us-refs">
      <b>{title}</b>
      <ul>{items.map((b) => <li key={b.id}><code>{b.bookingCode}</code></li>)}</ul>
    </div>
  );

/** Đổi trạng thái tài khoản (khoá/cấm/kích hoạt lại): bắt buộc lý do — lý do được gửi cho người dùng và ghi nhật ký kiểm toán. */
export function ChangeStatusModal({ user, to, onClose, onChanged }: ChangeStatusModalProps) {
  const [reason, setReason] = useState('');
  const [waive, setWaive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<ReactivationBlocker[] | null>(null);
  const [result, setResult] = useState<ChangeStatusResult | null>(null);

  const isNurse = user.role === 'NURSE';
  const known = user.nurse?.reactivationBlockers ?? [];
  const reactivating = to === 'ACTIVE';
  const shown = blockers ?? (reactivating ? known : []);
  const hard = shown.filter((b) => b !== 'TRUST_SCORE_BELOW_THRESHOLD');
  const trustOnly = shown.includes('TRUST_SCORE_BELOW_THRESHOLD') && hard.length === 0;
  const len = reason.trim().length;
  const valid = len >= REASON_MIN && len <= REASON_MAX && hard.length === 0 && (!trustOnly || waive);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await updateUserStatus(user.id, { status: to, reason: reason.trim(), ...(waive ? { waiveTrustScore: true } : {}) });
    setBusy(false);
    if (!res.success) {
      if (res.error?.code === 'REACTIVATION_BLOCKED') {
        const b = (res.error.details as { blockers?: ReactivationBlocker[] } | undefined)?.blockers ?? [];
        setBlockers(b);
        setError('Chưa thể kích hoạt lại — còn điều kiện chưa đạt (xem bên dưới).');
        return;
      }
      setError(getErrorMessage(res.error, 'Chưa đổi được trạng thái. Vui lòng thử lại.'));
      return;
    }
    setResult(res.data);
  };

  if (result) {
    return (
      <FormModal title="Đã cập nhật tài khoản" onClose={onChanged}>
        <Alert tone="success" title={`${user.fullName}: ${result.previousStatus} → ${result.status}`}>
          Thay đổi đã được ghi vào nhật ký kiểm toán. Người dùng nhận thông báo kèm lý do bạn nhập.
          {result.sessionsRevoked && ' Mọi phiên đăng nhập của họ đã bị thu hồi.'}
        </Alert>
        <BookingList title="Ca chưa bắt đầu đã được trả về tìm người thay" items={result.releasedBookings} />
        <BookingList title="Ca đang diễn ra (không bị ảnh hưởng — theo dõi thủ công)" items={result.inProgressBookings} />
        <BookingList title="Đặt chỗ chưa hoàn tất của khách cần xử lý (hoàn tiền)" items={result.openCustomerBookings} />
        <div className="modal-actions"><Button type="button" onClick={onChanged}>Đóng</Button></div>
      </FormModal>
    );
  }

  return (
    <FormModal title={TITLE[to]} subtitle={`${user.fullName} · ${user.phone}`} onClose={onClose} busy={busy}>
      {to !== 'ACTIVE' && <Alert tone="info" title="Hệ quả">{CONSEQUENCE[to][user.role]}</Alert>}
      {user.status === 'PENDING_VERIFICATION' && <Alert title="Hồ sơ đang chờ thẩm định.">Hãy duyệt hồ sơ ở mục "Duyệt hồ sơ" — ở đây chỉ có thể cấm.</Alert>}

      {reactivating && isNurse && shown.length > 0 && (
        <div className="us-blockers" role="status">
          <b>Điều kiện kích hoạt lại chưa đạt:</b>
          <ul>{shown.map((b) => <li key={b}>{BLOCKER_LABEL[b]}</li>)}</ul>
          {hard.length > 0 && <p>Cần xử lý các mục này trước (ký quỹ/hoa hồng do điều dưỡng thực hiện); Admin không bỏ qua được.</p>}
          {trustOnly && (
            <label className="consent-check">
              <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} disabled={busy} />
              <span>Điều dưỡng đã được đào tạo lại và tôi đã xem xét — miễn điều kiện TrustScore (được ghi nhật ký kiểm toán).</span>
            </label>
          )}
        </div>
      )}

      <div className="field">
        <label htmlFor="us-reason">Lý do <span className="req">*</span> <span className="muted">(gửi cho người dùng — viết để họ đọc được)</span></label>
        <textarea id="us-reason" className="input textarea" rows={4} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy}
          placeholder={to === 'ACTIVE' ? 'Vd: Đã bổ sung ký quỹ và hoàn tất đào tạo lại.' : 'Vd: Vi phạm quy tắc giao tiếp ngoài nền tảng; chờ xác minh thêm.'} />
        <div className="field-hint">{len}/{REASON_MAX}{len > 0 && len < REASON_MIN ? ` · cần ít nhất ${REASON_MIN} ký tự` : ''}</div>
      </div>

      {error && <Alert title={error} />}
      <p className="muted us-audit">Hành động ghi nhật ký kiểm toán <code>CHANGE_ACCOUNT_STATUS</code> (người thực hiện, IP, trạng thái cũ/mới, lý do).</p>

      <div className="modal-actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Huỷ</Button>
        {user.status === 'PENDING_VERIFICATION' && to !== 'BANNED' ? (
          <Link to="/nurse-verification" className="btn btn-primary">Đến duyệt hồ sơ</Link>
        ) : (
          <Button variant={to === 'ACTIVE' ? 'primary' : 'danger'} type="button" onClick={submit} loading={busy} disabled={!valid}>{TITLE[to]}</Button>
        )}
      </div>
    </FormModal>
  );
}
