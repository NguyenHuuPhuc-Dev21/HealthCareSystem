import { Link, useLocation } from 'react-router-dom';
import { Alert } from '../components';
import { PatientLayout } from '../components/layout/PatientLayout';
import { useAuth } from '../features/auth';

/** P1 — Trang chủ khách. Tạm thời là trang giữ chỗ; P1 thật làm ở Phase 2–3. */
export function HomePage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      {flash && <Alert tone="success">{flash}</Alert>}
      <div className="page-head">
        <h1>Xin chào 👋</h1>
        <p>Trang chủ (P1) sẽ làm ở Phase 2–3. Hiện bạn có thể quản lý hồ sơ người được chăm sóc.</p>
      </div>
      {user?.kyc_status !== 'VERIFIED' && (
        <Alert tone="info" title={user?.kyc_status === 'PENDING' ? 'CCCD đang chờ duyệt.' : 'Bạn chưa xác thực CCCD.'}>
          Cần xác thực CCCD trước khi đặt chăm sóc tại nhà riêng.{' '}
          {user?.kyc_status !== 'PENDING' && <Link to="/onboarding">Xác thực ngay →</Link>}
        </Alert>
      )}
      <p>
        <Link to="/patient-profiles" className="link-strong">Quản lý hồ sơ người được chăm sóc →</Link>
      </p>
    </PatientLayout>
  );
}
