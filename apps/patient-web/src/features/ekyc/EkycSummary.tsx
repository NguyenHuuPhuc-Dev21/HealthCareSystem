import type { CustomerKyc, KycDocType } from './ekyc.types';

const DOCS: Array<{ type: KycDocType; icon: string; title: string }> = [
  { type: 'CCCD_FRONT', icon: '🪪', title: 'CCCD mặt trước' },
  { type: 'CCCD_BACK', icon: '🪪', title: 'CCCD mặt sau' },
  { type: 'SELFIE', icon: '🤳', title: 'Ảnh chân dung trực tiếp' },
];

interface EkycSummaryProps {
  kyc: CustomerKyc;
  onEdit?: () => void;
}

/** SH3 · Bước 1 đã nộp — thẻ tóm tắt + 3 ô giấy tờ trạng thái "Chờ Admin duyệt" / "Đã xác thực". */
export function EkycSummary({ kyc, onEdit }: EkycSummaryProps) {
  const verified = kyc.kyc_status === 'VERIFIED';
  const docChip = verified ? 'Đã xác thực' : 'Đã tải lên · Chờ Admin duyệt';
  const identity = [kyc.full_name, kyc.cccd_number_masked && `CCCD ${kyc.cccd_number_masked}`].filter(Boolean).join(' · ');

  return (
    <>
      <div className="card step-summary">
        <span className="step-summary__n" aria-hidden="true">✓</span>
        <div>
          <h3>
            Bước 1 · Xác thực CCCD{' '}
            <span className={`chip ${verified ? 'teal' : 'amber'}`}>{verified ? 'Đã xác thực' : 'Đang chờ duyệt'}</span>
          </h3>
          <p>
            {identity
              ? `${identity} — ${verified ? 'đã được đội ngũ vận hành xác thực.' : 'hồ sơ do đội ngũ vận hành thẩm định thủ công.'}`
              : verified
                ? 'Đã được đội ngũ vận hành xác thực.'
                : 'Hồ sơ do đội ngũ vận hành thẩm định thủ công.'}
          </p>
        </div>
        {!verified && onEdit && (
          <button type="button" className="link-button step-summary__edit" onClick={onEdit}>Chỉnh sửa</button>
        )}
      </div>

      <div className="upload-grid upload-grid--summary">
        {DOCS.map(({ type, icon, title }) => {
          const doc = kyc.documents.find((d) => d.doc_type === type);
          return (
            <div key={type} className="upload filled">
              <div className="upload__icon" aria-hidden="true">{icon}</div>
              <h4>{title}</h4>
              <p>{doc?.file_name ?? '—'}</p>
              <span className={`chip ${verified ? 'teal' : 'amber'}`}>{docChip}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
