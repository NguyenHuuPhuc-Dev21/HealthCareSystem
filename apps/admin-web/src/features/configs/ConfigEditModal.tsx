import { useState } from 'react';
import { Alert, Button, ConfirmDialog, FormModal } from '../../components';
import { getErrorMessage } from '../../lib/errors';
import { updateSystemConfig } from './configs.api';
import { CRITICAL_KEYS, displayValue, ruleFor, validateValue } from './configs.types';
import type { ConfigItem } from './configs.types';

interface ConfigEditModalProps {
  config: ConfigItem;
  onClose: () => void;
  onSaved: (updated: ConfigItem) => void;
}

/** Sửa một tham số: kiểm tra kiểu/khoảng, xem trước "cũ → mới" dạng dễ đọc, xác nhận thêm với tham số quan trọng (tiền, phạt, bảo mật). */
export function ConfigEditModal({ config, onClose, onSaved }: ConfigEditModalProps) {
  const [value, setValue] = useState(config.value);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const problem = validateValue(config, value);
  const changed = value.trim() !== config.value;
  const critical = CRITICAL_KEYS.has(config.key);
  const rule = ruleFor(config.key, config.dataType);
  const preview = !problem && changed ? displayValue({ ...config, value: value.trim() }) : null;

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await updateSystemConfig(config.key, value.trim(), note.trim() || undefined);
    setBusy(false);
    setConfirm(false);
    if (!res.success) {
      setError(getErrorMessage(res.error, 'Chưa lưu được. Vui lòng thử lại.'));
      return;
    }
    onSaved(res.data);
  };

  return (
    <FormModal title="Sửa tham số hệ thống" subtitle={<code>{config.key}</code>} onClose={onClose} busy={busy}>
      {config.description && <p className="cfg-desc">{config.description}</p>}

      <div className="field">
        <label htmlFor="cfg-val">Giá trị mới <span className="muted">({config.dataType === 'NUMBER' ? 'số' : config.dataType === 'BOOLEAN' ? 'bật/tắt' : config.dataType === 'JSON' ? 'JSON' : 'chuỗi'})</span></label>
        {config.dataType === 'BOOLEAN' ? (
          <select id="cfg-val" className="input" value={value} onChange={(e) => setValue(e.target.value)} disabled={busy}>
            <option value="true">Bật</option>
            <option value="false">Tắt</option>
          </select>
        ) : config.dataType === 'JSON' ? (
          <textarea id="cfg-val" className="input textarea" rows={5} value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} />
        ) : (
          <input id="cfg-val" className={`input${value && problem ? ' is-invalid' : ''}`} inputMode={config.dataType === 'NUMBER' ? 'decimal' : undefined} value={value} onChange={(e) => setValue(e.target.value)} disabled={busy} autoFocus />
        )}
        {value && problem && <div className="field-error" role="alert">{problem}</div>}
        {rule.kind === 'percent' && <div className="field-hint">Nhập dạng thập phân: 0,15 = 15%; 3 = 300%.</div>}
      </div>

      <table className="kv-table cfg-diff">
        <tbody>
          <tr><th>Hiện tại</th><td><b>{displayValue(config)}</b> <span className="muted">({config.value})</span></td></tr>
          <tr><th>Sau khi lưu</th><td>{preview ? <b>{preview}</b> : <span className="muted">{changed ? '—' : 'Chưa thay đổi'}</span>}</td></tr>
        </tbody>
      </table>

      <div className="field">
        <label htmlFor="cfg-note">Ghi chú thay đổi <span className="muted">(tuỳ chọn — lưu trong nhật ký kiểm toán)</span></label>
        <input id="cfg-note" className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="Vd: Theo quyết định của PO ngày 26/11" />
      </div>

      {critical && <Alert tone="info" title="Tham số quan trọng">Ảnh hưởng tiền hoặc an toàn của mọi ca mới. Hãy chắc chắn có quyết định của PO/kế toán.</Alert>}
      {error && <Alert title={error} />}
      <p className="muted us-audit">Có hiệu lực ngay, không cần triển khai lại. Ghi <code>audit_logs</code> với người cập nhật (<code>updated_by</code>).</p>

      <div className="modal-actions">
        <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Huỷ</Button>
        <Button type="button" onClick={() => (critical ? setConfirm(true) : save())} loading={busy} disabled={!changed || !!problem}>Lưu</Button>
      </div>

      {confirm && (
        <ConfirmDialog title="Xác nhận đổi tham số quan trọng?" confirmLabel="Lưu thay đổi" tone="danger" busy={busy} onConfirm={save} onCancel={() => setConfirm(false)}>
          <code>{config.key}</code>: <b>{displayValue(config)}</b> → <b>{preview}</b>. Áp dụng ngay cho các tính toán mới.
        </ConfirmDialog>
      )}
    </FormModal>
  );
}
