import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '@healthcare-system/shared';
import { Button } from '../../components';
import { requestOtp, verifyOtp } from './auth.api';
import { useAuth } from './AuthContext';
import { homePathOf } from '../../routes/ProtectedRoute';

const OTP_LENGTH = 6;

/** SH2 — Nhập mã OTP. Sau khi đúng mã: lưu phiên rồi cổng profile_status tự điều hướng. */
export const OtpPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const phone = sessionStorage.getItem('pending_phone') ?? '';
    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState<number>(() =>
        Number(sessionStorage.getItem('otp_resend_after') ?? 60),
    );
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
        if (res.data.user.role !== UserRole.NURSE) {
            setError('Tài khoản này không phải tài khoản điều dưỡng. Vui lòng dùng đúng cổng đăng nhập.');
            return;
        }
        login(res.data);
        sessionStorage.removeItem('pending_phone');
        navigate(homePathOf(res.data), { replace: true });
    };

    const handleResend = async () => {
        const res = await requestOtp(phone);
        if (res.success) setCountdown(res.data.resendAfterSeconds);
        else setError(res.error?.message ?? 'Không gửi lại được mã');
    };

    return (
        <div className="page-shell">
            <div className="card">
                <h1>Nhập mã OTP</h1>
                <p>
                    Mã 6 số đã được gửi tới <strong>{phone}</strong>. Mã chỉ dùng một lần và hết hạn sau ít phút.
                </p>
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
                {error && <div className="alert-error">{error}</div>}
                <div className="actions-row">
                    <Button onClick={handleVerify} disabled={digits.join('').length !== OTP_LENGTH || loading}>
                        {loading ? 'Đang xác thực…' : 'Xác thực và đăng nhập'}
                    </Button>
                    <Button variant="secondary" onClick={handleResend} disabled={countdown > 0}>
                        {countdown > 0 ? `Gửi lại mã sau ${countdown} giây` : 'Gửi lại mã OTP'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
