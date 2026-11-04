import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { maskPhone } from '../../lib/phone';
import { requestOtp, verifyOtp } from './auth.api';
import { getAuthErrorMessage } from './auth.messages';
import type { AuthMessage } from './auth.messages';
import { AuthErrorCode } from './auth.types';
import type { SelfSignupRole } from './auth.types';
import { useAuth } from './AuthProvider';
import { AuthLayout } from './components/AuthLayout';
import { OtpInput } from './components/OtpInput';
import { RoleCard } from './components/RoleCard';
import { buildPending, clearPending, loadPending, savePending } from './otp-pending';
import { formatMmSs, useCountdown } from './useCountdown';

const OTP_LENGTH = 6;
const NURSE_WEB_URL = import.meta.env.VITE_NURSE_WEB_URL ?? '';

/** SH2 — Nhập OTP & chọn vai trò khi đăng ký lần đầu. */
export function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [pending, setPending] = useState(loadPending);
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<SelfSignupRole | null>(null);
  const [error, setError] = useState<AuthMessage | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Mã hết hạn / sai quá số lần → khoá ô nhập cho tới khi gửi lại mã mới
  const [locked, setLocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const resendIn = useCountdown(pending?.resendAt ?? 0);

  if (!pending) return <Navigate to="/login" replace />;

  const needsRole = pending.isNewUser;
  const goesToNurseWeb = needsRole && role === 'NURSE';
  const canSubmit = goesToNurseWeb || (otp.length === OTP_LENGTH && (!needsRole || role !== null) && !locked);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;

    // Hồ sơ điều dưỡng được nộp ở Nurse Web/App, không tạo tài khoản điều dưỡng trong Patient Web
    if (goesToNurseWeb) {
      clearPending();
      window.location.assign(`${NURSE_WEB_URL}/login?phone=${encodeURIComponent(pending.phone)}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);
    const res = await verifyOtp({
      phone: pending.phone,
      otp,
      ...(needsRole && role ? { role } : {}),
    });
    setSubmitting(false);

    if (!res.success) {
      const code = res.error?.code;
      if (code === AuthErrorCode.OTP_EXPIRED || code === AuthErrorCode.OTP_TOO_MANY_ATTEMPTS) {
        setLocked(true);
      }
      setError(getAuthErrorMessage(res.error));
      setOtp('');
      return;
    }

    const { access_token, user } = res.data;

    if (user.role !== 'PATIENT') {
      setError({
        title: 'Tài khoản này không dùng cho trang Khách hàng.',
        detail:
          user.role === 'NURSE'
            ? 'Vui lòng đăng nhập tại trang dành cho Điều dưỡng.'
            : 'Vui lòng đăng nhập tại Admin Portal.',
      });
      return;
    }

    clearPending();
    signIn(access_token, user);

    // Người dùng mới → SH3 (eKYC + hồ sơ người bệnh). Người cũ → trang đang muốn vào.
    const from = (location.state as { from?: string } | null)?.from;
    navigate(pending.isNewUser ? '/onboarding' : from || '/', { replace: true });
  };

  const handleResend = async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    setNotice(null);
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
    <AuthLayout wide>
      <Link to="/login" className="auth-back">← Quay lại nhập số điện thoại</Link>
      <h1 className="auth-title auth-title--left">Nhập mã OTP</h1>
      <p className="auth-sub auth-sub--left">
        Mã {OTP_LENGTH} chữ số đã gửi tới <b className="text-navy">{maskPhone(pending.phone)}</b> ·{' '}
        <Link to="/login" className="link-strong">Đổi số</Link>
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <OtpInput
          value={otp}
          // Giữ thông báo "còn N lần thử" trong lúc nhập lại (theo SH2); xoá khi bấm xác thực
          onChange={setOtp}
          length={OTP_LENGTH}
          disabled={locked || submitting || goesToNurseWeb}
          invalid={!!error && !locked}
          autoFocus
        />

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

        {needsRole && (
          <>
            <hr className="auth-divider" />
            <div className="field field--tight">
              <label>Lần đầu sử dụng? Chọn vai trò của bạn</label>
            </div>
            <div className="role-grid">
              <RoleCard
                icon="🏠"
                title="Tôi cần thuê điều dưỡng"
                description="Đặt chăm sóc cho bản thân hoặc người thân, tại nhà hoặc tại bệnh viện."
                nextLabel="Tiếp tục: Xác thực CCCD & hồ sơ"
                selected={role === 'PATIENT'}
                onSelect={() => setRole('PATIENT')}
              />
              <RoleCard
                icon="🩺"
                title="Tôi là điều dưỡng / bác sĩ"
                description="Nhận ca chăm sóc tại nhà theo lịch rảnh của bạn, thu nhập minh bạch."
                nextLabel="Tiếp tục: Nộp hồ sơ thẩm định"
                selected={role === 'NURSE'}
                onSelect={() => setRole('NURSE')}
              />
            </div>
            {goesToNurseWeb && (
              <Alert tone="info">
                Hồ sơ điều dưỡng được nộp trên trang CareNest dành cho Điều dưỡng. Bạn sẽ đăng nhập lại
                bằng số điện thoại này ở đó.
              </Alert>
            )}
          </>
        )}

        <Button type="submit" size="lg" block disabled={!canSubmit} loading={submitting}>
          {goesToNurseWeb ? 'Chuyển sang trang Điều dưỡng →' : submitting ? 'Đang xác thực…' : 'Xác thực & tiếp tục'}
        </Button>
      </form>
    </AuthLayout>
  );
}
