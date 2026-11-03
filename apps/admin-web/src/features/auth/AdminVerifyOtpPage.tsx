import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { maskPhone } from '../../lib/phone';
import { requestOtp, verifyOtp } from './auth.api';
import { getAuthErrorMessage } from './auth.messages';
import type { AuthMessage } from './auth.messages';
import { AuthErrorCode } from './auth.types';
import { AuthLayout } from './components/AuthLayout';
import { OtpInput } from './components/OtpInput';
import { buildPending, clearPending, loadPending, savePending } from './otp-pending';
import { saveChallenge } from './two-fa-challenge';
import { formatMmSs, useCountdown } from './useCountdown';

const OTP_LENGTH = 6;

/** Bước 1/2 — nhập OTP SMS. Admin không có phần chọn vai trò (không tự đăng ký). */
export function AdminVerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(loadPending);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<AuthMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const resendIn = useCountdown(pending?.resendAt ?? 0);

  if (!pending) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH || locked || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const res = await verifyOtp(pending.phone, otp);
    setSubmitting(false);

    if (!res.success) {
      const code = res.error?.code;
      if (code === AuthErrorCode.OTP_EXPIRED || code === AuthErrorCode.OTP_TOO_MANY_ATTEMPTS) setLocked(true);
      setError(getAuthErrorMessage(res.error));
      setOtp('');
      return;
    }

    // Tài khoản Admin luôn phải qua 2FA. Không có challenge = không phải Admin (hoặc chưa bật 2FA) → chặn.
    if (!res.data.requires_2fa) {
      setError(
        res.data.user.role === 'ADMIN'
          ? { title: 'Tài khoản quản trị chưa bật xác thực 2 lớp.', detail: 'Liên hệ quản trị hệ thống để bật 2FA trước khi đăng nhập.' }
          : { title: 'Tài khoản này không có quyền truy cập Admin Console.' }
      );
      return;
    }

    clearPending();
    saveChallenge(res.data.challenge_token, res.data.challenge_expires_in_sec, pending.phone);
    navigate('/login/2fa', { replace: true, state: location.state });
  };

  const handleResend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    const res = await requestOtp(pending.phone);
    setResending(false);
    if (!res.success) {
      setError(getAuthErrorMessage(res.error));
      return;
    }
    const next = buildPending(pending.phone, res.data);
    savePending(next);
    setPending(next);
    setOtp('');
    setLocked(false);
    setNotice(`Đã gửi mã mới tới ${maskPhone(pending.phone)}.`);
  };

  return (
    <AuthLayout>
      <Link to="/login" className="auth-back">← Quay lại nhập số điện thoại</Link>
      <div className="auth-steps" aria-label="Bước 1 trên 2">Bước 1/2 · Mã OTP</div>
      <h1 className="auth-title auth-title--left">Nhập mã OTP</h1>
      <p className="auth-sub auth-sub--left">
        Mã {OTP_LENGTH} chữ số đã gửi tới <b className="text-navy">{maskPhone(pending.phone)}</b>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <OtpInput value={otp} onChange={setOtp} disabled={locked || submitting} invalid={!!error && !locked} autoFocus />
        {error && <Alert title={error.title}>{error.detail}</Alert>}
        {notice && !error && <Alert tone="success">{notice}</Alert>}
        <p className="resend-line">
          {resendIn > 0 ? (
            <>Gửi lại mã sau <b className="text-navy">{formatMmSs(resendIn)}</b></>
          ) : (
            <button type="button" className="link-button" onClick={handleResend} disabled={resending}>
              {resending ? 'Đang gửi lại…' : 'Gửi lại mã'}
            </button>
          )}
        </p>
        <Button type="submit" size="lg" block disabled={otp.length !== OTP_LENGTH || locked} loading={submitting}>
          {submitting ? 'Đang xác thực…' : 'Tiếp tục →'}
        </Button>
      </form>
    </AuthLayout>
  );
}
