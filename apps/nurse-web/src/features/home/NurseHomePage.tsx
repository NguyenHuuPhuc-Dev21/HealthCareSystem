import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';

/**
 * Trang chủ điều dưỡng đã ACTIVE (khung tối thiểu của Giai đoạn 1).
 * Giai đoạn 2 sẽ thêm lịch rảnh tuần, Giai đoạn 3 thêm Bảng việc làm/Radar vào đây.
 */
export const NurseHomePage: React.FC = () => {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const profile = session?.profile;

    if (!profile) return null;

    return (
        <div className="page-shell">
            <div className="card">
                <h1>Xin chào, {session.user.full_name}</h1>
                <p>
                    Hồ sơ: <StatusBadge status={profile.profile_status} /> Tier:{' '}
                    <StatusBadge status={profile.tier} /> TrustScore: {profile.trust_score}/100
                </p>
                <div className="cred-row">
                    <span>GPHN</span>
                    <span>
                        {profile.gphn_number ?? 'Chưa có'} — hết hạn {profile.gphn_expiry_date ?? '—'}
                    </span>
                </div>
                <div className="actions-row">
                    <Link to="/credentials">
                        <Button type="button">Xem văn bằng & GPHN</Button>
                    </Link>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            logout();
                            navigate('/login', { replace: true });
                        }}
                    >
                        Đăng xuất
                    </Button>
                </div>
                <div className="alert-info">
                    Giai đoạn 1 dừng ở đây: hồ sơ đã được duyệt và có tier. Lịch rảnh tuần là việc của Giai
                    đoạn 2, Bảng việc làm/Radar là Giai đoạn 3.
                </div>
            </div>
        </div>
    );
};
