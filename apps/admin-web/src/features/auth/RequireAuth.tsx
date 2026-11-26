import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../../components';
import { hasMfaProof, setLogoutReason } from '../../lib/session';
import { useAuth } from './AuthProvider';
import { useIdleLogout } from './useIdleLogout';

/** Phiên Admin hết hạn do không thao tác: đăng xuất và nhớ lý do để màn đăng nhập giải thích. */
function IdleGuard() {
  const { signOut } = useAuth();
  const { warningSecondsLeft, stayActive } = useIdleLogout(() => {
    setLogoutReason('idle');
    signOut();
  });

  return (
    <>
      <Outlet />
      {warningSecondsLeft !== null && (
        <div className="modal-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
          <div className="modal">
            <h3 id="idle-title">Phiên sắp hết hạn</h3>
            <p className="modal-sub">
              Bạn đã lâu không thao tác. Vì lý do an toàn (thao tác tài chính và dữ liệu y tế), phiên sẽ tự đăng xuất sau{' '}
              <b>{warningSecondsLeft} giây</b>.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" type="button" onClick={() => { setLogoutReason('idle'); signOut(); }}>Đăng xuất</Button>
              <Button type="button" onClick={stayActive} autoFocus>Tiếp tục phiên</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Phiên không hợp lệ cho Admin Console (sai vai trò hoặc chưa qua 2FA): xoá phiên và bắt đăng nhập lại. */
function RejectSession() {
  const { signOut } = useAuth();
  useEffect(() => {
    setLogoutReason('mfa');
    signOut();
  }, [signOut]);
  return <Navigate to="/login" replace />;
}

/**
 * Bọc các route cần đăng nhập của Admin Console.
 * Bắt buộc: đã đăng nhập, vai trò ADMIN **và** phiên đã qua 2FA (SRS: Admin Web Portal — Mandatory 2FA).
 * Thiếu bất kỳ điều nào → đăng xuất. Thêm: tự đăng xuất khi nhàn rỗi quá hạn.
 */
export function RequireAuth() {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user?.role !== 'ADMIN' || !hasMfaProof()) return <RejectSession />;
  return <IdleGuard />;
}

/** Bọc các route chỉ dành cho khách chưa đăng nhập (SH1, SH2). */
export function GuestOnly() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}
