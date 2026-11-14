import { FileText } from 'lucide-react';
import { DocumentUploadTile } from '../../ekyc/components/DocumentUploadTile';
import { PRESCRIPTION_MAX_AGE_DAYS } from '../booking.types';

const toYmd = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Lỗi ngày kê y lệnh (phải trong 7 ngày gần nhất, không ở tương lai); null nếu hợp lệ hoặc chưa nhập. */
export function prescriptionDateError(issuedDate: string): string | null {
  if (!issuedDate) return null;
  const issued = new Date(`${issuedDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ageDays = Math.round((today.getTime() - issued.getTime()) / 86_400_000);
  if (Number.isNaN(ageDays) || ageDays < 0) return 'Ngày kê y lệnh không thể ở tương lai.';
  if (ageDays > PRESCRIPTION_MAX_AGE_DAYS) return `Y lệnh đã quá ${PRESCRIPTION_MAX_AGE_DAYS} ngày — cần y lệnh mới.`;
  return null;
}

interface PrescriptionUploadProps {
  file: File | null;
  issuedDate: string;
  onFileChange: (f: File | null) => void;
  onDateChange: (d: string) => void;
  disabled?: boolean;
}

/** Bắt buộc với dịch vụ xâm lấn (`is_invasive = true`, FR-BOOK-02): ảnh y lệnh + ngày kê. */
export function PrescriptionUpload({ file, issuedDate, onFileChange, onDateChange, disabled }: PrescriptionUploadProps) {
  const dateError = prescriptionDateError(issuedDate);
  const today = new Date();
  const oldest = new Date();
  oldest.setDate(today.getDate() - PRESCRIPTION_MAX_AGE_DAYS);

  return (
    <section className="card step-card bk-rx" aria-labelledby="rx-title">
      <h3 id="rx-title" className="step-card__title">Y lệnh của bác sĩ <span className="req">*</span></h3>
      <p className="step-card__sub">
        Thủ thuật y tế bắt buộc có y lệnh. Ảnh cần rõ tên người bệnh, tên thuốc và liều, chữ ký/dấu của bác sĩ, ngày kê không quá {PRESCRIPTION_MAX_AGE_DAYS} ngày.
        Y lệnh sẽ được Admin duyệt trước khi ghép điều dưỡng.
      </p>

      <div className="bk-rx__grid">
        <DocumentUploadTile
          icon={<FileText size={32} />}
          title="Ảnh y lệnh"
          emptyHint="Ảnh rõ nét, đủ nội dung"
          source="file"
          file={file}
          onChange={onFileChange}
          disabled={disabled}
        />
        <div className="field" id="rx-date">
          <label htmlFor="rx-issued">Ngày bác sĩ kê y lệnh <span className="req">*</span></label>
          <input
            id="rx-issued"
            type="date"
            className={`input${dateError ? ' is-invalid' : ''}`}
            min={toYmd(oldest)}
            max={toYmd(today)}
            value={issuedDate}
            onChange={(e) => onDateChange(e.target.value)}
            disabled={disabled}
          />
          {dateError && <div className="field-error" role="alert">{dateError}</div>}
        </div>
      </div>
    </section>
  );
}
