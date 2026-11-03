import React, { useEffect, useState } from 'react';
import { DocType, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential } from '@healthcare-system/shared';
import { Button, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK } from '../auth/auth.api';
import { getMyCredentials, mockAdminApproveGphn, uploadRenewedGphn } from './credentials.api';

const DOC_LABEL: Record<string, string> = {
    [DocType.CCCD]: 'Căn cước công dân',
    [DocType.DEGREE]: 'Bằng tốt nghiệp',
    [DocType.GPHN]: 'Giấy phép hành nghề (GPHN)',
    [DocType.RETIREMENT_DECISION]: 'Quyết định nghỉ hưu',
};

/**
 * SH6 — Văn bằng & GPHN của tôi.
 * Điểm phải code đúng (FR-AUTH-01):
 * - Tải GPHN mới xong, GPHN ở PENDING và tier KHÔNG tự đổi ở FE.
 * - Chỉ khi Admin duyệt, BE mới tự nâng lại TIER_2_SPECIALIST.
 * - GPHN hết hạn chỉ hạ Tier 2 -> Tier 1, hồ sơ vẫn ACTIVE (không khoá tài khoản).
 */
export const CredentialsPage: React.FC = () => {
    const { session, updateProfile } = useAuth();
    const profile = session?.profile;
    const [credentials, setCredentials] = useState<NurseCredential[]>(session?.credentials ?? []);
    const [file, setFile] = useState<File | null>(null);
    const [expiry, setExpiry] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        getMyCredentials().then((res) => {
            if (alive && res.success) setCredentials(res.data);
        });
        return () => {
            alive = false;
        };
    }, []);

    if (!profile) return null;

    const today = new Date().toISOString().slice(0, 10);
    const gphnExpired = !!profile.gphn_expiry_date && profile.gphn_expiry_date < today;
    const gphnPending = credentials.some(
        (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING,
    );

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        if (!file) {
            setError('Vui lòng chọn ảnh GPHN đã gia hạn');
            return;
        }
        if (!expiry || expiry <= today) {
            setError('Ngày hết hạn của GPHN mới phải sau hôm nay');
            return;
        }
        setLoading(true);
        const form = new FormData();
        form.append('gphn', file);
        form.append('gphnExpiryDate', expiry);
        const res = await uploadRenewedGphn(form);
        setLoading(false);
        if (!res.success) {
            setError(res.error?.message ?? 'Tải GPHN thất bại');
            return;
        }
        const refreshed = await getMyCredentials();
        if (refreshed.success) {
            setCredentials(refreshed.data);
            updateProfile(profile, refreshed.data);
        }
        setFile(null);
        setMessage('Đã tải GPHN mới. GPHN đang chờ Admin duyệt — tier chỉ thay đổi sau khi được duyệt.');
    };

    const handleMockApprove = async () => {
        const res = await mockAdminApproveGphn();
        if (!res.success) {
            setError(res.error?.message ?? 'Duyệt mock thất bại');
            return;
        }
        const refreshed = await getMyCredentials();
        if (refreshed.success) setCredentials(refreshed.data);
        if (res.data.profile) updateProfile(res.data.profile, refreshed.success ? refreshed.data : undefined);
        setMessage('Admin (giả lập) đã duyệt GPHN — hồ sơ đã được nâng lại Tier 2.');
    };

    return (
        <div className="page-shell">
            <div className="card">
                <h1>Văn bằng & GPHN của tôi</h1>
                <p>
                    {session?.user.full_name} — Tier hiện tại: <StatusBadge status={profile.tier} />
                </p>
                <div className="cred-row">
                    <span>Số GPHN</span>
                    <span>{profile.gphn_number ?? 'Chưa có'}</span>
                </div>
                <div className="cred-row">
                    <span>Hạn GPHN</span>
                    <span>{profile.gphn_expiry_date ?? '—'}</span>
                </div>
                <div className="cred-row">
                    <span>Điểm tin cậy (TrustScore)</span>
                    <span>{profile.trust_score}/100</span>
                </div>
                {gphnExpired && (
                    <div className="alert-error">
                        GPHN đã hết hạn từ {profile.gphn_expiry_date}. Hồ sơ vẫn hoạt động ở Tier 1 (chăm sóc
                        cơ bản) — hãy tải GPHN đã gia hạn bên dưới để được xét nâng lại Tier 2.
                    </div>
                )}

                <h2>Danh sách văn bằng</h2>
                {credentials.map((c) => (
                    <div className="cred-row" key={c.id}>
                        <span>
                            {DOC_LABEL[c.doc_type] ?? c.doc_type}
                            {c.expiry_date ? ` — hết hạn ${c.expiry_date}` : ''}
                        </span>
                        <StatusBadge status={c.verification_status} />
                    </div>
                ))}
            </div>

            <div className="card">
                <h2>Tải GPHN đã gia hạn</h2>
                {gphnPending ? (
                    <div className="alert-info">
                        Đã có một GPHN đang chờ Admin duyệt. Tier sẽ tự nâng lại Tier 2 khi được duyệt — bạn
                        không cần (và không được) tự đổi tier.
                    </div>
                ) : (
                    <form onSubmit={handleUpload}>
                        <div className="field">
                            <label htmlFor="gphn-file">Ảnh GPHN mới</label>
                            <input
                                id="gphn-file"
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                            />
                            {file && <div className="hint">Đã chọn: {file.name}</div>}
                        </div>
                        <div className="field">
                            <label htmlFor="gphn-expiry">Ngày hết hạn của GPHN mới</label>
                            <input
                                id="gphn-expiry"
                                type="date"
                                value={expiry}
                                onChange={(e) => setExpiry(e.target.value)}
                            />
                        </div>
                        {error && <div className="alert-error">{error}</div>}
                        {message && <div className="alert-info">{message}</div>}
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Đang tải lên…' : 'Tải GPHN mới lên'}
                        </Button>
                    </form>
                )}
                {USE_MOCK && gphnPending && (
                    <div className="actions-row">
                        <Button type="button" variant="secondary" onClick={handleMockApprove}>
                            [Chỉ mock] Giả lập Admin duyệt GPHN này
                        </Button>
                    </div>
                )}
                {message && !gphnPending && <div className="alert-info">{message}</div>}
            </div>
        </div>
    );
};