import { useState } from 'react';
import { Alert, Button, ConfirmDialog } from '../../../components';
import { formatDateTime } from '../../../lib/formatters';
import type { PatientProfileDto } from '../patient-profiles.types';

type PendingAction = 'withdraw' | 'delete' | null;

interface ConsentRecordProps {
  profile: PatientProfileDto;
}

/** Khối hiển thị đồng ý đã ghi nhận (P13) — chỉ đọc; thay đổi qua "Vùng nguy hiểm". */
export function ConsentRecord({ profile }: ConsentRecordProps) {
  return (
    <div className="consent-check consent-check--readonly">
      <input type="checkbox" checked readOnly disabled aria-label="Đã đồng ý xử lý dữ liệu" />
      <span>
        Tôi xác nhận và đồng ý cho nền tảng xử lý dữ liệu sức khỏe của người được chăm sóc theo{' '}
        <b>Nghị định 13/2023/NĐ-CP</b>.
        {profile.consent_timestamp && <> Đã ghi nhận đồng ý lúc {formatDateTime(profile.consent_timestamp)}.</>}
      </span>
    </div>
  );
}

interface DangerZoneProps {
  canWithdraw: boolean;
  onWithdraw: () => Promise<string | null>; // trả về câu lỗi hoặc null nếu thành công
  onRequestDelete: () => Promise<string | null>;
}

/** "Vùng nguy hiểm — Quyền dữ liệu" (P13): rút đồng ý, yêu cầu xoá/ẩn danh hoá. */
export function DangerZone({ canWithdraw, onWithdraw, onRequestDelete }: DangerZoneProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const err = pending === 'withdraw' ? await onWithdraw() : await onRequestDelete();
    setBusy(false);
    if (err) setError(err);
    setPending(null);
  };

  return (
    <div className="danger-zone">
      <b className="danger-zone__title">Vùng nguy hiểm — Quyền dữ liệu</b>
      <p>
        Rút lại đồng ý sẽ dừng mọi ca chưa diễn ra của hồ sơ này. Yêu cầu xóa/ẩn danh hóa dữ liệu được xử lý theo
        Nghị định 13/2023; dữ liệu liên quan giao dịch tài chính được giữ theo thời hạn pháp luật yêu cầu.
      </p>
      {error && <Alert title={error} />}
      <div className="danger-zone__actions">
        {canWithdraw && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setPending('withdraw')}>
            Rút lại đồng ý
          </Button>
        )}
        <Button type="button" variant="danger" size="sm" onClick={() => setPending('delete')}>
          Yêu cầu xóa dữ liệu
        </Button>
      </div>

      {pending === 'withdraw' && (
        <ConfirmDialog
          title="Rút lại đồng ý xử lý dữ liệu?"
          confirmLabel="Rút lại đồng ý"
          tone="danger"
          busy={busy}
          onConfirm={run}
          onCancel={() => setPending(null)}
        >
          Mọi ca chưa diễn ra của hồ sơ này sẽ bị dừng và bạn không thể đặt ca mới cho hồ sơ này cho tới khi đồng ý lại.
        </ConfirmDialog>
      )}
      {pending === 'delete' && (
        <ConfirmDialog
          title="Gửi yêu cầu xóa dữ liệu?"
          confirmLabel="Gửi yêu cầu xóa"
          tone="danger"
          busy={busy}
          onConfirm={run}
          onCancel={() => setPending(null)}
        >
          Dữ liệu sức khỏe của hồ sơ này sẽ được xóa hoặc ẩn danh hóa theo Nghị định 13/2023. Hồ sơ chuyển sang chỉ đọc
          trong lúc xử lý. Thao tác này không hoàn tác được.
        </ConfirmDialog>
      )}
    </div>
  );
}
