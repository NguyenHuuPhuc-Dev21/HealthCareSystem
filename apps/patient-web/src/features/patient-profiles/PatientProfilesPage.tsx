import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Alert, Button, Modal } from '../../components';
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
import { DangerZone } from './components/DataRightsPanel';
import { PatientProfileForm } from './components/PatientProfileForm';
import { ProfileCard, describeProfile } from './components/ProfileCard';
import { ProfileDetailView } from './components/ProfileDetailView';
import { toCreateRequest, toDraft, toUpdateRequest } from './validation';

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
 * Cột trái: Danh sách hồ sơ (tóm tắt).
 * Cột phải: Xem chi tiết hồ sơ đang chọn.
 * Thêm mới và Chỉnh sửa được mở trong Modal riêng biệt với nút Huỷ và Lưu/Tạo rõ ràng.
 */
export function PatientProfilesPage() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;

  const [list, setList] = useState<Load<PatientProfileDto[]>>({ state: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Load<PatientProfileDetail> | null>(null);

  // Modal thêm mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<PatientProfileDraft>(EMPTY_DRAFT);
  const [newConsent, setNewConsent] = useState(false);
  const [newConsentError, setNewConsentError] = useState(false);

  // Modal chỉnh sửa
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<PatientProfileDraft>(EMPTY_DRAFT);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(flash ? { tone: 'success', text: flash } : null);

  const items = list.state === 'ready' ? list.data : [];
  const selected = items.find((p) => p.id === selectedId) ?? null;
  const editable = !!selected && selected.data_consent_accepted && !selected.deletion_requested_at;

  const loadList = useCallback(async (preferId?: string) => {
    const res = await getPatientProfiles();
    if (!res.success) {
      setList({ state: 'error', message: getErrorMessage(res.error) });
      return;
    }
    setList({ state: 'ready', data: res.data });
    setSelectedId((cur) => {
      if (preferId) return preferId;
      if (cur && res.data.some((p) => p.id === cur)) return cur;
      return res.data[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // Đổi hồ sơ đang chọn → tải chi tiết
  useEffect(() => {
    if (!selectedId || !editable) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail({ state: 'loading' });
    getPatientProfile(selectedId).then((res) => {
      if (cancelled) return;
      if (res.success) {
        setDetail({ state: 'ready', data: res.data });
      } else {
        setDetail({ state: 'error', message: getErrorMessage(res.error) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, editable]);

  const select = (id: string) => {
    setNotice(null);
    setSelectedId(id);
    if (window.innerWidth < 860) {
      setTimeout(() => document.getElementById('profile-detail-panel')?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  const openCreateModal = () => {
    setCreateDraft(EMPTY_DRAFT);
    setNewConsent(false);
    setNewConsentError(false);
    setIsCreateOpen(true);
  };

  const openEditModal = () => {
    if (detail && detail.state === 'ready') {
      setEditDraft(toDraft(detail.data));
      setIsEditOpen(true);
    }
  };

  /* ---------- Hành động Tạo / Sửa ---------- */

  const handleCreate = async () => {
    if (!newConsent) {
      setNewConsentError(true);
      return;
    }
    setSaving(true);
    setNotice(null);
    const res = await createPatientProfile(toCreateRequest(createDraft));
    setSaving(false);
    if (!res.success) {
      setNotice({ tone: 'error', text: getErrorMessage(res.error, 'Chưa tạo được hồ sơ. Vui lòng thử lại.') });
      return;
    }
    setIsCreateOpen(false);
    await loadList(res.data.id);
    setNotice({ tone: 'success', text: `Đã tạo hồ sơ cho ${res.data.full_name}.` });
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    const res = await updatePatientProfile(selected.id, toUpdateRequest(editDraft));
    setSaving(false);
    if (!res.success) {
      setNotice({ tone: 'error', text: getErrorMessage(res.error, 'Chưa lưu được thay đổi. Vui lòng thử lại.') });
      return;
    }
    setIsEditOpen(false);
    await loadList(selected.id);
    // Reload detail
    const detailRes = await getPatientProfile(selected.id);
    if (detailRes.success) {
      setDetail({ state: 'ready', data: detailRes.data });
    }
    setNotice({ tone: 'success', text: 'Đã lưu thay đổi hồ sơ.' });
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
    await loadList(selected.id);
    setNotice({ tone: 'success', text: 'Đã ghi nhận đồng ý. Bạn có thể xem, chỉnh sửa và đặt ca cho hồ sơ này.' });
  };

  const handleWithdraw = async (): Promise<string | null> => {
    if (!selected) return null;
    const res = await withdrawConsent(selected.id);
    if (!res.success) return getErrorMessage(res.error);
    await loadList(selected.id);
    setNotice({ tone: 'success', text: 'Đã rút lại đồng ý xử lý dữ liệu cho hồ sơ này.' });
    return null;
  };

  const handleRequestDelete = async (): Promise<string | null> => {
    if (!selected) return null;
    const res = await requestProfileDeletion(selected.id);
    if (!res.success) return getErrorMessage(res.error);
    await loadList(selected.id);
    setNotice({ tone: 'success', text: 'Đã gửi yêu cầu xóa dữ liệu. Chúng tôi sẽ thông báo khi xử lý xong.' });
    return null;
  };

  /* ---------- Render Cột phải (Chi tiết hồ sơ) ---------- */

  const renderDetailPanel = () => {
    if (!selected) {
      return (
        <div className="card step-card text-center" style={{ padding: '48px 24px' }}>
          <b className="text-navy" style={{ fontSize: 17 }}>Chưa chọn hồ sơ</b>
          <p className="step-card__sub" style={{ marginTop: 6 }}>
            Chọn một hồ sơ từ danh sách bên trái hoặc bấm &quot;Thêm hồ sơ&quot; để tạo hồ sơ mới.
          </p>
          <div style={{ marginTop: 20 }}>
            <Button type="button" onClick={openCreateModal}>
              <Plus size={16} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
              Thêm hồ sơ người thân
            </Button>
          </div>
        </div>
      );
    }

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
            Không thể xem chi tiết, sửa hồ sơ sức khỏe hay đặt ca mới cho tới khi bạn đồng ý lại.
          </Alert>
          <div className="step-card__actions" style={{ marginTop: 16 }}>
            <Button type="button" onClick={handleRegrant} loading={saving}>
              Đồng ý lại
            </Button>
          </div>
          <DangerZone canWithdraw={false} onWithdraw={handleWithdraw} onRequestDelete={handleRequestDelete} />
        </section>
      );
    }

    if (!detail || detail.state === 'loading') {
      return <section className="card step-card skeleton">Đang tải chi tiết hồ sơ…</section>;
    }

    if (detail.state === 'error') {
      return (
        <section className="card step-card">
          <Alert title="Không tải được chi tiết hồ sơ.">{detail.message}</Alert>
          <Button variant="secondary" onClick={() => selectedId && select(selectedId)}>
            Thử lại
          </Button>
        </section>
      );
    }

    return (
      <ProfileDetailView
        profile={detail.data}
        onEdit={openEditModal}
        canWithdraw
        onWithdraw={handleWithdraw}
        onRequestDelete={handleRequestDelete}
      />
    );
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Hồ sơ người được chăm sóc</h1>
          <p>Quản lý hồ sơ bệnh nhân và thông tin chăm sóc trong gia đình bạn</p>
        </div>
        <Button type="button" onClick={openCreateModal}>
          <Plus size={16} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
          Thêm hồ sơ
        </Button>
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
          {/* Cột trái: Danh sách hồ sơ */}
          <div className="profile-list">
            {items.length === 0 && (
              <div className="card step-card">
                <b className="text-navy">Chưa có hồ sơ nào.</b>
                <p className="step-card__sub">Thêm hồ sơ cho bản thân hoặc người thân để bắt đầu đặt lịch chăm sóc.</p>
                <div style={{ marginTop: 16 }}>
                  <Button type="button" onClick={openCreateModal}>
                    <Plus size={16} style={{ marginRight: 6, display: 'inline-block', verticalAlign: 'middle' }} />
                    Thêm hồ sơ ngay
                  </Button>
                </div>
              </div>
            )}
            {items.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                selected={p.id === selectedId}
                onSelect={() => select(p.id)}
              />
            ))}
          </div>

          {/* Cột phải: Xem chi tiết */}
          <div id="profile-detail-panel">
            {notice && (
              <div style={{ marginBottom: 16 }}>
                <Alert tone={notice.tone}>{notice.text}</Alert>
              </div>
            )}
            {renderDetailPanel()}
          </div>
        </div>
      )}

      {/* Modal Thêm hồ sơ người thân */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Thêm hồ sơ người được chăm sóc"
        subtitle="Thông tin chỉ hiển thị cho điều dưỡng được phân ca và đội ngũ vận hành khi hỗ trợ."
        maxWidth={680}
      >
        <PatientProfileForm
          isModal
          value={createDraft}
          onChange={setCreateDraft}
          onContinue={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
          cancelLabel="Hủy"
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
                <div className="field-error" role="alert">
                  Cần đồng ý xử lý dữ liệu sức khỏe trước khi tạo hồ sơ.
                </div>
              )}
            </>
          }
        />
      </Modal>

      {/* Modal Chỉnh sửa hồ sơ */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Chỉnh sửa hồ sơ — ${selected?.full_name ?? ''}`}
        subtitle="Cập nhật thông tin y tế, thể trạng và nơi chăm sóc."
        maxWidth={680}
      >
        <PatientProfileForm
          isModal
          value={editDraft}
          onChange={setEditDraft}
          onContinue={handleUpdate}
          onCancel={() => setIsEditOpen(false)}
          cancelLabel="Hủy"
          submitting={saving}
          submitLabel="Lưu thay đổi"
        />
      </Modal>
    </PatientLayout>
  );
}
