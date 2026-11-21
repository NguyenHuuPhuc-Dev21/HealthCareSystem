/**
 * Mock eKYC khách hàng — mô phỏng contract backend (docs/api/patient-profiles.api.md §2).
 *   POST /patient/ekyc/upload-urls → trả link tải lên giả
 *   PUT  /mock-upload/:key         → nhận ảnh (không lưu)
 *   POST /patient/ekyc             → cần số CCCD 12 số + 3 object key → PENDING
 *   GET  /patient/ekyc             → UNVERIFIED (user mới) · VERIFIED (u-patient-verified)
 */

import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';
import { getUserData, setUserData, userIdFromHeaders } from './mock-db';

export interface MockEkycStatus {
  kycStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  cccdNumberMasked: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

const VERIFIED_SAMPLE: MockEkycStatus = {
  kycStatus: 'VERIFIED',
  cccdNumberMasked: '********1288',
  submittedAt: '2026-10-12T02:41:00Z',
  reviewedAt: '2026-10-12T05:00:00Z',
  rejectionReason: null,
};

const EMPTY: MockEkycStatus = {
  kycStatus: 'UNVERIFIED',
  cccdNumberMasked: null,
  submittedAt: null,
  reviewedAt: null,
  rejectionReason: null,
};

export const initialKyc = (userId: string) => (userId === 'u-patient-verified' ? VERIFIED_SAMPLE : EMPTY);

const PURPOSES = ['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT'];

export const ekycHandlers: Record<string, MockHandler> = {
  'GET /api/v1/patient/ekyc': (_body, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    return ok(getUserData(userId, 'ekyc', initialKyc(userId)));
  },

  'POST /api/v1/patient/ekyc/upload-urls': (body: { files?: Array<{ purpose: string; contentType: string }> }, { headers }) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    const files = body?.files ?? [];
    if (!files.length || files.some((f) => !PURPOSES.includes(f.purpose))) {
      return fail(400, 'VALIDATION_ERROR', 'Yêu cầu không hợp lệ.');
    }
    return ok({
      files: files.map((f) => {
        const objectKey = `kyc-mock/${userId}/${f.purpose}-${Date.now()}`;
        return {
          purpose: f.purpose,
          objectKey,
          uploadUrl: `/api/v1/mock-upload/${encodeURIComponent(objectKey)}`,
          expiresInSeconds: 600,
          contentType: f.contentType,
        };
      }),
    });
  },

  'PUT /api/v1/mock-upload/:key': () => ({ status: 200, body: {} }),

  'POST /api/v1/patient/ekyc': (
    body: { cccdNumber?: string; identity?: { cccdFrontKey?: string; cccdBackKey?: string; portraitKey?: string } },
    { headers },
  ) => {
    const userId = userIdFromHeaders(headers);
    if (!userId) return fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');
    if (!/^\d{12}$/.test(body?.cccdNumber ?? '')) return fail(400, 'VALIDATION_ERROR', 'Số CCCD phải gồm 12 chữ số.');
    const id = body?.identity;
    if (!id?.cccdFrontKey || !id.cccdBackKey || !id.portraitKey) {
      return fail(400, 'FILE_NOT_UPLOADED', 'Vui lòng tải đủ CCCD 2 mặt và ảnh chân dung.');
    }
    const current = getUserData<MockEkycStatus>(userId, 'ekyc', initialKyc(userId));
    if (current.kycStatus === 'VERIFIED') return fail(409, 'EKYC_ALREADY_VERIFIED', 'Tài khoản đã xác thực.');
    if (current.kycStatus === 'PENDING') return fail(409, 'EKYC_ALREADY_SUBMITTED', 'Hồ sơ đang chờ duyệt.');

    const status: MockEkycStatus = {
      kycStatus: 'PENDING',
      cccdNumberMasked: `********${body.cccdNumber!.slice(-4)}`,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      rejectionReason: null,
    };
    setUserData(userId, 'ekyc', status);
    return { status: 201, body: { success: true, data: status } };
  },
};
