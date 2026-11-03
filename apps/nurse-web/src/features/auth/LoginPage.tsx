import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components';
import { requestOtp, USE_MOCK } from './auth.api';

/** SH1 — Đăng nhập bằng số điện thoại. Màn chromeless (không navbar, theo NAV-0). */
export const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
        <div className="page-shell">
            <div className="card">
                <h1>Đăng nhập — Điều dưỡng CareNest</h1>
                <p>Nhập số điện thoại đã đăng ký. CareNest sẽ gửi mã OTP 6 số để đăng nhập — không cần mật khẩu.</p>
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="phone">Số điện thoại</label>
                        <input
                            id="phone"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="Ví dụ: 0902222222"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ''))}
                        />
                        <div className="hint">10 số, bắt đầu bằng 0.</div>
                    </div>
                    {error && <div className="alert-error">{error}</div>}
                    <Button type="submit" disabled={!phoneValid || loading}>
                        {loading ? 'Đang gửi mã…' : 'Nhận mã OTP'}
                    </Button>
                </form>
            </div>

            {USE_MOCK && (
                <div className="card">
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