/**
 * Mock eKYC khách hàng.
 *   GET  /customers/me/ekyc  → UNVERIFIED (user mới) · VERIFIED (u-patient-verified)
 *   POST /customers/me/ekyc  → cần đủ cccd_front, cccd_back, selfie → PENDING
 */

import type { CustomerKyc, KycDocType } from '../features/ekyc/ekyc.types';
import { KYC_FORM_FIELD } from '../features/ekyc/ekyc.types';
import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

const VERIFIED_SAMPLE: CustomerKyc = {
  kyc_status: 'VERIFIED',
  full_name: 'Nguyễn Văn An',
  cccd_number_masked: '001092 ••• •88',
  documents: [
    { doc_type: 'CCCD_FRONT', file_name: 'can_cuoc_truoc.jpg', uploaded_at: '2026-10-12T02:41:00Z' },
    { doc_type: 'CCCD_BACK', file_name: 'can_cuoc_sau.jpg', uploaded_at: '2026-10-12T02:41:00Z' },
    { doc_type: 'SELFIE', file_name: 'selfie.jpg', uploaded_at: '2026-10-12T02:41:00Z' },
  ],
};

const EMPTY: CustomerKyc = { kyc_status: 'UNVERIFIED', documents: [] };

function initial(userId: string): CustomerKyc {
  return userId === 'u-patient-verified' ? VERIFIED_SAMPLE : EMPTY;
}

export const ekycHandlers: Record<string, MockHandler> = {
  'GET /api/v1/customers/me/ekyc': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    return ok(getUserData(userId, 'ekyc', initial(userId)));
  },

  'POST /api/v1/customers/me/ekyc': (body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    if (!(body instanceof FormData)) return fail(400, 'INVALID_BODY', 'Cần gửi multipart/form-data');

    const now = new Date().toISOString();
    const documents = (Object.keys(KYC_FORM_FIELD) as KycDocType[]).map((type) => {
      const file = body.get(KYC_FORM_FIELD[type]);
      return file instanceof File ? { doc_type: type, file_name: file.name, uploaded_at: now } : null;
    });
    if (documents.some((d) => d === null)) {
      return fail(400, 'KYC_MISSING_DOCUMENT', 'Vui lòng tải đủ CCCD 2 mặt và ảnh chân dung.');
    }

    const kyc: CustomerKyc = {
      kyc_status: 'PENDING',
      full_name: null,
      cccd_number_masked: null,
      documents: documents as CustomerKyc['documents'],
    };
    setUserData(userId, 'ekyc', kyc);
    return ok(kyc);
  },
};
