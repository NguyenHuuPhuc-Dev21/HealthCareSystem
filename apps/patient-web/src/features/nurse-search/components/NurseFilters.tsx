import type { NurseSearchFilters, NurseTier, NurseGender } from '../nurse-search.types';
import { DISTRICTS, EMPTY_FILTERS, SERVICE_CATEGORIES, SHIFT_HOURS } from '../nurse-search.types';

interface NurseFiltersProps {
  value: NurseSearchFilters;
  onChange: (next: NurseSearchFilters) => void;
  disabled?: boolean;
}

const TIER_OPTIONS: Array<{ value: NurseTier | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'TIER_1_BASIC', label: 'Cấp 1' },
  { value: 'TIER_2_SPECIALIST', label: 'Cấp 2' },
];

const GENDER_OPTIONS: Array<{ value: NurseGender | ''; label: string }> = [
  { value: '', label: 'Bất kỳ' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'MALE', label: 'Nam' },
];

const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Thông báo khi khung giờ nhập dở (cần đủ ngày + giờ bắt đầu + độ dài ca). */
export function timeSlotHint(f: NurseSearchFilters): string | null {
  const filled = [f.date, f.startTime, f.durationHours].filter(Boolean).length;
  return filled > 0 && filled < 3 ? 'Chọn đủ ngày, giờ bắt đầu và độ dài ca để lọc theo lịch trống.' : null;
}

/** Bộ lọc FR-SEARCH-01: dịch vụ · khu vực · khung giờ · Tier · giới tính. */
export function NurseFilters({ value, onChange, disabled }: NurseFiltersProps) {
  const set = <K extends keyof NurseSearchFilters>(key: K, v: NurseSearchFilters[K]) => onChange({ ...value, [key]: v });
  const service = SERVICE_CATEGORIES.find((s) => s.code === value.service);
  const invasive = service?.group === 'INVASIVE';
  const hint = timeSlotHint(value);

  return (
    <form className="card ns-filters" onSubmit={(e) => e.preventDefault()} aria-label="Bộ lọc điều dưỡng">
      <div className="field">
        <label htmlFor="ns-service">Dịch vụ cần chăm sóc</label>
        <select
          id="ns-service"
          className="input"
          value={value.service}
          onChange={(e) => {
            const next = SERVICE_CATEGORIES.find((s) => s.code === e.target.value);
            // Dịch vụ xâm lấn chỉ Tier 2 làm được (BR-15) → bỏ lọc Cấp 1 nếu đang chọn
            onChange({ ...value, service: e.target.value, tier: next?.group === 'INVASIVE' && value.tier === 'TIER_1_BASIC' ? '' : value.tier });
          }}
          disabled={disabled}
        >
          <option value="">Tất cả dịch vụ</option>
          <optgroup label="Chăm sóc cơ bản">
            {SERVICE_CATEGORIES.filter((s) => s.group === 'NON_INVASIVE').map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
          <optgroup label="Thủ thuật y tế (cần y lệnh)">
            {SERVICE_CATEGORIES.filter((s) => s.group === 'INVASIVE').map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </optgroup>
        </select>
        {invasive && <div className="hint">Thủ thuật y tế chỉ điều dưỡng Cấp 2 (có GPHN còn hạn) được thực hiện, kèm y lệnh bác sĩ.</div>}
      </div>

      <div className="field">
        <label htmlFor="ns-district">Khu vực</label>
        <select id="ns-district" className="input" value={value.district} onChange={(e) => set('district', e.target.value)} disabled={disabled}>
          <option value="">Tất cả quận/huyện</option>
          {DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <fieldset className="field ns-slot">
        <legend>Khung giờ cần chăm sóc</legend>
        <div className="ns-slot__row">
          <input
            type="date"
            className="input"
            aria-label="Ngày"
            min={todayLocal()}
            value={value.date}
            onChange={(e) => set('date', e.target.value)}
            disabled={disabled}
          />
          <input
            type="time"
            className="input"
            aria-label="Giờ bắt đầu"
            value={value.startTime}
            onChange={(e) => set('startTime', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="chip-select" role="group" aria-label="Độ dài ca">
          {SHIFT_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className={value.durationHours === h ? 'selected' : ''}
              aria-pressed={value.durationHours === h}
              onClick={() => set('durationHours', value.durationHours === h ? null : h)}
              disabled={disabled}
            >
              {h} giờ
            </button>
          ))}
        </div>
        {hint && <div className="hint">{hint}</div>}
      </fieldset>

      <div className="ns-filters__row">
        <fieldset className="field">
          <legend>Cấp độ</legend>
          <div className="chip-select" role="group" aria-label="Cấp độ điều dưỡng">
            {TIER_OPTIONS.map((o) => {
              const blocked = invasive && o.value === 'TIER_1_BASIC';
              return (
                <button
                  key={o.value || 'all'}
                  type="button"
                  className={value.tier === o.value ? 'selected' : ''}
                  aria-pressed={value.tier === o.value}
                  onClick={() => set('tier', o.value)}
                  disabled={disabled || blocked}
                  title={blocked ? 'Cấp 1 không thực hiện được thủ thuật y tế' : undefined}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Giới tính</legend>
          <div className="chip-select" role="group" aria-label="Giới tính điều dưỡng">
            {GENDER_OPTIONS.map((o) => (
              <button
                key={o.value || 'any'}
                type="button"
                className={value.gender === o.value ? 'selected' : ''}
                aria-pressed={value.gender === o.value}
                onClick={() => set('gender', o.value)}
                disabled={disabled}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <button type="button" className="link-button" onClick={() => onChange(EMPTY_FILTERS)} disabled={disabled}>
        Xoá bộ lọc
      </button>
    </form>
  );
}
