import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { maskPhone } from '../../lib/phone';
import { setup2fa, verify2fa } from './auth.api';
import type { TwoFaSetupResult } from './auth.api';
import { getAuthErrorMessage } from './auth.messages';
import type { AuthMessage } from './auth.messages';
import { AuthErrorCode } from './auth.types';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './components/AuthLayout';
import { OtpInput } from './components/OtpInput';
import { clearChallenge, loadChallenge } from './two-fa-challenge';
import { formatMmSs, useCountdown } from './useCountdown';

const CODE_LENGTH = 6;

/** Bước 2/2 — xác thực 2 lớp (TOTP) bắt buộc cho mọi phiên Admin. */
export function AdminTwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const [challenge] = useState(loadChallenge);
  const [code, setCode] = useState('');
  const [error, setError] = useState<AuthMessage | null>(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const secondsLeft = useCountdown(challenge?.expiresAt ?? 0);

  // Lần đầu (BE trả enrolled=false ở verify-otp): phải setup TOTP trước khi verify được.
  const [enrolled] = useState(() => sessionStorage.getItem('admin_2fa_enrolled') !== '0');
  const [setupInfo, setSetupInfo] = useState<TwoFaSetupResult | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  const handleSetup = async () => {
    if (!challenge) return;
    setSetupLoading(true);
    setError(null);
    const res = await setup2fa(challenge.token);
    setSetupLoading(false);
    if (!res.success) {
      setError(getAuthErrorMessage(res.error));
      return;
    }
    setSetupInfo(res.data);
  };

  if (!challenge) return <Navigate to="/login" replace />;
  const isExpired = expired || secondsLeft === 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || isExpired || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await verify2fa(challenge.token, code);
    setSubmitting(false);

    if (!res.success) {
      if (res.error?.code === AuthErrorCode.TWO_FA_CHALLENGE_EXPIRED) setExpired(true);
      setError(getAuthErrorMessage(res.error));
      setCode('');
      return;
    }
    if (res.data.user.role !== 'ADMIN') {
      setError({ title: 'Tài khoản này không có quyền truy cập Admin Console.' });
      return;
    }
    clearChallenge();
    signIn(res.data.access_token, res.data.user);
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== '/' ? from : '/nurse-verification', { replace: true });
  };

  return (
    <AuthLayout>
      <Link to="/login" className="auth-back" onClick={clearChallenge}>← Đăng nhập lại</Link>
      <div className="auth-steps" aria-label="Bước 2 trên 2">Bước 2/2 · Xác thực 2 lớp</div>
      <h1 className="auth-title auth-title--left">Nhập mã xác thực 2 lớp</h1>
      <p className="auth-sub auth-sub--left">
        Mở ứng dụng xác thực đã liên kết với tài khoản <b className="text-navy">{maskPhone(challenge.phone)}</b> và
        nhập mã {CODE_LENGTH} chữ số đang hiển thị.
      </p>
      {import.meta.env.VITE_USE_MOCK === 'true' && (
        <Alert tone="info" title="Mã 2FA thử nghiệm:">
          Nhập mã <b>123456</b> hoặc <b>246810</b> để đăng nhập vào Admin Console.
        </Alert>
      )}

      {!enrolled && !setupInfo && (
        <Alert title="Tài khoản chưa cài xác thực 2 lớp.">
          Bấm nút bên dưới để lấy mã cài đặt, thêm vào ứng dụng xác thực (Google Authenticator,
          Microsoft Authenticator…), rồi nhập mã 6 số ở đây.
          <div style={{ marginTop: 10 }}>
            <Button type="button" onClick={handleSetup} loading={setupLoading}>
              {setupLoading ? 'Đang lấy mã…' : 'Lấy mã cài đặt 2FA'}
            </Button>
          </div>
        </Alert>
      )}
      {setupInfo && (
        <Alert title="Quét hoặc nhập mã này vào ứng dụng xác thực:">
          <div>
            Mã bí mật: <b className="text-navy">{setupInfo.secret}</b>
          </div>
          <div style={{ wordBreak: 'break-all', fontSize: 12, marginTop: 4 }}>{setupInfo.otpauthUrl}</div>
          <div style={{ marginTop: 6 }}>Sau khi thêm xong, nhập mã 6 số đang hiển thị trong ứng dụng.</div>
        </Alert>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <OtpInput value={code} onChange={setCode} disabled={isExpired || submitting} invalid={!!error} autoFocus />
        {isExpired && !error && (
          <Alert title="Phiên xác thực đã hết hạn.">Vui lòng đăng nhập lại từ đầu.</Alert>
        )}
        {error && <Alert title={error.title}>{error.detail}</Alert>}
        {!isExpired && (
          <p className="resend-line">Phiên xác thực còn <b className="text-navy">{formatMmSs(secondsLeft)}</b></p>
        )}
        {isExpired ? (
          <Button type="button" size="lg" block onClick={() => { clearChallenge(); navigate('/login', { replace: true }); }}>
            Đăng nhập lại
          </Button>
        ) : (
          <Button type="submit" size="lg" block disabled={code.length !== CODE_LENGTH} loading={submitting}>
            {submitting ? 'Đang xác thực…' : 'Xác thực & vào Admin Console'}
          </Button>
        )}
      </form>
    </AuthLayout>
  );
}
