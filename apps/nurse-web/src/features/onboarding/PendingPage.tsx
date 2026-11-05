import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DocType, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential } from '@healthcare-system/shared';
import { Button, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { getMyCredentials } from '../credentials/credentials.api';

const DOC_LABEL: Record<string, string> = {
    [DocType.CCCD]: 'Căn cước công dân',
    [DocType.DEGREE]: 'Bằng tốt nghiệp',
    [DocType.GPHN]: 'Giấy phép hành nghề (GPHN)',
    [DocType.RETIREMENT_DECISION]: 'Quyết định nghỉ hưu',
};

/** Giấy tờ bị từ chối thuộc bước wizard nào — để nộp lại đúng bước đó. */
const DOC_STEP: Record<string, number> = {
    [DocType.CCCD]: 1,
    [DocType.DEGREE]: 3,
    [DocType.GPHN]: 4,
    [DocType.RETIREMENT_DECISION]: 5,
};

/** Trang trạng thái chờ duyệt — hồ sơ PENDING_VERIFICATION chỉ được ở đây. */
export const PendingPage: React.FC = () => {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const [credentials, setCredentials] = useState<NurseCredential[]>(session?.credentials ?? []);

    useEffect(() => {
        let alive = true;
        getMyCredentials().then((res) => {
            if (alive && res.success) setCredentials(res.data);
        });
        return () => {
            alive = false;
        };
    }, []);

    const rejected = credentials.filter((c) => c.verification_status === VerificationStatus.REJECTED);

    return (
        <div className="page-shell">
            <div className="card">
                <h1>Hồ sơ đang chờ duyệt</h1>
                <p>
                    Trạng thái: {session?.profile && <StatusBadge status={session.profile.profile_status} />}
                </p>
                <p>
                    Admin sẽ xem từng giấy tờ, duyệt và gán tier. Trong lúc chờ duyệt, tài khoản chưa xuất
                    hiện ở tìm kiếm và chưa nhận được ca.
                </p>

                <h2>Giấy tờ đã nộp</h2>
                {credentials.length === 0 && <p>Chưa có giấy tờ nào.</p>}
                {credentials.map((c) => (
                    <div className="cred-row" key={c.id}>
                        <span>{DOC_LABEL[c.doc_type] ?? c.doc_type}</span>
                        <StatusBadge status={c.verification_status} />
                    </div>
                ))}

                {rejected.map((c) => (
                    <div className="alert-error" key={c.id}>
                        <strong>{DOC_LABEL[c.doc_type] ?? c.doc_type} bị từ chối:</strong>{' '}
                        {c.rejection_reason ?? 'Không rõ lý do'}
                        <div className="actions-row">
                            <Link to={`/onboarding-fix?step=${DOC_STEP[c.doc_type] ?? 1}`}>
                                <Button type="button">Nộp lại giấy tờ này</Button>
                            </Link>
                        </div>
                    </div>
                ))}

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