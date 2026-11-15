/**
 * eKYC khách hàng (FR-AUTH-03, CT-14): CCCD 2 mặt + ảnh chân dung chụp trực tiếp.
 * Hồ sơ được đội ngũ vận hành duyệt thủ công → users.kyc_status: UNVERIFIED → PENDING → VERIFIED.
 *
 * ⚠️ SRS §8 chưa có endpoint cho phần này — contract dưới đây là đề xuất, cần BE-2 xác nhận.
 */

import type { KycStatus } from '../auth';

export type KycDocType = 'CCCD_FRONT' | 'CCCD_BACK' | 'SELFIE';

export interface KycDocument {
  doc_type: KycDocType;
  file_name: string;
  uploaded_at: string; // ISO
}

/** GET /customers/me/ekyc · POST /customers/me/ekyc (response) */
export interface CustomerKyc {
  kyc_status: KycStatus;
  full_name?: string | null; // họ tên trên CCCD (nếu đội vận hành đã nhập)
  cccd_number_masked?: string | null; // vd. "001092 ••• •88" — backend che sẵn, FE không tự che
  documents: KycDocument[];
  rejection_reason?: string | null; // có khi Admin từ chối, kyc_status quay về UNVERIFIED
}

/** Tên field multipart khi nộp — khớp với KycDocType */
export const KYC_FORM_FIELD: Record<KycDocType, string> = {
  CCCD_FRONT: 'cccd_front',
  CCCD_BACK: 'cccd_back',
  SELFIE: 'selfie',
};
