import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { UserRole } from '@healthcare-system/shared';
import { Button } from '../../components';
import { completeRegistration, requestOtp, verifyOtp } from './auth.api';
import { useAuth } from './AuthContext';
import { homePathOf } from '../../routes/ProtectedRoute';

const OTP_LENGTH = 6;

/** Che số điện thoại kiểu board SH2: 0905 ••• 456 */
function maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return `${phone.slice(0, 4)} ••• ${phone.slice(-3)}`;
}

function formatCountdown(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** SH2 — Nhập mã OTP. Xử lý 3 kết quả verify + form hoàn tất đăng ký + hiện devOtp. */
export const OtpPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const phone = sessionStorage.getItem('pending_phone') ?? '';
    const [devOtp, setDevOtp] = useState<string | null>(() => sessionStorage.getItem('dev_otp'));
    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState<number>(() =>
        Number(sessionStorage.getItem('otp_resend_after') ?? 60),
    );
    const [regToken, setRegToken] = useState<string | null>(null);
    const [fullName, setFullName] = useState('');
    const [registering, setRegistering] = useState(false);
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (!phone) navigate('/login', { replace: true });
    }, [phone, navigate]);

    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const setDigit = (idx: number, value: string) => {
        const clean = value.replace(/\D/g, '');
        if (clean.length > 1) {
            // Dán cả dãy mã vào một ô -> tự tách ra các ô.
            const next = [...digits];
            clean.slice(0, OTP_LENGTH).split('').forEach((ch, i) => {
                if (idx + i < OTP_LENGTH) next[idx + i] = ch;
            });
            setDigits(next);
            inputsRef.current[Math.min(idx + clean.length, OTP_LENGTH - 1)]?.focus();
            return;
        }
        const next = [...digits];
        next[idx] = clean;
        setDigits(next);
        if (clean && idx < OTP_LENGTH - 1) inputsRef.current[idx + 1]?.focus();
    };

    const handleVerify = async () => {
        setError('');
        setLoading(true);
        const res = await verifyOtp(phone, digits.join(''));
        setLoading(false);
        if (!res.success) {
            setError(res.error?.message ?? 'Xác thực thất bại. Vui lòng thử lại');
            return;
        }
        if (res.data.status === 'AUTHENTICATED') {
            const session = res.data.session;
            if (session.user.role !== UserRole.NURSE) {
                setError('Tài khoản này không phải tài khoản điều dưỡng. Vui lòng dùng đúng cổng đăng nhập.');
                return;
            }
            login(session);
            sessionStorage.removeItem('pending_phone');
            sessionStorage.removeItem('dev_otp');
            navigate(homePathOf(session), { replace: true });
        } else if (res.data.status === 'REGISTRATION_REQUIRED') {
            setRegToken(res.data.registrationToken);
        } else {
            setError('Tài khoản yêu cầu xác thực 2 bước không được hỗ trợ trên cổng này.');
        }
    };

    const handleCompleteRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regToken) return;
        if (!fullName.trim()) {
            setError('Vui lòng nhập họ và tên của bạn');
            return;
        }
        setError('');
        setRegistering(true);
        const res = await completeRegistration(regToken, fullName.trim());
        setRegistering(false);
        if (!res.success) {
            setError(res.error?.message ?? 'Đăng ký thất bại. Vui lòng thử lại');
            return;
        }
        login(res.data);
        sessionStorage.removeItem('pending_phone');
        sessionStorage.removeItem('dev_otp');
        navigate(homePathOf(res.data), { replace: true });
    };

    const handleResend = async () => {
        const res = await requestOtp(phone);
        if (res.success) {
            setCountdown(res.data.resendAfterSeconds);
            setDevOtp(res.data.devOtp ?? sessionStorage.getItem('dev_otp'));
        } else {
            setError(res.error?.message ?? 'Không gửi lại được mã');
        }
    };

    return (
        <div className="auth-zone">
            <div className="auth-card wide">
                <button type="button" className="back-link" onClick={() => navigate('/login')}>
                    ← Quay lại nhập số điện thoại
                </button>

                {!regToken ? (
                    <>
                        <h1 className="left" style={{ marginTop: 16 }}>
                            Nhập mã OTP
                        </h1>
                        <p className="sub left">
                            Mã 6 chữ số đã gửi tới <strong style={{ color: 'var(--color-navy)' }}>{maskPhone(phone)}</strong>
                            {' · '}
                            <button type="button" className="back-link" onClick={() => navigate('/login')}>
                                Đổi số
                            </button>
                        </p>

                        {devOtp && !error && (
                            <div className="alert-info" style={{ marginTop: 12, marginBottom: 16 }}>
                                Môi trường dev: mã OTP của lần gửi này là <strong>{devOtp}</strong> (BE trả kèm vì chưa có nhà cung cấp SMS).
                            </div>
                        )}

                        <div className="otp-row">
                            {digits.map((d, i) => (
                                <input
                                    key={i}
                                    ref={(el) => {
                                        inputsRef.current[i] = el;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                    maxLength={OTP_LENGTH}
                                    value={d}
                                    onChange={(e) => setDigit(i, e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && !digits[i] && i > 0) inputsRef.current[i - 1]?.focus();
                                    }}
                                    aria-label={`Chữ số ${i + 1} của mã OTP`}
                                />
                            ))}
                        </div>
                        {error && (
                            <div className="alert-error">
                                <AlertTriangle size={16} aria-hidden="true" /> <strong>{error}</strong>
                                <br />
                                Nếu không nhận được mã, bạn có thể gửi lại sau khi hết đếm ngược.
                            </div>
                        )}
                        <p className="resend-line">
                            {countdown > 0 ? (
                                <>
                                    Gửi lại mã sau <strong style={{ color: 'var(--color-navy)' }}>{formatCountdown(countdown)}</strong>
                                </>
                            ) : (
                                <button type="button" onClick={handleResend}>
                                    Gửi lại mã OTP
                                </button>
                            )}
                        </p>
                        <Button className="btn-block btn-lg" onClick={handleVerify} disabled={digits.join('').length !== OTP_LENGTH || loading}>
                            {loading ? 'Đang xác thực…' : 'Xác thực & tiếp tục'}
                        </Button>
                    </>
                ) : (
                    <form onSubmit={handleCompleteRegistration} style={{ marginTop: 16 }}>
                        <h1 className="left">Hoàn tất đăng ký</h1>
                        <p className="sub left">
                            Số điện thoại <strong>{maskPhone(phone)}</strong> chưa có tài khoản trên CareNest. Hãy nhập họ tên của bạn để tạo tài khoản điều dưỡng.
                        </p>
                        <div className="field" style={{ marginTop: 16 }}>
                            <label htmlFor="reg-name">Họ và tên của bạn</label>
                            <input
                                id="reg-name"
                                type="text"
                                placeholder="Ví dụ: Nguyễn Thị Hoa"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        {error && (
                            <div className="alert-error">
                                <AlertTriangle size={16} aria-hidden="true" /> <strong>{error}</strong>
                            </div>
                        )}
                        <Button type="submit" className="btn-block btn-lg" disabled={!fullName.trim() || registering} style={{ marginTop: 16 }}>
                            {registering ? 'Đang tạo tài khoản…' : 'Hoàn tất & tiếp tục'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};
