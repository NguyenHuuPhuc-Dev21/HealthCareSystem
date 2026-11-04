import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../../components';
import { Check, MapPin } from 'lucide-react';
import {
  LOCATION_OPTIONS,
  MOBILITY_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from '../patient-profiles.types';
import type { PatientProfileDraft } from '../patient-profiles.types';
import { ageFromBirthYear, validateDraft } from '../validation';
import type { DraftErrors } from '../validation';

interface PatientProfileFormProps {
  value: PatientProfileDraft;
  onChange: (next: PatientProfileDraft) => void;
  /** Gọi khi form hợp lệ và người dùng bấm "Lưu & tiếp tục" */
  onContinue: () => void;
  submitLabel?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  submitting?: boolean;
  /** Nội dung chèn ngay trước nút submit (vd. khối đồng ý ở P13) */
  beforeActions?: ReactNode;
  /** Nội dung sau nút submit (vd. vùng nguy hiểm ở P13) */
  footer?: ReactNode;
}

type GeoState = 'idle' | 'locating' | 'error';

/** SH3 · Bước 2 — Hồ sơ người được chăm sóc. Dữ liệu chỉ nằm ở client cho tới Bước 3. */
export function PatientProfileForm({
  value,
  onChange,
  onContinue,
  submitLabel = 'Lưu & tiếp tục sang Bước 3 →',
  title = 'Bước 2 · Hồ sơ người được chăm sóc',
  subtitle = 'Thông tin này chỉ hiển thị cho điều dưỡng được phân ca và đội ngũ vận hành khi cần hỗ trợ.',
  submitting = false,
  beforeActions,
  footer,
}: PatientProfileFormProps) {
  const [errors, setErrors] = useState<DraftErrors>({});
  const [geo, setGeo] = useState<GeoState>('idle');

  const set = <K extends keyof PatientProfileDraft>(key: K, v: PatientProfileDraft[K]) => {
    onChange({ ...value, [key]: v });
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const age = ageFromBirthYear(value.birth_year);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const found = validateDraft(value);
    setErrors(found);
    const firstKey = Object.keys(found)[0];
    if (firstKey) {
      document.getElementById(`pp-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    onContinue();
  };

  const pinCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeo('error');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ ...value, lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeo('idle');
      },
      () => setGeo('error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const fieldError = (key: keyof PatientProfileDraft) =>
    errors[key] ? <div className="field-error" role="alert">{errors[key]}</div> : null;

  return (
    <form className="card step-card" onSubmit={handleSubmit} noValidate aria-labelledby="pp-title">
      <h3 id="pp-title" className="step-card__title">{title}</h3>
      {subtitle && <p className="step-card__sub">{subtitle}</p>}

      {/* Mối quan hệ */}
      <div className="field" id="pp-relationship">
        <span className="field-label">Mối quan hệ với người được chăm sóc <span className="req">*</span></span>
        <div className="chip-select" role="radiogroup" aria-label="Mối quan hệ">
          {RELATIONSHIP_OPTIONS.map((opt) => {
            const selected = value.relationship === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'selected' : undefined}
                onClick={() => set('relationship', opt.value)}
              >
                {opt.label}{selected && <Check size={14} style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'middle' }} />}
              </button>
            );
          })}
        </div>
        {fieldError('relationship')}
      </div>

      {/* Họ tên · Năm sinh · Cân nặng */}
      <div className="cols-3">
        <div className="field" id="pp-full_name">
          <label htmlFor="pp-name">Họ và tên người bệnh <span className="req">*</span></label>
          <input
            id="pp-name"
            className={`input${errors.full_name ? ' is-invalid' : ''}`}
            value={value.full_name}
            onChange={(e) => set('full_name', e.target.value)}
            autoComplete="off"
            maxLength={100}
            placeholder="Nguyễn Thị Hoa"
          />
          {fieldError('full_name')}
        </div>
        <div className="field" id="pp-birth_year">
          <label htmlFor="pp-year">Năm sinh <span className="req">*</span></label>
          <div className="input-suffix-wrap">
            <input
              id="pp-year"
              className={`input${errors.birth_year ? ' is-invalid' : ''}`}
              value={value.birth_year}
              onChange={(e) => set('birth_year', e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="1948"
            />
            {age !== null && !errors.birth_year && <span className="input-suffix">{age} tuổi</span>}
          </div>
          {fieldError('birth_year')}
        </div>
        <div className="field" id="pp-weight_kg">
          <label htmlFor="pp-weight">Cân nặng (kg) <span className="req">*</span></label>
          <input
            id="pp-weight"
            className={`input${errors.weight_kg ? ' is-invalid' : ''}`}
            value={value.weight_kg}
            onChange={(e) => set('weight_kg', e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))}
            inputMode="decimal"
            placeholder="52"
          />
          {fieldError('weight_kg')}
        </div>
      </div>

      {/* Mức độ vận động */}
      <div className="field" id="pp-mobility_status">
        <span className="field-label">Mức độ vận động <span className="req">*</span></span>
        <div className="choice-grid" role="radiogroup" aria-label="Mức độ vận động">
          {MOBILITY_OPTIONS.map((opt) => {
            const selected = value.mobility_status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`choice${selected ? ' selected' : ''}`}
                onClick={() => set('mobility_status', opt.value)}
              >
                <h4>{opt.icon} {opt.title}{selected && <Check size={14} style={{ marginLeft: 6, display: 'inline-block', verticalAlign: 'middle' }} />}</h4>
                <p>{opt.description}</p>
              </button>
            );
          })}
        </div>
        {fieldError('mobility_status')}
      </div>

      {/* Tiền sử bệnh */}
      <div className="field" id="pp-medical_history">
        <label htmlFor="pp-history">Tiền sử bệnh & dị ứng <span className="req">*</span></label>
        <textarea
          id="pp-history"
          className={`input textarea${errors.medical_history ? ' is-invalid' : ''}`}
          rows={3}
          value={value.medical_history}
          onChange={(e) => set('medical_history', e.target.value)}
          maxLength={2000}
          placeholder="Bệnh nền, thuốc đang dùng, phẫu thuật gần đây, dị ứng thuốc…"
        />
        <div className="hint">Ghi rõ bệnh nền, phẫu thuật gần đây và mọi tiền sử dị ứng thuốc — điều dưỡng sẽ đọc trước khi nhận ca.</div>
        {fieldError('medical_history')}
      </div>

      {/* Bệnh truyền nhiễm */}
      <div className="infectious-box">
        <div className="infectious-box__text">
          <b id="pp-infectious-label">Nguy cơ bệnh truyền nhiễm</b>
          <p>Khai báo trung thực để điều dưỡng chuẩn bị đồ bảo hộ phù hợp (viêm gan B, lao, bệnh lây qua đường máu/hô hấp…).</p>
        </div>
        <span className={`chip ${value.is_infectious ? 'red' : 'teal'}`}>{value.is_infectious ? 'Có' : 'Không có'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={value.is_infectious}
          aria-labelledby="pp-infectious-label"
          className={`toggle${value.is_infectious ? ' on' : ''}`}
          onClick={() => set('is_infectious', !value.is_infectious)}
        />
      </div>

      {/* Nơi chăm sóc — SRS: patient_profiles.location_type; thiết kế SH3 chưa vẽ trường này */}
      <div className="field" id="pp-location_type">
        <span className="field-label">Nơi chăm sóc <span className="req">*</span></span>
        <div className="chip-select" role="radiogroup" aria-label="Nơi chăm sóc">
          {LOCATION_OPTIONS.map((opt) => {
            const selected = value.location_type === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'selected' : undefined}
                onClick={() => set('location_type', opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {fieldError('location_type')}
      </div>

      {/* Địa chỉ */}
      <div className="field" id="pp-address_text">
        <label htmlFor="pp-address">
          {value.location_type === 'HOSPITAL' ? 'Bệnh viện, khoa, số phòng' : 'Địa chỉ nơi chăm sóc'} <span className="req">*</span>
        </label>
        <input
          id="pp-address"
          className={`input${errors.address_text ? ' is-invalid' : ''}`}
          value={value.address_text}
          onChange={(e) => set('address_text', e.target.value)}
          maxLength={255}
          placeholder={
            value.location_type === 'HOSPITAL'
              ? 'Bệnh viện Đà Nẵng, khoa Nội tim mạch, phòng 305'
              : 'Số 25 Quang Trung, phường Hải Châu 1, quận Hải Châu, Đà Nẵng'
          }
        />
        {fieldError('address_text')}
        <div className="geo-row">
          {value.lat !== null ? (
            <span className="gps-chip"><span className="gps-dot" /> Đã ghim vị trí hiện tại</span>
          ) : (
            <span className="hint">Chưa ghim vị trí — hệ thống sẽ định vị theo địa chỉ bạn nhập.</span>
          )}
          <button type="button" className="link-button" onClick={pinCurrentLocation} disabled={geo === 'locating'}>
            {geo === 'locating' ? 'Đang lấy vị trí…' : value.lat !== null ? 'Ghim lại' : <><MapPin size={16} style={{ marginRight: 6 }} /> Ghim vị trí hiện tại</>}
          </button>
        </div>
        {geo === 'error' && (
          <div className="field-error">Không lấy được vị trí. Bạn có thể bỏ qua — hệ thống sẽ định vị theo địa chỉ.</div>
        )}
      </div>

      {beforeActions}

      <div className="step-card__actions">
        <Button type="submit" size="lg" loading={submitting}>{submitLabel}</Button>
      </div>

      {footer}
    </form>
  );
}
