import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Send, X } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/formatters';
import { useAuth } from '../auth';
import { SERVICE_CATEGORIES, SHIFT_HOURS } from '../nurse-search/nurse-search.types';
import { Stepper } from '../onboarding/components/Stepper';
import type { StepStatus } from '../onboarding/components/Stepper';
import { getPatientProfiles } from '../patient-profiles/patient-profiles.api';
import type { PatientProfileDto } from '../patient-profiles/patient-profiles.types';
import { createBooking, quoteBooking, toWindow, uploadPrescription } from './booking.api';
import type { BookingDraft, PricingQuote } from './booking.types';
import { PaymentMethodSelector } from './components/PaymentMethodSelector';
import { PricingCard } from './components/PricingCard';
import { PrescriptionUpload, prescriptionDateError } from './components/PrescriptionUpload';

const STEP_TITLES = ['Chọn dịch vụ', 'Chọn người bệnh', 'Chọn thời gian', 'Xác nhận & thanh toán'];
const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type ProfilesLoad = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; items: PatientProfileDto[] };

/**
 * Luồng đặt ca (FR-BOOK-01/02): dịch vụ → hồ sơ người bệnh → khung giờ → xác nhận.
 * Mở từ màn hình tìm điều dưỡng với ?nurseId=… thì đây là lời mời trực tiếp (BR-13 §2.2).
 * Dịch vụ xâm lấn bắt buộc ảnh y lệnh. Giá do backend tính.
 */
export function BookingNewPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [invitedName, setInvitedName] = useState(params.get('nurseName'));
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const service = SERVICE_CATEGORIES.find((s) => s.code === params.get('service'));
    const wanted = Number(params.get('duration')) || 0;
    return {
      serviceCode: service?.code ?? '',
      patientProfileId: '',
      slot: {
        date: params.get('date') ?? '',
        startTime: params.get('startTime') ?? '',
        durationHours: service?.unit === 'PER_TIME' ? 1 : (SHIFT_HOURS as readonly number[]).includes(wanted) ? wanted : 0,
      },
      paymentMethod: null,
      prescriptionFile: null,
      prescriptionIssuedDate: '',
      invitedNurseId: params.get('nurseId'),
    };
  });
  const [profiles, setProfiles] = useState<ProfilesLoad>({ state: 'loading' });
  const [quote, setQuote] = useState<{ state: 'idle' | 'loading' | 'error' | 'ready'; data?: PricingQuote; message?: string }>({ state: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const service = SERVICE_CATEGORIES.find((s) => s.code === draft.serviceCode);
  const invasive = service?.group === 'INVASIVE';
  const profile = profiles.state === 'ready' ? profiles.items.find((p) => p.id === draft.patientProfileId) : undefined;
  const window = toWindow(draft.slot);
  const startsInFuture = !!window && Date.parse(window.startAt) > Date.now();
  const kycMissing = profile?.location_type === 'HOME' && user?.kyc_status !== 'VERIFIED';

  useEffect(() => {
    let cancelled = false;
    getPatientProfiles().then((res) => {
      if (cancelled) return;
      setProfiles(res.success ? { state: 'ready', items: res.data } : { state: 'error', message: getErrorMessage(res.error) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof BookingDraft>(key: K, value: BookingDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const pickService = (code: string) => {
    const s = SERVICE_CATEGORIES.find((x) => x.code === code);
    setDraft((d) => ({
      ...d,
      serviceCode: code,
      prescriptionFile: s?.group === 'INVASIVE' ? d.prescriptionFile : null,
      prescriptionIssuedDate: s?.group === 'INVASIVE' ? d.prescriptionIssuedDate : '',
      slot: {
        ...d.slot,
        durationHours: s?.unit === 'PER_TIME' ? 1 : (SHIFT_HOURS as readonly number[]).includes(d.slot.durationHours) ? d.slot.durationHours : 0,
      },
    }));
  };

  /* Bước 4: lấy bảng giá từ backend mỗi khi thông tin đổi */
  const quoteKey = step === 4 && window ? `${draft.serviceCode}|${draft.patientProfileId}|${window.startAt}|${window.endAt}` : '';
  useEffect(() => {
    if (!quoteKey || !window) return;
    let cancelled = false;
    setQuote({ state: 'loading' });
    quoteBooking({ serviceCode: draft.serviceCode, patientProfileId: draft.patientProfileId, startAt: window.startAt, endAt: window.endAt }).then((res) => {
      if (cancelled) return;
      setQuote(res.success ? { state: 'ready', data: res.data } : { state: 'error', message: getErrorMessage(res.error, 'Chưa tính được giá. Vui lòng thử lại.') });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const canNext: Record<1 | 2 | 3, boolean> = {
    1: !!service && (!invasive || (!!draft.prescriptionFile && !!draft.prescriptionIssuedDate && !prescriptionDateError(draft.prescriptionIssuedDate))),
    2: !!profile && profile.data_consent_accepted,
    3: startsInFuture,
  };
  const canSubmit = !!draft.paymentMethod && quote.state === 'ready' && !kycMissing && !submitting;

  const statusOf = (n: number): StepStatus => (n < step ? 'done' : n === step ? 'now' : 'todo');

  const submit = async () => {
    if (!window || !draft.paymentMethod || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);

    let prescription: { imageKey: string; issuedDate: string } | undefined;
    if (invasive && draft.prescriptionFile) {
      const up = await uploadPrescription(draft.prescriptionFile);
      if (!up.success) {
        setSubmitting(false);
        setSubmitError(getErrorMessage(up.error));
        return;
      }
      prescription = { imageKey: up.data.imageKey, issuedDate: draft.prescriptionIssuedDate };
    }

    const res = await createBooking({
      serviceCode: draft.serviceCode,
      patientProfileId: draft.patientProfileId,
      startAt: window.startAt,
      endAt: window.endAt,
      paymentMethod: draft.paymentMethod,
      prescription,
      invitedNurseId: draft.invitedNurseId ?? undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(getErrorMessage(res.error, 'Chưa tạo được ca. Vui lòng thử lại.'));
      return;
    }
    navigate(res.data.paymentMethod === 'BANK_TRANSFER' ? `/bookings/${res.data.id}/pay` : '/bookings', {
      replace: true,
      state: { flash: res.data.paymentMethod === 'CASH' ? `Đã tạo ca ${res.data.code}. Chúng tôi đang tìm điều dưỡng phù hợp.` : undefined },
    });
  };

  const urgency = useMemo(() => {
    if (!window || !startsInFuture) return null;
    const hoursAhead = (Date.parse(window.startAt) - Date.now()) / 3_600_000;
    return hoursAhead <= 6 ? 'urgent' : 'advance';
  }, [window, startsInFuture]);

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head">
        <h1>Đặt ca chăm sóc</h1>
        <p>Chọn dịch vụ, người cần chăm sóc và thời gian — giá được hiển thị rõ trước khi bạn xác nhận.</p>
      </div>

      <Stepper steps={STEP_TITLES.map((title, i) => ({ title, status: statusOf(i + 1) }))} />

      {draft.invitedNurseId && invitedName && (
        <div className="card bk-invite" role="note">
          <Send size={18} aria-hidden="true" />
          <div>
            <b>Mời trực tiếp điều dưỡng {invitedName}</b>
            <p>Điều dưỡng có 15 phút để phản hồi. Nếu từ chối hoặc không phản hồi, ca sẽ được đăng lên Job Board cho các điều dưỡng phù hợp.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Bỏ lời mời trực tiếp" onClick={() => { set('invitedNurseId', null); setInvitedName(null); }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* ---------- Bước 1: dịch vụ (+ y lệnh nếu xâm lấn) ---------- */}
      {step === 1 && (
        <>
          <section className="card step-card" aria-labelledby="bk-s1">
            <h3 id="bk-s1" className="step-card__title">Bước 1 · Bạn cần dịch vụ nào?</h3>
            <p className="step-card__sub">Thủ thuật y tế chỉ do điều dưỡng Cấp 2 có GPHN thực hiện, theo y lệnh của bác sĩ.</p>
            {(['NON_INVASIVE', 'INVASIVE'] as const).map((group) => (
              <div key={group} className="bk-group">
                <h4>{group === 'NON_INVASIVE' ? 'Chăm sóc cơ bản' : 'Thủ thuật y tế (cần y lệnh)'}</h4>
                <div className="bk-choices" role="radiogroup" aria-label={group === 'NON_INVASIVE' ? 'Chăm sóc cơ bản' : 'Thủ thuật y tế'}>
                  {SERVICE_CATEGORIES.filter((s) => s.group === group).map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      role="radio"
                      aria-checked={draft.serviceCode === s.code}
                      className={`choice${draft.serviceCode === s.code ? ' selected' : ''}`}
                      onClick={() => pickService(s.code)}
                    >
                      <h4>{s.label}</h4>
                      <p>{s.unit === 'PER_HOUR' ? 'Tính theo giờ · ca 4/8/12/24 giờ' : 'Tính theo lượt · khoảng 1 giờ'}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {invasive && (
            <PrescriptionUpload
              file={draft.prescriptionFile}
              issuedDate={draft.prescriptionIssuedDate}
              onFileChange={(f) => set('prescriptionFile', f)}
              onDateChange={(d) => set('prescriptionIssuedDate', d)}
            />
          )}
        </>
      )}

      {/* ---------- Bước 2: hồ sơ người bệnh ---------- */}
      {step === 2 && (
        <section className="card step-card" aria-labelledby="bk-s2">
          <h3 id="bk-s2" className="step-card__title">Bước 2 · Chăm sóc cho ai?</h3>
          <p className="step-card__sub">Thông tin sức khỏe trong hồ sơ ảnh hưởng đến giá (cân nặng, mức vận động) và được điều dưỡng xem để chuẩn bị.</p>

          {profiles.state === 'loading' && <p className="skeleton">Đang tải hồ sơ…</p>}
          {profiles.state === 'error' && <Alert title={profiles.message} />}
          {profiles.state === 'ready' && profiles.items.length === 0 && (
            <Alert tone="info" title="Bạn chưa có hồ sơ người được chăm sóc.">
              <Link to="/patient-profiles" className="link-strong">Tạo hồ sơ trước →</Link>
            </Alert>
          )}
          {profiles.state === 'ready' && profiles.items.length > 0 && (
            <div className="bk-choices" role="radiogroup" aria-label="Người được chăm sóc">
              {profiles.items.map((p) => {
                const blocked = !p.data_consent_accepted;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={draft.patientProfileId === p.id}
                    disabled={blocked}
                    className={`choice${draft.patientProfileId === p.id ? ' selected' : ''}`}
                    onClick={() => set('patientProfileId', p.id)}
                  >
                    <h4>{p.full_name}</h4>
                    <p>
                      {p.location_type === 'HOME' ? 'Chăm sóc tại nhà' : 'Chăm sóc tại bệnh viện'}
                      {blocked && ' · Chưa có đồng ý xử lý dữ liệu — vào Hồ sơ để đồng ý'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ---------- Bước 3: khung giờ ---------- */}
      {step === 3 && (
        <section className="card step-card" aria-labelledby="bk-s3">
          <h3 id="bk-s3" className="step-card__title">Bước 3 · Chăm sóc vào lúc nào?</h3>
          <p className="step-card__sub">Ca đêm (22:00–06:00) và ngày lễ có phụ phí — bạn sẽ thấy chi tiết ở bước cuối.</p>
          <div className="bk-slot">
            <div className="field">
              <label htmlFor="bk-date">Ngày</label>
              <input id="bk-date" type="date" className="input" min={todayLocal()} value={draft.slot.date} onChange={(e) => set('slot', { ...draft.slot, date: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="bk-time">Giờ bắt đầu</label>
              <input id="bk-time" type="time" className="input" value={draft.slot.startTime} onChange={(e) => set('slot', { ...draft.slot, startTime: e.target.value })} />
            </div>
          </div>
          {service?.unit === 'PER_HOUR' ? (
            <div className="field">
              <span className="field-label">Độ dài ca</span>
              <div className="chip-select" role="group" aria-label="Độ dài ca">
                {SHIFT_HOURS.map((h) => (
                  <button key={h} type="button" className={draft.slot.durationHours === h ? 'selected' : ''} aria-pressed={draft.slot.durationHours === h} onClick={() => set('slot', { ...draft.slot, durationHours: h })}>
                    {h} giờ
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="hint"><Clock size={14} aria-hidden="true" /> Dịch vụ tính theo lượt, thời lượng khoảng 1 giờ.</p>
          )}
          {window && !startsInFuture && <div className="field-error" role="alert">Giờ bắt đầu phải ở tương lai.</div>}
          {urgency === 'urgent' && <Alert tone="info" title="Ca gấp (bắt đầu trong vòng 6 giờ)">Hệ thống sẽ tìm điều dưỡng gần bạn theo từng đợt, ưu tiên điều dưỡng nhận ca đầu tiên.</Alert>}
          {urgency === 'advance' && <Alert tone="info" title="Ca đặt trước">Ca được đăng lên Job Board; điều dưỡng phù hợp sẽ nhận theo thứ tự ai nhận trước. Nếu chưa có ai nhận trước giờ bắt đầu 30 phút, ca hết hạn và được hoàn tiền 100%.</Alert>}
        </section>
      )}

      {/* ---------- Bước 4: xác nhận ---------- */}
      {step === 4 && (
        <>
          <section className="card step-card" aria-labelledby="bk-s4">
            <h3 id="bk-s4" className="step-card__title">Bước 4 · Kiểm tra lại</h3>
            <dl className="bk-summary">
              <div><dt>Dịch vụ</dt><dd>{service?.label}</dd></div>
              <div><dt>Người được chăm sóc</dt><dd>{profile?.full_name}</dd></div>
              <div><dt>Thời gian</dt><dd>{window ? `${formatDateTime(window.startAt)} → ${formatDateTime(window.endAt)}` : '—'}</dd></div>
              {invasive && <div><dt>Y lệnh</dt><dd>Đã đính kèm · kê ngày {draft.prescriptionIssuedDate} · chờ Admin duyệt</dd></div>}
              {invitedName && <div><dt>Điều dưỡng được mời</dt><dd>{invitedName}</dd></div>}
            </dl>
          </section>

          {quote.state === 'loading' && <div className="card step-card skeleton">Đang tính giá…</div>}
          {quote.state === 'error' && <Alert title={quote.message} />}
          {quote.state === 'ready' && quote.data && <PricingCard quote={quote.data} perHour={service?.unit === 'PER_HOUR'} />}

          <PaymentMethodSelector value={draft.paymentMethod} onChange={(m) => set('paymentMethod', m)} disabled={submitting} />

          {kycMissing && (
            <Alert title="Cần xác thực CCCD trước khi đặt chăm sóc tại nhà.">
              <Link to="/onboarding" className="link-strong">Xác thực CCCD ngay →</Link>
            </Alert>
          )}
          {submitError && <Alert title={submitError} />}
        </>
      )}

      <div className="step-card__actions bk-actions">
        {step > 1 ? (
          <Button variant="secondary" type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting}>← Quay lại</Button>
        ) : (
          <Link to="/nurses" className="btn btn-secondary">Hủy</Link>
        )}
        {step < 4 ? (
          <Button type="button" size="lg" onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)} disabled={!canNext[step as 1 | 2 | 3]}>Tiếp tục →</Button>
        ) : (
          <Button type="button" size="lg" onClick={submit} disabled={!canSubmit} loading={submitting}>
            {draft.paymentMethod === 'CASH' ? 'Xác nhận đặt ca' : 'Xác nhận & thanh toán'}
          </Button>
        )}
      </div>
    </PatientLayout>
  );
}
