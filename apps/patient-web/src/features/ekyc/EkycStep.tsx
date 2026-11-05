import { useState } from 'react';
import { Alert, Button } from '../../components';
import { Camera, CreditCard } from 'lucide-react';
import { getErrorMessage } from '../../lib/errors';
import { submitMyKyc } from './ekyc.api';
import type { CustomerKyc, KycDocType } from './ekyc.types';
import { DocumentUploadTile } from './components/DocumentUploadTile';

interface EkycStepProps {
  /** Lý do Admin từ chối lần trước (nếu có) */
  rejectionReason?: string | null;
  onSubmitted: (kyc: CustomerKyc) => void;
  onCancelEdit?: () => void;
}

type Files = Record<KycDocType, File | null>;

/** SH3 · Bước 1 (đang thực hiện) — tải CCCD 2 mặt + chụp chân dung, gửi Admin duyệt. */
export function EkycStep({ rejectionReason, onSubmitted, onCancelEdit }: EkycStepProps) {
  const [files, setFiles] = useState<Files>({ CCCD_FRONT: null, CCCD_BACK: null, SELFIE: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setFile = (type: KycDocType) => (file: File | null) => setFiles((prev) => ({ ...prev, [type]: file }));
  const complete = Boolean(files.CCCD_FRONT && files.CCCD_BACK && files.SELFIE);

  const handleSubmit = async () => {
    const { CCCD_FRONT, CCCD_BACK, SELFIE } = files;
    if (!CCCD_FRONT || !CCCD_BACK || !SELFIE || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await submitMyKyc({ CCCD_FRONT, CCCD_BACK, SELFIE });
    setSubmitting(false);
    if (!res.success) {
      setError(getErrorMessage(res.error));
      return;
    }
    onSubmitted(res.data);
  };

  return (
    <section className="card step-card" aria-labelledby="ekyc-title">
      <h3 id="ekyc-title" className="step-card__title">Bước 1 · Xác thực CCCD</h3>
      <p className="step-card__sub">
        Bắt buộc khi đặt chăm sóc tại nhà riêng. Ảnh được lưu riêng tư và chỉ đội ngũ vận hành xem khi thẩm định.
      </p>

      {rejectionReason && <Alert title="Hồ sơ lần trước chưa được duyệt.">Lý do: {rejectionReason}</Alert>}

      <div className="upload-grid">
        <DocumentUploadTile
          icon={<CreditCard size={32} />}
          title="CCCD mặt trước"
          emptyHint="Ảnh rõ nét, đủ 4 góc"
          source="file"
          file={files.CCCD_FRONT}
          onChange={setFile('CCCD_FRONT')}
          disabled={submitting}
        />
        <DocumentUploadTile
          icon={<CreditCard size={32} />}
          title="CCCD mặt sau"
          emptyHint="Ảnh rõ nét, đủ 4 góc"
          source="file"
          file={files.CCCD_BACK}
          onChange={setFile('CCCD_BACK')}
          disabled={submitting}
        />
        <DocumentUploadTile
          icon={<Camera size={32} />}
          title="Ảnh chân dung trực tiếp"
          emptyHint="Chụp bằng camera trong ứng dụng"
          source="camera"
          file={files.SELFIE}
          onChange={setFile('SELFIE')}
          disabled={submitting}
        />
      </div>

      {error && <Alert title={error} />}

      <div className="step-card__actions">
        {onCancelEdit && (
          <Button variant="secondary" type="button" onClick={onCancelEdit} disabled={submitting}>Huỷ chỉnh sửa</Button>
        )}
        <Button type="button" size="lg" onClick={handleSubmit} disabled={!complete} loading={submitting}>
          {submitting ? 'Đang gửi…' : 'Gửi xác thực & tiếp tục →'}
        </Button>
      </div>
    </section>
  );
}
