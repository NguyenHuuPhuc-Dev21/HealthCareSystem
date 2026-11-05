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

/** SH1 — Đăng nhập / đăng ký bằng số điện thoại (hợp nhất 1 luồng). */
export function LoginPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Quay lại từ SH2 ("Đổi số") thì điền sẵn số cũ
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
      <h2>Dữ liệu mẫu (chỉ hiện khi bật mock)</h2>
      <p>
        Mã OTP cho mọi số: <strong>123456</strong>. Dùng các số sau để thử từng trạng thái:
      </p>
      <table className="mock-table">
        <thead>
          <tr>
            <th>Số điện thoại</th>
            <th>Trạng thái tài khoản</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>0905 123 456</strong></td>
            <td>Nguyễn Văn An — Khách hàng đã eKYC, có sẵn 2 hồ sơ người thân</td>
          </tr>
          <tr>
            <td><strong>0905 111 222</strong></td>
            <td>Khách hàng cũ — chưa hoàn tất eKYC CCCD</td>
          </tr>
          <tr>
            <td><strong>Số bất kỳ khác</strong></td>
            <td>Người dùng mới → chuyển hướng chọn vai trò và tạo hồ sơ</td>
          </tr>
          <tr>
            <td><strong>0909 888 777</strong></td>
            <td>Tài khoản điều dưỡng (bị từ chối ở cổng khách hàng)</td>
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
      <div className="auth-badge-wrap">
        <span className="auth-badge">BỆNH NHÂN & GIA ĐÌNH</span>
      </div>
      <h1 className="auth-title">Đăng nhập / Đăng ký</h1>
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
              aria-describedby="login-phone-hint"
              autoFocus
            />
          </div>
          <div id="login-phone-hint" className="hint">
            ⓘ Mã OTP gồm 6 chữ số sẽ được gửi qua SMS hoặc Zalo ZNS.
          </div>
        </div>

        {error && <Alert title={error.title}>{error.detail}</Alert>}

        <Button type="submit" size="lg" block loading={loading}>
          {loading ? 'Đang gửi mã…' : 'Nhận mã OTP →'}
        </Button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '15px', color: 'var(--muted, #5f7d75)', margin: '20px 0 0', lineHeight: 1.5 }}>
        Chưa có tài khoản? Chỉ cần nhập số điện thoại và nhận OTP — hệ thống sẽ tự động hướng dẫn bạn tạo hồ sơ chăm sóc ngay sau đó.
      </p>

      <p className="small-print">
        Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và chấp thuận việc
        xử lý dữ liệu cá nhân theo <b>Nghị định 13/2023/NĐ-CP</b>.
      </p>
    </AuthLayout>
  );
}
