import { useState } from 'react';
import { Alert, Button, ConfirmDialog, FormModal } from '../../components';
import { getErrorMessage } from '../../lib/errors';
import { createServiceCategory, updateServiceCategory } from './catalog.api';
import { CODE_PATTERN, TIER_LABEL, TYPE_LABEL, UNIT_LABEL } from './catalog.types';
import type { RequiredTier, ServiceCategory, ServiceInput, ServiceType, ServiceUnit } from './catalog.types';

interface ServiceFormModalProps {
  /** Có = sửa dịch vụ đó; không = tạo mới */
  service?: ServiceCategory;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: ServiceInput = { code: '', name: '', serviceType: 'TASK_BASED', isInvasive: false, isProhibited: false, requiredTier: 'TIER_1_BASIC', basePrice: 0, unit: 'PER_TIME', isActive: true };

/** Thay đổi cờ rủi ro (xâm lấn/cấm) cần xác nhận lại vì ảnh hưởng ai được nhận ca và có đặt được hay không. */
const riskyChange = (before: ServiceCategory | undefined, after: ServiceInput) =>
  !!before && (before.isProhibited !== after.isProhibited || before.isInvasive !== after.isInvasive || before.requiredTier !== after.requiredTier);

/** Tạo / sửa dịch vụ: cờ `is_invasive` ép Cấp 2; `is_prohibited` khoá không cho đặt. Mọi thay đổi ghi nhật ký kiểm toán. */
export function ServiceFormModal({ service, onClose, onSaved }: ServiceFormModalProps) {
  const editing = !!service;
  const [f, setF] = useState<ServiceInput>(service ? { ...service } : EMPTY);
  const [priceText, setPriceText] = useState(String(service?.basePrice ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const set = <K extends keyof ServiceInput>(k: K, v: ServiceInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const price = priceText.trim() === '' ? NaN : Number(priceText.replace(/[.\s,]/g, ''));
  const priceOk = Number.isInteger(price) && price >= 0;
  const codeOk = editing || CODE_PATTERN.test(f.code);
  const nameOk = f.name.trim().length >= 3 && f.name.length <= 150;
  const valid = codeOk && nameOk && priceOk;

  const toggleInvasive = (on: boolean) => setF((p) => ({ ...p, isInvasive: on, requiredTier: on ? 'TIER_2_SPECIALIST' : p.requiredTier }));
  const toggleProhibited = (on: boolean) => setF((p) => ({ ...p, isProhibited: on, isActive: on ? false : p.isActive }));

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload: ServiceInput = { ...f, name: f.name.trim(), basePrice: price };
    const res = service
      ? await updateServiceCategory(service.id, (({ code: _c, ...rest }) => rest)(payload))
      : await createServiceCategory(payload);
    setBusy(false);
    setConfirm(false);
    if (!res.success) {
      setError(res.error?.code === 'CODE_EXISTS' ? 'Mã dịch vụ này đã tồn tại.' : getErrorMessage(res.error, 'Chưa lưu được dịch vụ. Vui lòng thử lại.'));
      return;
    }
    onSaved();
  };

  const submit = () => (riskyChange(service, f) ? setConfirm(true) : save());

  return (
    <FormModal title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} subtitle={editing ? `${service!.code}` : 'Dịch vụ mới có thể đặt được ngay nếu để bật.'} onClose={onClose} busy={busy} wide>
      <div className="catalog-form">
        <div className="field">
          <label htmlFor="sv-code">Mã dịch vụ {!editing && <span className="req">*</span>}</label>
          <input id="sv-code" className={`input${f.code && !codeOk ? ' is-invalid' : ''}`} value={f.code} disabled={editing || busy} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="SRV_WOUND_CARE" maxLength={50} />
          {!editing && f.code && !codeOk && <div className="field-error">Chữ HOA, số, gạch dưới; 3–50 ký tự; bắt đầu bằng chữ.</div>}
          {editing && <div className="field-hint">Mã không đổi được sau khi tạo (đặt chỗ cũ tham chiếu tới mã này).</div>}
        </div>

        <div className="field">
          <label htmlFor="sv-name">Tên hiển thị <span className="req">*</span></label>
          <input id="sv-name" className={`input${f.name && !nameOk ? ' is-invalid' : ''}`} value={f.name} disabled={busy} onChange={(e) => set('name', e.target.value)} maxLength={150} />
        </div>

        <div className="catalog-form__row">
          <div className="field">
            <label htmlFor="sv-type">Loại</label>
            <select id="sv-type" className="input" value={f.serviceType} disabled={busy} onChange={(e) => set('serviceType', e.target.value as ServiceType)}>
              {(Object.keys(TYPE_LABEL) as ServiceType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sv-unit">Đơn vị tính giá</label>
            <select id="sv-unit" className="input" value={f.unit} disabled={busy} onChange={(e) => set('unit', e.target.value as ServiceUnit)}>
              {(Object.keys(UNIT_LABEL) as ServiceUnit[]).map((u) => <option key={u} value={u}>Theo {UNIT_LABEL[u]}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sv-price">Giá cơ bản (VNĐ / {UNIT_LABEL[f.unit]}) <span className="req">*</span></label>
            <input id="sv-price" className={`input${priceText && !priceOk ? ' is-invalid' : ''}`} inputMode="numeric" value={priceText} disabled={busy} onChange={(e) => setPriceText(e.target.value)} placeholder="150000" />
            {priceText && !priceOk && <div className="field-error">Nhập số nguyên không âm.</div>}
          </div>
        </div>
        {editing && service!.basePrice !== price && priceOk && <Alert tone="info" title="Giá mới chỉ áp dụng cho đặt chỗ tạo SAU khi lưu — đặt chỗ cũ giữ giá đã chụp." />}

        <fieldset className="catalog-flags">
          <legend>Điều kiện thực hiện</legend>
          <label className="consent-check">
            <input type="checkbox" checked={f.isInvasive} disabled={busy} onChange={(e) => toggleInvasive(e.target.checked)} />
            <span><b>Thủ thuật xâm lấn</b> (<code>is_invasive</code>) — bắt buộc y lệnh bác sĩ ≤ 7 ngày và chỉ Cấp 2 được nhận (Cấp 1 gọi nhận ca → 403).</span>
          </label>

          <div className="field">
            <label htmlFor="sv-tier">Cấp yêu cầu tối thiểu (<code>required_tier</code>)</label>
            <select id="sv-tier" className="input" value={f.requiredTier} disabled={busy || f.isInvasive} onChange={(e) => set('requiredTier', e.target.value as RequiredTier)}>
              {(Object.keys(TIER_LABEL) as RequiredTier[]).map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
            </select>
            {f.isInvasive && <div className="field-hint">Dịch vụ xâm lấn luôn yêu cầu Cấp 2.</div>}
          </div>

          <label className="consent-check">
            <input type="checkbox" checked={f.isProhibited} disabled={busy} onChange={(e) => toggleProhibited(e.target.checked)} />
            <span><b>Dịch vụ cấm</b> (<code>is_prohibited</code>) — không thể đặt dưới bất kỳ hình thức nào, kể cả qua công cụ Admin; tự động ẩn.</span>
          </label>

          <label className="consent-check">
            <input type="checkbox" checked={f.isActive} disabled={busy || f.isProhibited} onChange={(e) => set('isActive', e.target.checked)} />
            <span><b>Đang bán</b> — tắt để ẩn khỏi khách hàng (không xoá, vì đặt chỗ cũ còn tham chiếu).</span>
          </label>
        </fieldset>

        {error && <Alert title={error} />}
        <p className="muted us-audit">Mọi thay đổi được ghi vào nhật ký kiểm toán (người thực hiện, giá trị cũ/mới).</p>

        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Huỷ</Button>
          <Button type="button" onClick={submit} loading={busy} disabled={!valid}>{editing ? 'Lưu thay đổi' : 'Tạo dịch vụ'}</Button>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog title="Xác nhận đổi điều kiện thực hiện?" confirmLabel="Lưu thay đổi" tone={f.isProhibited ? 'danger' : 'primary'} busy={busy} onConfirm={save} onCancel={() => setConfirm(false)}>
          {f.isProhibited && !service!.isProhibited ? 'Dịch vụ sẽ bị CẤM và ẩn: không ai đặt được nữa. ' : null}
          {f.isInvasive !== service!.isInvasive ? (f.isInvasive ? 'Dịch vụ trở thành XÂM LẤN: chỉ Cấp 2 nhận, bắt buộc y lệnh. ' : 'Dịch vụ không còn xâm lấn: Cấp 1 cũng nhận được, không cần y lệnh — chỉ làm khi đã có căn cứ chuyên môn. ') : null}
          {f.requiredTier !== service!.requiredTier ? `Cấp yêu cầu đổi sang ${TIER_LABEL[f.requiredTier]}. ` : null}
          Thay đổi áp dụng ngay cho các lượt đặt/nhận ca mới.
        </ConfirmDialog>
      )}
    </FormModal>
  );
}
