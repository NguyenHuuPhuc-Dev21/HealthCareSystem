import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, Flag, Plus, ReceiptText, Send } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime, formatVND } from '../../lib/formatters';
import { useAuth } from '../auth';
import { getBookings } from './booking.api';
import type { Booking } from './booking.types';
import { StatusBadges } from './components/StatusBadges';
import { EscrowIndicator } from '../payments/components/EscrowIndicator';
import { CancelBookingModal } from '../refunds/components/CancelBookingModal';
import { PostShiftActions } from './components/PostShiftActions';

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: Booking[] };

/** Đơn của tôi: mỗi ca hiển thị 3 huy hiệu trạng thái độc lập (thực hiện · thanh toán · khiếu nại). */
export function MyBookingsPage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchList = async () => {
    setLoad({ state: 'loading' });
    const res = await getBookings();
    setLoad(res.success ? { state: 'ready', items: res.data.items } : { state: 'error', message: getErrorMessage(res.error, 'Chưa tải được danh sách ca.') });
  };

  useEffect(() => {
    fetchList();
  }, []);

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Đơn của tôi</h1>
          <p>Theo dõi ca chăm sóc, thanh toán và khiếu nại — ba trạng thái này độc lập với nhau.</p>
        </div>
        <div className="bk-head-actions">
          <Link to="/disputes" className="btn btn-secondary"><Flag size={16} style={{ marginRight: 6 }} /> Khiếu nại của tôi</Link>
          <Link to="/refunds" className="btn btn-secondary"><ReceiptText size={16} style={{ marginRight: 6 }} /> Theo dõi hoàn tiền</Link>
          <Link to="/bookings/new" className="btn btn-primary"><Plus size={16} style={{ marginRight: 6 }} /> Đặt ca mới</Link>
        </div>
      </div>

      {flash && <Alert tone="success" title={flash} />}
      {notice && <Alert tone="success" title={notice}>
          {notice.includes('hoàn') && <Link to="/refunds" className="link-strong">Theo dõi hoàn tiền →</Link>}
          {notice.includes('khiếu nại') && <Link to="/disputes" className="link-strong">Xem khiếu nại của tôi →</Link>}
        </Alert>}

      {load.state === 'loading' && <div className="card step-card skeleton">Đang tải đơn…</div>}
      {load.state === 'error' && (
        <Alert title={load.message}><Button type="button" variant="secondary" size="sm" onClick={fetchList}>Thử lại</Button></Alert>
      )}
      {load.state === 'ready' && load.items.length === 0 && (
        <div className="card step-card text-center">
          <b className="text-navy">Bạn chưa có ca nào</b>
          <p className="step-card__sub" style={{ marginTop: 6 }}>Chọn điều dưỡng đã thẩm định và đặt ca chăm sóc tại nhà.</p>
          <Link to="/nurses" className="btn btn-primary">Tìm điều dưỡng</Link>
        </div>
      )}

      {load.state === 'ready' && load.items.length > 0 && (
        <ul className="bk-list">
          {load.items.map((b) => {
            const payNow = b.executionStatus === 'DRAFT' && b.paymentMethod === 'BANK_TRANSFER';
            return (
              <li key={b.id} className="card bk-item">
                <div className="bk-item__main">
                  <div className="bk-item__title">
                    <h3>{b.serviceLabel}</h3>
                    <span className="ns-muted">{b.code}</span>
                  </div>
                  <p className="bk-item__meta">
                    <CalendarClock size={14} aria-hidden="true" /> {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)} · {b.patientName}
                  </p>
                  {b.invitedNurse && (
                    <p className="bk-item__meta"><Send size={14} aria-hidden="true" /> Mời trực tiếp: {b.invitedNurse.fullName}</p>
                  )}
                  {b.prescriptionReview === 'PENDING' && <p className="bk-item__meta">Y lệnh đang chờ Admin duyệt</p>}
                  <StatusBadges booking={b} />
                  <EscrowIndicator compact booking={{ ...b, totalAmount: b.pricing.totalAmount }} />
                </div>
                <div className="bk-item__side">
                  <b>{formatVND(b.pricing.totalAmount)}</b>
                  <span className="ns-muted">{b.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                  {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(b.executionStatus) && (
                    <Link to={`/bookings/${b.id}`} className={`btn btn-sm ${b.executionStatus === 'IN_PROGRESS' ? 'btn-primary' : 'btn-secondary'}`}>
                      {b.executionStatus === 'COMPLETED' ? 'Xem nhật ký ca' : 'Theo dõi ca'}
                    </Link>
                  )}
                  {['DRAFT', 'MATCHING', 'CONFIRMED'].includes(b.executionStatus) && Date.parse(b.startAt) > Date.now() && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setNotice(null); setCancelTarget(b); }}>Huỷ ca</button>
                  )}
                  <PostShiftActions booking={b} nurseName={b.invitedNurse?.fullName} onChanged={(msg) => { setNotice(msg ?? null); fetchList(); }} />
                  {payNow && <Link to={`/bookings/${b.id}/pay`} className="btn btn-primary btn-sm">Thanh toán ngay</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <CancelBookingModal
        bookingId={cancelTarget?.id ?? null}
        bookingCode={cancelTarget?.code}
        onClose={() => setCancelTarget(null)}
        onCancelled={(refund) => {
          const code = cancelTarget?.code;
          setCancelTarget(null);
          setNotice(refund ? `Đã huỷ ca ${code}. Khoản hoàn ${new Intl.NumberFormat('vi-VN').format(refund.refundAmount)} ₫ đang được xử lý.` : `Đã huỷ ca ${code}. Không có khoản tiền nào bị trừ.`);
          fetchList();
        }}
      />
    </PatientLayout>
  );
}
