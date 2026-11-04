import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import { requestOtp, USE_MOCK } from './auth.api';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

/** Logo CareNest: ô gạch teal + glyph nhà/trái tim y tế trắng (theo board SH). */
export const CareNestLogo: React.FC = () => (
    <div className="logo-c">
        <div className="logo-mark" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 32 32" style={{ display: 'block' }}>
                <path d="M5 14 L16 5 L27 14" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8.5 20.5 Q16 25.5 23.5 20.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
                <rect x="14.9" y="12.6" width="2.2" height="7" fill="#fff" />
                <rect x="12.5" y="15" width="7" height="2.2" fill="#fff" />
            </svg>
        </div>
        <div className="logo-name">CareNest</div>
        <div className="logo-tagline">YOUR HOME, OUR CARE</div>
    </div>
);

/** SH1 — Đăng nhập bằng số điện thoại. Màn chromeless (không navbar, theo NAV-0), giao diện theo board SH-design. */
export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const landingUrl = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:5177';

    const phoneValid = /^0\d{9}$/.test(phone.replace(/\s/g, ''));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const clean = phone.replace(/\s/g, '');
        const res = await requestOtp(clean);
        setLoading(false);
        if (!res.success) {
            setError(res.error?.message ?? 'Không gửi được mã OTP. Vui lòng thử lại');
            return;
        }
        sessionStorage.setItem('pending_phone', clean);
        sessionStorage.setItem('otp_resend_after', String(res.data.resendAfterSeconds));
        navigate('/login/otp');
    };

    return (
        <div className="auth-zone">
            <div className="auth-card">
                <div className="auth-back-row">
                    <a href={landingUrl} className="auth-back-btn" title="Quay lại trang chủ CareNest">
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Quay lại trang chủ</span>
                    </a>
                </div>
                <CareNestLogo />
                <h1>Đăng nhập</h1>
                <p className="sub">Nhập số điện thoại để nhận mã OTP</p>
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="phone">Số điện thoại di động</label>
                        <div className="phone-wrap">
                            <span className="prefix">VN +84</span>
                            <input
                                id="phone"
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel"
                                placeholder="0905 123 456"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                            />
                        </div>
                        <div className="hint">ⓘ Mã OTP gồm 6 chữ số sẽ được gửi qua SMS hoặc Zalo ZNS.</div>
                    </div>
                    {error && <div className="alert-error">
                        <AlertTriangle size={16} aria-hidden="true" /> <strong>{error}</strong>
                        <br />
                        Nếu không nhận được mã, bạn có thể gửi lại sau khi hết đếm ngược.
                    </div>}
                    <Button type="submit" className="btn-block btn-lg" disabled={!phoneValid || loading}>
                        {loading ? 'Đang gửi mã…' : 'Nhận mã OTP →'}
                    </Button>
                </form>
                <div className="divider-or">hoặc</div>
                <p style={{ textAlign: 'center', fontSize: '15.5px', color: 'var(--color-text-muted)', margin: 0 }}>
                    Chưa có tài khoản? Chỉ cần nhập số điện thoại và nhận OTP — hệ thống sẽ hướng dẫn bạn
                    đăng ký hồ sơ điều dưỡng ngay sau đó.
                </p>
                <p className="small-print">
                    Bằng việc tiếp tục, bạn đồng ý với Điều khoản sử dụng và chấp thuận việc xử lý dữ liệu cá
                    nhân theo <strong>Nghị định 13/2023/NĐ-CP</strong>.
                </p>
            </div>

            {USE_MOCK && (
                <div className="auth-card mock-card">
                    <h2>Dữ liệu mẫu (chỉ hiện khi bật mock)</h2>
                    <p>
                        Mã OTP cho mọi số: <strong>123456</strong>. Dùng các số sau để thử từng trạng thái:
                    </p>
                    <table className="mock-table">
                        <thead>
                            <tr>
                                <th>Số điện thoại</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td>0901111111</td><td>Chưa có hồ sơ → đi đăng ký (wizard)</td></tr>
                            <tr><td>0902222222</td><td>Trần Thị Mai — ACTIVE, Tier 2, TrustScore 92</td></tr>
                            <tr><td>0903333333</td><td>Phạm Thu Hà — đang chờ duyệt</td></tr>
                            <tr><td>0906666666</td><td>Đỗ Văn Bình — chờ duyệt, GPHN bị từ chối</td></tr>
                            <tr><td>0904444444</td><td>Nguyễn Văn An — bị tạm khoá (SUSPENDED)</td></tr>
                            <tr><td>0905555555</td><td>Lê Thị Hoa — ACTIVE Tier 1, GPHN đã hết hạn</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};