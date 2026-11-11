import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, FileCheck2, ShieldAlert, Upload } from 'lucide-react';
import { DocType, VerificationStatus } from '@healthcare-system/shared';
import type { NurseCredential } from '@healthcare-system/shared';
import { Button, StatusBadge } from '../../components';
import { useAuth } from '../auth/AuthContext';
import { USE_MOCK_AUTH, USE_MOCK_CREDENTIALS } from '../../lib/mock-flags';
import { getMyCredentials, mockAdminApproveGphn, uploadRenewedGphn } from './credentials.api';

const DOC_LABEL: Record<string, string> = {
  [DocType.CCCD]: 'Căn cước công dân',
  [DocType.DEGREE]: 'Bằng tốt nghiệp chuyên môn',
  [DocType.GPHN]: 'Giấy phép hành nghề (GPHN)',
  [DocType.RETIREMENT_DECISION]: 'Quyết định nghỉ hưu ngành Y',
};

export const CredentialsPage: React.FC = () => {
  const { session, updateProfile } = useAuth();
  const profile = session?.profile;
  const [credentials, setCredentials] = useState<NurseCredential[]>(session?.credentials ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [gphnNumber, setGphnNumber] = useState(profile?.gphn_number ?? '');
  const [issued, setIssued] = useState('');
  const [authority, setAuthority] = useState('');
  const [scope, setScope] = useState('');
  const [expiry, setExpiry] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const gphnExpired = !!profile?.gphn_expiry_date && profile.gphn_expiry_date < today;
  const [showRenewForm, setShowRenewForm] = useState(gphnExpired);

  const loadCredentials = useCallback(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);
    getMyCredentials()
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setCredentials(res.data);
        } else {
          setListError('Không thể tải danh mục văn bằng. Vui lòng thử lại.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setListError('Lỗi kết nối khi tải danh mục văn bằng.');
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return loadCredentials();
  }, [loadCredentials]);

  if (!profile) return null;

  const gphnPending = credentials.some(
    (c) => c.doc_type === DocType.GPHN && c.verification_status === VerificationStatus.PENDING
  );
  const isTier2 = profile.tier === 'TIER_2_SPECIALIST';
  const trustScore =
    typeof profile.trust_score === 'number'
      ? profile.trust_score
      : USE_MOCK_AUTH
      ? 98
      : null;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!file) {
      setError('Vui lòng chọn ảnh GPHN đã gia hạn');
      return;
    }
    if (!gphnNumber.trim()) {
      setError('Vui lòng nhập số GPHN mới');
      return;
    }
    if (!issued) {
      setError('Vui lòng nhập ngày cấp');
      return;
    }
    if (!authority.trim()) {
      setError('Vui lòng nhập cơ quan cấp');
      return;
    }
    if (!scope.trim()) {
      setError('Vui lòng nhập phạm vi hành nghề');
      return;
    }
    if (!expiry || expiry <= today) {
      setError('Ngày hết hạn của GPHN mới phải sau hôm nay');
      return;
    }
    if (expiry <= issued) {
      setError('Ngày hết hạn phải sau ngày cấp');
      return;
    }

    setLoading(true);
    const res = await uploadRenewedGphn({
      file,
      number: gphnNumber.trim(),
      issuedDate: issued,
      expiryDate: expiry,
      issuingAuthority: authority.trim(),
      scopeOfPractice: scope.trim(),
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error?.message ?? 'Tải GPHN thất bại');
      return;
    }
    const refreshed = await getMyCredentials();
    if (refreshed.success) {
      setCredentials(refreshed.data);
      updateProfile(res.data.profile ?? profile, refreshed.data);
    }
    setFile(null);
    setShowRenewForm(false);
    setMessage('Đã gửi hồ sơ GPHN mới. Hạng chuyên môn sẽ tự động khôi phục sau khi Admin thẩm định.');
  };

  const handleMockApprove = async () => {
    const res = await mockAdminApproveGphn();
    if (!res.success) {
      setError(res.error?.message ?? 'Duyệt thất bại');
      return;
    }
    const refreshed = await getMyCredentials();
    if (refreshed.success) setCredentials(refreshed.data);
    if (res.data.profile) updateProfile(res.data.profile, refreshed.success ? refreshed.data : undefined);
    setMessage('Hồ sơ GPHN đã được thẩm định và kích hoạt lại hạng Cấp 2.');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Hồ sơ pháp lý và Văn bằng</h1>
          <p>Quản lý Chứng chỉ hành nghề, bằng cấp chuyên môn và trạng thái thẩm định năng lực của bạn.</p>
        </div>
        <Link to="/" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          Về trang chủ
        </Link>
      </div>

      {gphnExpired && (
        <div
          className="ledger-panel"
          style={{
            background: 'var(--alert-crimson-soft)',
            borderColor: '#FECACA',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <ShieldAlert size={22} color="var(--alert-crimson)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--alert-crimson)', fontSize: 16.5 }}>
              Giấy phép hành nghề đã hết hạn từ {profile.gphn_expiry_date}
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: 15, color: 'var(--ink-primary)' }}>
              Tài khoản của bạn vẫn hoạt động ở hạng Chăm sóc cơ bản (Cấp 1). Hãy tải lên GPHN gia hạn để tiếp tục nhận thủ thuật Cấp 2.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          className="ledger-panel"
          style={{
            background: 'var(--brand-jade-soft)',
            borderColor: '#A7D7C5',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--brand-jade)',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
          <span>{message}</span>
        </div>
      )}

      <div className="cred-dossier">
        {/* Cột trái (40%): Thẻ định danh Chuyên môn */}
        <aside className="ledger-panel" style={{ borderTop: '4px solid var(--brand-jade)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="status-pill status-pill--jade">
              {isTier2 ? 'Chuyên môn Cấp 2' : 'Cơ bản Cấp 1'}
            </span>
            <Award size={20} color="var(--brand-jade)" />
          </div>

          <h2 className="font-display" style={{ margin: '0 0 4px', fontSize: 22, color: 'var(--ink-primary)' }}>
            {session?.user.full_name}
          </h2>
          <p style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--ink-secondary)' }}>
            {isTier2
              ? 'Được phép thực hiện chăm sóc và thủ thuật có y lệnh bác sĩ'
              : 'Phạm vi chăm sóc điều dưỡng cơ bản tại nhà'}
          </p>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Số Giấy phép hành nghề</div>
              <div className="ledger-row__value" style={{ fontSize: 17 }}>
                {profile.gphn_number ?? 'Chưa cập nhật'}
              </div>
            </div>
          </div>

          <div className="ledger-row">
            <div>
              <div className="ledger-row__label">Ngày hết hạn GPHN</div>
              <div className="ledger-row__value" style={{ fontSize: 17 }}>
                {profile.gphn_expiry_date ?? 'Chưa xác định'}
              </div>
            </div>
          </div>

          <div className="ledger-row">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span className="ledger-row__label" style={{ margin: 0 }}>Điểm tin cậy nghề nghiệp</span>
                <strong className="tabular-nums" style={{ fontSize: 18, color: trustScore !== null ? 'var(--brand-jade)' : 'var(--ink-muted)' }}>
                  {trustScore !== null ? `${trustScore} / 100` : 'Chưa có dữ liệu'}
                </strong>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--surface-subtle)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${trustScore !== null ? Math.min(100, Math.max(0, trustScore)) : 0}%`,
                    height: '100%',
                    background: 'var(--brand-jade)',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Cột phải (60%): Danh mục văn bằng & Cập nhật GPHN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section className="ledger-panel">
            <div className="ledger-panel__head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck2 size={18} color="var(--brand-jade)" />
                <h3 className="ledger-panel__title">Danh mục giấy tờ đã lưu</h3>
              </div>
              <span className="status-pill status-pill--neutral">{credentials.length} tài liệu</span>
            </div>

            {listError && (
              <div className="alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                <span>{listError}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={loadCredentials}>
                  Thử lại
                </button>
              </div>
            )}

            {listLoading && credentials.length === 0 ? (
              <p style={{ color: 'var(--ink-secondary)', margin: '16px 0' }}>
                Đang tải danh mục văn bằng...
              </p>
            ) : credentials.length === 0 ? (
              <p style={{ color: 'var(--ink-secondary)', margin: '16px 0' }}>
                Chưa có giấy tờ nào được lưu trong hồ sơ.
              </p>
            ) : (
              credentials.map((c) => (
                <div className="ledger-row" key={c.id} style={{ alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--ink-primary)', fontSize: 16 }}>
                      {DOC_LABEL[c.doc_type] ?? c.doc_type}
                    </div>
                    {c.expiry_date && (
                      <div className="ledger-row__sub tabular-nums">
                        Hiệu lực đến {c.expiry_date}
                      </div>
                    )}
                  </div>
                  <StatusBadge status={c.verification_status} />
                </div>
              ))
            )}
          </section>

          <section className="ledger-panel">
            <div className="ledger-panel__head">
              <h3 className="ledger-panel__title">Cập nhật Giấy phép hành nghề gia hạn</h3>
              {!gphnPending && !showRenewForm && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRenewForm(true)}
                >
                  <Upload size={15} />
                  Tải bản gia hạn
                </button>
              )}
            </div>

            {gphnPending ? (
              <div style={{ paddingTop: 14 }}>
                <p className="prose-limit" style={{ margin: '0 0 14px', fontSize: 15.5, color: 'var(--ink-secondary)' }}>
                  Hồ sơ GPHN mới của bạn đang được bộ phận chuyên môn thẩm định. Hạng năng lực sẽ tự động cập nhật ngay khi được duyệt.
                </p>
                {USE_MOCK_CREDENTIALS && (
                  <Button type="button" variant="secondary" onClick={handleMockApprove}>
                    Mô phỏng Admin duyệt hồ sơ này
                  </Button>
                )}
              </div>
            ) : !showRenewForm ? (
              <p className="prose-limit" style={{ margin: '14px 0 2px', fontSize: 15, color: 'var(--ink-secondary)' }}>
                Khi Sở Y tế cấp lại hoặc gia hạn GPHN, hãy tải ảnh chụp bản gốc tại đây để duy trì quyền nhận các thủ thuật Cấp 2.
              </p>
            ) : (
              <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
                <div className="field">
                  <label htmlFor="gphn-file">Ảnh chụp GPHN mới (bản gốc)</label>
                  <input
                    id="gphn-file"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && <div className="hint">Đã chọn: {file.name}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="field">
                    <label htmlFor="gphn-number">Số GPHN mới</label>
                    <input
                      id="gphn-number"
                      type="text"
                      placeholder="01284/GPHN-ĐN"
                      value={gphnNumber}
                      onChange={(e) => setGphnNumber(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="gphn-authority">Cơ quan cấp</label>
                    <input
                      id="gphn-authority"
                      type="text"
                      placeholder="Sở Y tế TP. Đà Nẵng"
                      value={authority}
                      onChange={(e) => setAuthority(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="field">
                    <label htmlFor="gphn-issued">Ngày cấp</label>
                    <input
                      id="gphn-issued"
                      type="date"
                      value={issued}
                      onChange={(e) => setIssued(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="gphn-expiry">Ngày hết hạn mới</label>
                    <input
                      id="gphn-expiry"
                      type="date"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="gphn-scope">Phạm vi chuyên môn</label>
                  <input
                    id="gphn-scope"
                    type="text"
                    placeholder="Điều dưỡng đa khoa"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  />
                </div>
                {error && <div className="alert-error">{error}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Đang tải hồ sơ...' : 'Gửi hồ sơ thẩm định'}
                  </Button>
                  {!gphnExpired && (
                    <Button type="button" variant="secondary" onClick={() => setShowRenewForm(false)}>
                      Đóng lại
                    </Button>
                  )}
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
