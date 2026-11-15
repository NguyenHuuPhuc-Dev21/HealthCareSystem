import { apiClient } from '../../lib/api-client';
import { KYC_FORM_FIELD } from './ekyc.types';
import type { CustomerKyc, KycDocType } from './ekyc.types';

/** Trạng thái eKYC hiện tại của khách đang đăng nhập. */
export async function getMyKyc() {
  return apiClient<CustomerKyc>('/customers/me/ekyc');
}

/**
 * Nộp CCCD 2 mặt + selfie (multipart/form-data).
 * Ảnh lưu private trên S3/MinIO phía backend; FE chỉ xem lại qua presigned URL nếu cần.
 */
export async function submitMyKyc(files: Record<KycDocType, File>) {
  const form = new FormData();
  (Object.keys(files) as KycDocType[]).forEach((type) => {
    form.append(KYC_FORM_FIELD[type], files[type]);
  });
  return apiClient<CustomerKyc>('/customers/me/ekyc', { method: 'POST', body: form });
}
