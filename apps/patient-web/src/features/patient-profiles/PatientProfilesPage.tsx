import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import {
  createPatientProfile,
  getPatientProfile,
  getPatientProfiles,
  grantConsent,
  requestProfileDeletion,
  updatePatientProfile,
  withdrawConsent,
} from './patient-profiles.api';
import { EMPTY_DRAFT } from './patient-profiles.types';
import type { PatientProfileDetail, PatientProfileDraft, PatientProfileDto } from './patient-profiles.types';
import { ConsentRecord, DangerZone } from './components/DataRightsPanel';
import { PatientProfileForm } from './components/PatientProfileForm';
import { describeProfile, ProfileCard } from './components/ProfileCard';
import { toCreateRequest, toDraft, toUpdateRequest } from './validation';

type Selection = string | 'new' | null;
type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };
type Notice = { tone: 'success' | 'error'; text: string } | null;

const CONSENT_TEXT = (
  <>
    Tôi xác nhận và đồng ý cho nền tảng xử lý dữ liệu sức khỏe của người được chăm sóc theo{' '}
    <b>Nghị định 13/2023/NĐ-CP</b>. Tôi là người bệnh hoặc người giám hộ/người thân được người bệnh cho phép.
  </>
);

/**
 * P13 — Hồ sơ người được chăm sóc.
 * Trái: danh sách (bản tóm tắt). Phải: form sửa (chỉ tải chi tiết khi mở) / thêm mới / quyền dữ liệu.
 */
export function PatientProfilesPage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const [list, setList] = useState<Load<PatientProfileDto[]>>({ state: 'loading' });
  const [selection, setSelection] = useState<Selection>(null);
  const [detail, setDetail] = useState<Load<PatientProfileDetail> | null>(null);
  const [draft, setDraft] = useState<PatientProfileDraft>(EMPTY_DRAFT);
  const [newConsent, setNewConsent] = useState(false);
  const [newConsentError, setNewConsentError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(flash ? { tone: 'success', text: flash } : null);

  const items = list.state === 'ready' ? list.data : [];
  const selected = items.find((p) => p.id === selection) ?? null;
  // Chỉ tải dữ liệu sức khoẻ chi tiết khi hồ sơ còn đồng ý và chưa yêu cầu xoá
  const editable = !!selected && selected.data_consent_accepted && !selected.deletion_requested_at;

  const loadList = useCallback(async (preferId?: string) => {
    const res = await getPatientProfiles();
    if (!res.success) {
      setList({ state: 'error', message: getErrorMessage(res.error) });
      return;
    }
    setList({ state: 'ready', data: res.data });
    setSelection((cur) => {
      if (preferId) return preferId;
      if (cur && (cur === 'new' || res.data.some((p) => p.id === cur))) return cur;
      return res.data[0]?.id ?? 'new';
    });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Đổi hồ sơ đang chọn → tải chi tiết (hoặc form trống nếu thêm mới)
  useEffect(() => {
    if (selection === 'new') {
      setDraft(EMPTY_DRAFT);
      setNewConsent(false);
      setNewConsentError(false);
      setDetail(null);
      return;
    }
    if (!selection || !editable) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail({ state: 'loading' });
    getPatientProfile(selection).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setDetail({ state: 'ready', data: res.data });
        setDraft(toDraft(res.data));
      } else {
        setDetail({ state: 'error', message: getErrorMessage(res.error) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selection, editable]);

  const select = (next: Selection) => {
    setNotice(null);
    setSelection(next);
    if (window.innerWidth < 860) {
      setTimeout(() => document.getElementById('profile-editor')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  /* ---------- Hành động ---------- */

  const handleCreate = async () => {
    if (!newConsent) {
      setNewConsentError(true);
      return;
    }
    setSaving(true);
    setNotice(null);
    const res = await createPatientProfile(toCreateRequest(draft));
    setSaving(false);
    if (!res.success) {
      setNotice({ tone: 'error', text: getErrorMessage(res.error, 'Chưa tạo được hồ sơ. Vui lòng thử lại.') });
      return;
    }
    await loadList(res.data.id);
    setNotice({ tone: 'success', text: `Đã tạo hồ sơ cho ${res.data.full_name}.` });
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    const res = await updatePatientProfile(selected.id, toUpdateRequest(draft));
    setSaving(false);
    if (!res.success) {
      setNotice({ tone: 'error', text: getErrorMessage(res.error, 'Chưa lưu được thay đổi. Vui lòng thử lại.') });
      return;
    }
    await loadList();
    setNotice({ tone: 'success', text: 'Đã lưu thay đổi.' });
  };

  const handleRegrant = async () => {
    if (!selected) return;
    setSaving(true);
    const res = await grantConsent(selected.id);
    setSaving(false);
    if (!res.success) {
      setNotice({ tone: 'error', text: getErrorMessage(res.error) });
      return;
    }
    await loadList();
    setNotice({ tone: 'success', text: 'Đã ghi nhận đồng ý. Bạn có thể chỉnh sửa và đặt ca cho hồ sơ này.' });
  };

  const handleWithdraw = async (): Promise<string | null> => {
    if (!selected) return null;
    const res = await withdrawConsent(selected.id);
    if (!res.success) return getErrorMessage(res.error);
    await loadList();
    setNotice({ tone: 'success', text: 'Đã rút lại đồng ý xử lý dữ liệu cho hồ sơ này.' });
    return null;
  };

  const handleRequestDelete = async (): Promise<string | null> => {
    if (!selected) return null;
    const res = await requestProfileDeletion(selected.id);
    if (!res.success) return getErrorMessage(res.error);
    await loadList();
    setNotice({ tone: 'success', text: 'Đã gửi yêu cầu xóa dữ liệu. Chúng tôi sẽ thông báo khi xử lý xong.' });
    return null;
  };

  /* ---------- Cột phải ---------- */

  const renderEditor = () => {
    if (selection === 'new') {
      return (
        <PatientProfileForm
          key="new"
          title="Thêm hồ sơ người được chăm sóc"
          subtitle="Thông tin này chỉ hiển thị cho điều dưỡng được phân ca và đội ngũ vận hành khi cần hỗ trợ."
          value={draft}
          onChange={setDraft}
          onContinue={handleCreate}
          submitting={saving}
          submitLabel="Tạo hồ sơ"
          beforeActions={
            <>
              <label className={`consent-check${newConsentError ? ' consent-check--error' : ''}`}>
                <input
                  type="checkbox"
                  checked={newConsent}
                  onChange={(e) => {
                    setNewConsent(e.target.checked);
                    setNewConsentError(false);
                  }}
                />
                <span>{CONSENT_TEXT}</span>
              </label>
              {newConsentError && (
                <div className="field-error" role="alert">Cần đồng ý xử lý dữ liệu sức khỏe trước khi tạo hồ sơ.</div>
              )}
            </>
          }
        />
      );
    }

    if (!selected) return null;

    if (selected.deletion_requested_at) {
      return (
        <section className="card step-card">
          <h3 className="step-card__title">Hồ sơ — {selected.full_name}</h3>
          <Alert tone="info" title="Đã gửi yêu cầu xóa dữ liệu.">
            Gửi lúc {formatDateTime(selected.deletion_requested_at)}. Hồ sơ chuyển sang chỉ đọc trong lúc đội ngũ vận
            hành xử lý theo Nghị định 13/2023.
          </Alert>
        </section>
      );
    }

    if (!selected.data_consent_accepted) {
      return (
        <section className="card step-card">
          <h3 className="step-card__title">Hồ sơ — {selected.full_name}</h3>
          <p className="step-card__sub">{describeProfile(selected)}</p>
          <Alert tone="info" title="Bạn đã rút lại đồng ý xử lý dữ liệu cho hồ sơ này.">
            Không thể xem, sửa hồ sơ sức khỏe hay đặt ca mới cho tới khi bạn đồng ý lại.
          </Alert>
          <div className="step-card__actions">
            <Button type="button" onClick={handleRegrant} loading={saving}>Đồng ý lại</Button>
          </div>
          <DangerZone canWithdraw={false} onWithdraw={handleWithdraw} onRequestDelete={handleRequestDelete} />
        </section>
      );
    }

    if (!detail || detail.state === 'loading') {
      return <section className="card step-card skeleton">Đang tải hồ sơ…</section>;
    }
    if (detail.state === 'error') {
      return (
        <section className="card step-card">
          <Alert title="Không tải được hồ sơ.">{detail.message}</Alert>
          <Button variant="secondary" onClick={() => loadList()}>Thử lại</Button>
        </section>
      );
    }

    return (
      <PatientProfileForm
        key={selected.id}
        title={`Chỉnh sửa hồ sơ — ${selected.full_name}`}
        subtitle={null}
        value={draft}
        onChange={setDraft}
        onContinue={handleUpdate}
        submitting={saving}
        submitLabel="Lưu thay đổi"
        beforeActions={<ConsentRecord profile={selected} />}
        footer={<DangerZone canWithdraw onWithdraw={handleWithdraw} onRequestDelete={handleRequestDelete} />}
      />
    );
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Hồ sơ người được chăm sóc</h1>
          <p>Quản lý hồ sơ bệnh nhân trong gia đình bạn</p>
        </div>
        <Button type="button" onClick={() => select('new')} disabled={selection === 'new'}>＋ Thêm hồ sơ</Button>
      </div>

      {list.state === 'loading' && <div className="card step-card skeleton">Đang tải danh sách hồ sơ…</div>}
      {list.state === 'error' && (
        <div className="card step-card">
          <Alert title="Không tải được danh sách hồ sơ.">{list.message}</Alert>
          <Button variant="secondary" onClick={() => loadList()}>Thử lại</Button>
        </div>
      )}

      {list.state === 'ready' && (
        <div className="split-2">
          <div className="profile-list">
            {items.length === 0 && (
              <div className="card step-card">
                <b className="text-navy">Chưa có hồ sơ nào.</b>
                <p className="step-card__sub">Thêm hồ sơ cho bản thân hoặc người thân để bắt đầu đặt lịch chăm sóc.</p>
              </div>
            )}
            {items.map((p) => (
              <ProfileCard key={p.id} profile={p} selected={p.id === selection} onSelect={() => select(p.id)} />
            ))}
          </div>
          <div id="profile-editor">
            {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
            {renderEditor()}
          </div>
        </div>
      )}
    </PatientLayout>
  );
}
