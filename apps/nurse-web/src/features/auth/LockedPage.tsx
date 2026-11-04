import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, StatusBadge } from '../../components';
import { useAuth } from './AuthContext';

/** Màn hình cho hồ sơ SUSPENDED / BANNED — nêu rõ trạng thái và lý do, không có lối lách. */
export const LockedPage: React.FC = () => {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const profile = session?.profile;

    return (
        <div className="page-shell">
            <div className="card">
                <h1>Tài khoản đang bị khoá</h1>
                {profile && (
                    <p>
                        Trạng thái hồ sơ: <StatusBadge status={profile.profile_status} />
                    </p>
                )}
                {profile?.suspended_reason && (
                    <div className="alert-error">Lý do: {profile.suspended_reason}</div>
                )}
                <p>
                    Khi tài khoản bị tạm khoá, bạn không nhận được ca mới. Vui lòng hoàn tất nghĩa vụ còn tồn
                    (ví dụ nộp hoa hồng ca tiền mặt còn quá hạn qua trang Ví khi được mở lại) hoặc liên hệ bộ
                    phận vận hành CareNest để được xem xét mở khoá.
                </p>
                <div className="actions-row">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            logout();
                            navigate('/login', { replace: true });
                        }}
                    >
                        Đăng xuất
                    </Button>
                </div>
            </div>
        </div>
    );
};