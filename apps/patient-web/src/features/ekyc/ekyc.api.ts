import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { CustomerKyc, KycDocType } from './ekyc.types';
import { KYC_PURPOSE } from './ekyc.types';
import type { KycStatus } from '../auth';

/*
 * Khớp contract backend (docs/api/patient-profiles.api.md §2):
 *   POST /patient/ekyc/upload-urls → PUT từng ảnh lên link riêng tư → POST /patient/ekyc.
 * Ảnh không đi qua API; backend chỉ nhận object key + số CCCD 12 số.
 */

interface BackendEkycStatus {
  kycStatus: KycStatus;
  cccdNumberMasked: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

interface UploadUrl {
  purpose: string;
  objectKey: string;
  uploadUrl: string;
  contentType: string;
}

const DOC_TYPES: KycDocType[] = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];

function toKyc(s: BackendEkycStatus): CustomerKyc {
  const uploaded = s.kycStatus !== 'UNVERIFIED' && s.submittedAt;
  return {
    kyc_status: s.kycStatus,
    cccd_number_masked: s.cccdNumberMasked,
    rejection_reason: s.rejectionReason,
    // Backend không trả tên file (chỉ lưu object key) → hiển thị nhãn chung.
    documents: uploaded
      ? DOC_TYPES.map((doc_type) => ({ doc_type, file_name: 'Đã tải lên', uploaded_at: s.submittedAt as string }))
      : [],
  };
}

const failure = <T>(code: string, message: string): ApiResponse<T> => ({
  success: false,
  data: null as unknown as T,
  error: { code, message },
});

/** Trạng thái eKYC hiện tại của khách đang đăng nhập (GET /patient/ekyc). */
export async function getMyKyc(): Promise<ApiResponse<CustomerKyc>> {
  const res = await apiClient<BackendEkycStatus>('/patient/ekyc');
  return res.success ? { success: true, data: toKyc(res.data) } : { success: false, data: null as unknown as CustomerKyc, error: res.error };
}

/** Nộp CCCD 2 mặt + ảnh chân dung + số CCCD → trạng thái PENDING, chờ Admin duyệt. */
export async function submitMyKyc(files: Record<KycDocType, File>, cccdNumber: string): Promise<ApiResponse<CustomerKyc>> {
  // 1. Xin link tải lên (hiệu lực 10 phút)
  const urls = await apiClient<{ files: UploadUrl[] }>('/patient/ekyc/upload-urls', {
    method: 'POST',
    body: JSON.stringify({
      files: DOC_TYPES.map((type) => ({ purpose: KYC_PURPOSE[type], contentType: files[type].type })),
    }),
  });
  if (!urls.success) return { success: false, data: null as unknown as CustomerKyc, error: urls.error };

  const byPurpose = new Map(urls.data.files.map((f) => [f.purpose, f]));

  // 2. PUT từng ảnh thẳng lên kho lưu trữ riêng tư (không kèm Authorization)
  for (const type of DOC_TYPES) {
    const target = byPurpose.get(KYC_PURPOSE[type]);
    if (!target) return failure('KYC_UPLOAD_URL_MISSING', 'Không lấy được liên kết tải ảnh. Vui lòng thử lại.');
    try {
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': target.contentType },
        body: files[type],
      });
      if (!put.ok) return failure('KYC_UPLOAD_FAILED', 'Tải ảnh lên chưa thành công. Vui lòng thử lại.');
    } catch {
      return failure('NETWORK_ERROR', 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.');
    }
  }

  // 3. Gửi hồ sơ
  const res = await apiClient<BackendEkycStatus>('/patient/ekyc', {
    method: 'POST',
    body: JSON.stringify({
      cccdNumber,
      identity: {
        cccdFrontKey: byPurpose.get('CCCD_FRONT')!.objectKey,
        cccdBackKey: byPurpose.get('CCCD_BACK')!.objectKey,
        portraitKey: byPurpose.get('PORTRAIT')!.objectKey,
      },
    }),
  });
  return res.success ? { success: true, data: toKyc(res.data) } : { success: false, data: null as unknown as CustomerKyc, error: res.error };
}
