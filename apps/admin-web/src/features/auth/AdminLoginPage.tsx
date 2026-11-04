import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { ArrowLeft } from 'lucide-react';
import { formatPhoneInput, normalizeVnPhone } from '../../lib/phone';
import { requestOtp } from './auth.api';
import { getAuthErrorMessage } from './auth.messages';
import type { AuthMessage } from './auth.messages';
import { AuthLayout, BrandMark } from './components/AuthLayout';
import { buildPending, loadPending, savePending } from './otp-pending';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/** SH1 · Biến thể Admin Portal — cùng thẻ đăng nhập SĐT, sau OTP bắt buộc 2FA. */
export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState(() => {
    const pending = loadPending();
    return pending ? formatPhoneInput(`0${pending.phone.replace(/^\+84/, '')}`) : '';
  });
  const [error, setError] = useState<AuthMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const landingUrl = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:5177';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const normalized = normalizeVnPhone(phone);
    if (!normalized) {
      setError({ title: 'Số điện thoại không hợp lệ.', detail: 'Vui lòng nhập số di động Việt Nam gồm 10 chữ số.' });
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setLoading(true);
    const res = await requestOtp(normalized);
    setLoading(false);
    if (!res.success) {
      setError(getAuthErrorMessage(res.error));
      return;
    }
    savePending(buildPending(normalized, res.data));
    navigate('/login/otp', { state: location.state });
  };

  const mockCard = USE_MOCK ? (
    <div className="auth-card mock-card">
      <h2>Tài khoản quản trị mẫu (Mock)</h2>
      <p>
        Mã OTP SMS: <strong>123456</strong> · Mã xác thực 2 lớp (2FA): <strong>123456</strong> hoặc <strong>246810</strong>
      </p>
      <table className="mock-table">
        <thead>
          <tr>
            <th>Số điện thoại</th>
            <th>Vai trò & Quyền hạn</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>0901 000 001</strong></td>
            <td>Admin vận hành (toàn quyền duyệt hồ sơ điều dưỡng)</td>
          </tr>
          <tr>
            <td><strong>0905 123 456</strong></td>
            <td>Tài khoản khách (PATIENT) — bị từ chối truy cập Console</td>
          </tr>
        </tbody>
      </table>
    </div>
  ) : undefined;

  return (
    <AuthLayout secondary={mockCard}>
      <div className="auth-back-row">
        <a href={landingUrl} className="auth-back-btn" title="Quay lại trang chủ CareNest">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Quay lại trang chủ</span>
        </a>
      </div>
      <BrandMark />
      <div className="auth-badge">ADMIN CONSOLE</div>
      <h1 className="auth-title">Đăng nhập quản trị</h1>
      <p className="auth-sub">Nhập số điện thoại để nhận mã OTP</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-phone">Số điện thoại di động</label>
          <div className={`phone-wrap${error ? ' is-invalid' : ''}`}>
            <span className="phone-wrap__prefix" aria-hidden="true">VN +84</span>
            <input
              id="login-phone"
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="0905 123 456"
              value={phone}
              onChange={(e) => {
                setPhone(formatPhoneInput(e.target.value));
                if (error) setError(null);
              }}
              aria-invalid={!!error}
              autoFocus
            />
          </div>
          <div className="hint">ⓘ Mã OTP gồm 6 chữ số sẽ được gửi qua SMS hoặc Zalo ZNS.</div>
        </div>

        {error && <Alert title={error.title}>{error.detail}</Alert>}

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? 'Đang gửi mã…' : 'Nhận mã OTP →'}
        </Button>
      </form>

      <div className="admin-note">
        Sau bước OTP, tài khoản Admin <b>bắt buộc xác thực thêm lớp thứ hai (2FA)</b>. Mọi phiên đăng nhập đều được ghi
        nhật ký (địa chỉ IP, thiết bị) phục vụ kiểm toán.
      </div>
    </AuthLayout>
  );
}
