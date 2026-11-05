import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button } from '../../components';
import { SetupLayout } from '../../components/layout/SetupLayout';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth';
import { getMyKyc } from '../ekyc/ekyc.api';
import type { CustomerKyc } from '../ekyc/ekyc.types';
import { EkycStep } from '../ekyc/EkycStep';
import { EkycSummary } from '../ekyc/EkycSummary';
import { createPatientProfile } from '../patient-profiles/patient-profiles.api';
import { EMPTY_DRAFT, MOBILITY_OPTIONS, RELATIONSHIP_OPTIONS } from '../patient-profiles/patient-profiles.types';
import type { PatientProfileDraft } from '../patient-profiles/patient-profiles.types';
import { ConsentStep } from '../patient-profiles/components/ConsentStep';
import { PatientProfileForm } from '../patient-profiles/components/PatientProfileForm';
import { ageFromBirthYear, toCreateRequest } from '../patient-profiles/validation';
import { Stepper, StepSummary } from './components/Stepper';
import type { StepStatus } from './components/Stepper';

type KycLoad =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; kyc: CustomerKyc };

/**
 * SH3 — eKYC khách hàng & tạo hồ sơ người bệnh đầu tiên.
 *   Bước 1: nộp CCCD 2 mặt + selfie → PENDING (Admin duyệt thủ công)
 *   Bước 2: điền hồ sơ người bệnh (chỉ giữ ở client)
 *   Bước 3: tick đồng ý NĐ 13 → gửi hồ sơ + đồng ý trong 1 request
 *
 * Dữ liệu sức khoẻ ở Bước 2 KHÔNG lưu vào localStorage/sessionStorage (dữ liệu nhạy cảm).
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, signOut, updateUser } = useAuth();

  const [kycLoad, setKycLoad] = useState<KycLoad>({ state: 'loading' });
  const [editingKyc, setEditingKyc] = useState(false);
  const [draft, setDraft] = useState<PatientProfileDraft>(EMPTY_DRAFT);
  const [profileReady, setProfileReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadKyc = useCallback(async () => {
    setKycLoad({ state: 'loading' });
    const res = await getMyKyc();
    setKycLoad(res.success ? { state: 'ready', kyc: res.data } : { state: 'error', message: getErrorMessage(res.error) });
  }, []);

  useEffect(() => {
    loadKyc();
  }, [loadKyc]);

  const kyc = kycLoad.state === 'ready' ? kycLoad.kyc : null;
  const step1Done = !!kyc && kyc.kyc_status !== 'UNVERIFIED' && !editingKyc;
  const current: 1 | 2 | 3 = !step1Done ? 1 : !profileReady ? 2 : 3;
  const statusOf = (n: 1 | 2 | 3): StepStatus => (n < current ? 'done' : n === current ? 'now' : 'todo');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const handleKycSubmitted = (next: CustomerKyc) => {
    setKycLoad({ state: 'ready', kyc: next });
    setEditingKyc(false);
    updateUser({ kyc_status: next.kyc_status });
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const res = await createPatientProfile(toCreateRequest(draft));
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(getErrorMessage(res.error, 'Chưa lưu được hồ sơ. Vui lòng thử lại.'));
      return;
    }
    navigate('/patient-profiles', { replace: true, state: { flash: `Đã tạo hồ sơ cho ${res.data.full_name}.` } });
  };

  const profileSummary = () => {
    const relation = RELATIONSHIP_OPTIONS.find((o) => o.value === draft.relationship)?.label;
    const mobility = MOBILITY_OPTIONS.find((o) => o.value === draft.mobility_status)?.title;
    const age = ageFromBirthYear(draft.birth_year);
    return [draft.full_name.trim(), relation, age !== null ? `${age} tuổi` : null, mobility].filter(Boolean).join(' · ');
  };

  return (
    <SetupLayout fullName={user?.full_name} onSignOut={signOut}>
      <div className="page-head">
        <h1>Xác thực danh tính & tạo hồ sơ</h1>
        <p>Hoàn tất 3 bước để bắt đầu đặt lịch chăm sóc</p>
      </div>

      <Stepper
        steps={[
          { title: 'Xác thực CCCD', status: statusOf(1) },
          { title: 'Hồ sơ người được chăm sóc', status: statusOf(2) },
          { title: 'Đồng ý dữ liệu', status: statusOf(3) },
        ]}
      />

      {/* ---------- Bước 1 ---------- */}
      {kycLoad.state === 'loading' && <div className="card step-card skeleton">Đang tải trạng thái xác thực…</div>}
      {kycLoad.state === 'error' && (
        <div className="card step-card">
          <Alert title="Không tải được trạng thái xác thực.">{kycLoad.message}</Alert>
          <Button variant="secondary" onClick={loadKyc}>Thử lại</Button>
        </div>
      )}
      {kyc &&
        (current === 1 ? (
          <EkycStep
            rejectionReason={kyc.rejection_reason}
            onSubmitted={handleKycSubmitted}
            onCancelEdit={editingKyc ? () => setEditingKyc(false) : undefined}
          />
        ) : (
          <EkycSummary kyc={kyc} onEdit={() => setEditingKyc(true)} />
        ))}

      {/* ---------- Bước 2 ---------- */}
      {kyc && current === 2 && (
        <PatientProfileForm value={draft} onChange={setDraft} onContinue={() => setProfileReady(true)} />
      )}
      {kyc && current === 3 && (
        <StepSummary
          n={2}
          done
          title="Bước 2 · Hồ sơ người được chăm sóc"
          description={profileSummary()}
          action={<button type="button" className="link-button" onClick={() => setProfileReady(false)}>Chỉnh sửa</button>}
        />
      )}
      {kyc && current === 1 && (
        <StepSummary
          n={2}
          title="Bước 2 · Hồ sơ người được chăm sóc"
          description="Hoàn tất Bước 1 để mở bước này."
        />
      )}

      {/* ---------- Bước 3 ---------- */}
      {kyc && current === 3 ? (
        <ConsentStep submitting={submitting} error={submitError} onSubmit={handleFinish} />
      ) : (
        kyc && (
          <StepSummary
            n={3}
            title="Bước 3 · Đồng ý xử lý dữ liệu sức khỏe"
            description="Xác nhận theo Nghị định 13/2023/NĐ-CP — hệ thống ghi lại thời điểm và thiết bị khi bạn đồng ý. Hoàn tất Bước 2 để mở bước này."
            action={<Button variant="secondary" disabled>Hoàn tất</Button>}
          />
        )
      )}
    </SetupLayout>
  );
}
