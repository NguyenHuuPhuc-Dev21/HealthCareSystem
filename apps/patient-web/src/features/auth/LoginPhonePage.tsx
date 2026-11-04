import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { formatPhoneInput, normalizeVnPhone } from '../../lib/phone';
import { requestOtp } from './auth.api';
import { getAuthErrorMessage } from './auth.messages';
import type { AuthMessage } from './auth.messages';
import { AuthLayout, BrandMark } from './components/AuthLayout';
import { buildPending, loadPending, savePending } from './otp-pending';

/** SH1 — Đăng nhập / đăng ký bằng số điện thoại. */
export function LoginPhonePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isRegister = searchParams.get('mode') === 'register';

  // Quay lại từ SH2 ("Đổi số") thì điền sẵn số cũ
  const [phone, setPhone] = useState(() => {
    const pending = loadPending();
    return pending ? formatPhoneInput(`0${pending.phone.replace(/^\+84/, '')}`) : '';
  });
  const [error, setError] = useState<AuthMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  return (
    <AuthLayout>
      <BrandMark />
      <h1 className="auth-title">{isRegister ? 'Đăng ký tài khoản' : 'Đăng nhập'}</h1>
      <p className="auth-sub">
        {isRegister
          ? 'Nhập số điện thoại — tài khoản được tạo sau khi xác thực OTP'
          : 'Nhập số điện thoại để nhận mã OTP'}
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-phone">Số điện thoại di động</label>
          <div className={`phone-wrap${error ? ' is-invalid' : ''}`}>
            <span className="phone-wrap__prefix" aria-hidden="true">🇻🇳 +84</span>
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

      <div className="divider-or">hoặc</div>
      <p className="auth-switch">
        {isRegister ? (
          <>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></>
        ) : (
          <>Chưa có tài khoản? <Link to="/login?mode=register">Đăng ký ngay</Link></>
        )}
      </p>

      <p className="small-print">
        Bằng việc tiếp tục, bạn đồng ý với{' '}
        {/* TODO: thay bằng route trang Điều khoản khi có */}
        <a href="/dieu-khoan" target="_blank" rel="noreferrer">Điều khoản sử dụng</a> và chấp thuận việc
        xử lý dữ liệu cá nhân theo <b>Nghị định 13/2023/NĐ-CP</b>.
      </p>
    </AuthLayout>
  );
}
