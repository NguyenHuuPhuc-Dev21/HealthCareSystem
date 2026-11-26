import { useEffect, useState } from 'react';
import { Alert, Button, FormModal } from '../../../components';
import { getErrorMessage } from '../../../lib/errors';
import { formatDate, formatDateTime, formatVND } from '../../../lib/formatters';
import { getUser } from '../users.api';
import { BLOCKER_LABEL, ROLE_LABEL, STATUS_LABEL, SUSPENDED_REASON_LABEL } from '../users.types';
import type { AdminUserDetail, ChangeableStatus } from '../users.types';
import { ChangeStatusModal } from './ChangeStatusModal';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
  /** Báo danh sách tải lại khi trạng thái đã đổi */
  onChanged: () => void;
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: AdminUserDetail };

const TIER: Record<string, string> = { TIER_1_BASIC: 'Cấp 1 · Cơ bản', TIER_2_SPECIALIST: 'Cấp 2 · Chuyên môn' };

/** Chi tiết người dùng: hồ sơ, thống kê đặt chỗ, thông tin điều dưỡng (ký quỹ, hoa hồng), lịch sử đổi trạng thái và các hành động. */
export function UserDetailModal({ userId, onClose, onChanged }: UserDetailModalProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [change, setChange] = useState<ChangeableStatus | null>(null);

  const fetchDetail = () => {
    setLoad({ state: 'loading' });
    getUser(userId).then((res) => setLoad(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Không tải được người dùng.') }));
  };

  useEffect(fetchDetail, [userId]);

  if (change && load.state === 'ready') {
    return (
      <ChangeStatusModal
        user={load.data}
        to={change}
        onClose={() => setChange(null)}
        onChanged={() => {
          setChange(null);
          onChanged();
          fetchDetail();
        }}
      />
    );
  }

  return (
    <FormModal title={load.state === 'ready' ? load.data.fullName : 'Chi tiết người dùng'} subtitle={load.state === 'ready' ? `${ROLE_LABEL[load.data.role]} · ${load.data.phone}` : undefined} onClose={onClose} wide>
      {load.state === 'loading' && <p className="muted">Đang tải…</p>}
      {load.state === 'error' && <Alert title={load.message}><Button size="sm" variant="secondary" onClick={fetchDetail}>Thử lại</Button></Alert>}
      {load.state === 'ready' && (() => {
        const u = load.data;
        const st = STATUS_LABEL[u.status];
        return (
          <>
            <div className="us-head">
              <span className={`chip ${st.tone}`}>{st.text}</span>
              {u.suspendedReason && <span className="muted">{SUSPENDED_REASON_LABEL[u.suspendedReason]}</span>}
            </div>

            <table className="kv-table">
              <tbody>
                <tr><th>Mã người dùng</th><td><code>{u.id}</code></td></tr>
                <tr><th>Email</th><td>{u.email ?? '—'}</td></tr>
                <tr><th>CCCD</th><td>{u.cccdMasked ?? '—'} · eKYC: {u.kycStatus}</td></tr>
                <tr><th>Tham gia</th><td>{formatDate(u.createdAt)}</td></tr>
                <tr><th>Đặt chỗ</th><td>{u.bookings.total} tổng · {u.bookings.open} đang mở · {u.bookings.inProgress} đang diễn ra</td></tr>
                {u.role === 'NURSE' && (
                  <>
                    <tr><th>Cấp / TrustScore</th><td>{u.tier ? TIER[u.tier] : '—'} · TrustScore <b>{u.trustScore ?? '—'}</b>{u.nurse?.ratingAvg != null && ` · ${u.nurse.ratingAvg}★`}</td></tr>
                    <tr><th>GPHN</th><td>{u.nurse?.gphnNumber ?? '—'}{u.nurse?.gphnExpiryDate && ` · hết hạn ${formatDate(u.nurse.gphnExpiryDate)}`}</td></tr>
                    <tr><th>Ký quỹ</th><td>{formatVND(u.nurse?.depositBalance ?? 0)} <span className="muted">/ tối thiểu {formatVND(u.nurse?.minDeposit ?? 0)}</span></td></tr>
                    <tr><th>Hoa hồng quá hạn</th><td>{u.nurse?.overdueCommissionCount ?? 0} khoản</td></tr>
                  </>
                )}
              </tbody>
            </table>

            {u.role === 'NURSE' && u.status === 'SUSPENDED' && (u.nurse?.reactivationBlockers.length ?? 0) > 0 && (
              <Alert tone="info" title="Rào cản kích hoạt lại">
                <ul className="us-list">{u.nurse!.reactivationBlockers.map((b) => <li key={b}>{BLOCKER_LABEL[b]}</li>)}</ul>
              </Alert>
            )}

            <h4 className="section-title">Lịch sử trạng thái</h4>
            {u.statusHistory.length === 0 ? <p className="muted">Chưa có thay đổi nào do Admin hay hệ thống thực hiện.</p> : (
              <ol className="us-history">
                {u.statusHistory.map((h, i) => (
                  <li key={i}>
                    <b>{STATUS_LABEL[h.from].text} → {STATUS_LABEL[h.to].text}</b>
                    <time>{formatDateTime(h.at)} · {h.actorName}</time>
                    <p>{h.reason}</p>
                  </li>
                ))}
              </ol>
            )}

            <div className="modal-actions us-actions">
              {u.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setChange('SUSPENDED')}>Tạm khoá</Button>}
              {u.status === 'SUSPENDED' && <Button onClick={() => setChange('ACTIVE')}>Kích hoạt lại</Button>}
              {u.status !== 'BANNED' && <Button variant="danger" onClick={() => setChange('BANNED')}>Cấm vĩnh viễn</Button>}
              {u.status === 'BANNED' && <span className="muted">Tài khoản đã bị cấm vĩnh viễn — không thể thay đổi.</span>}
            </div>
          </>
        );
      })()}
    </FormModal>
  );
}
