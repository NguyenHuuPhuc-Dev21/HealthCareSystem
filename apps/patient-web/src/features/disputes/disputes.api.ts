import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { Dispute, DisputeCategory, PresignedUploadUrl } from './disputes.types';

/** GET /patient/disputes — khiếu nại của các ca do khách đặt. */
export function getMyDisputes() {
  return apiClient<Dispute[]>('/patient/disputes');
}

/** GET /disputes/:id — chi tiết, bằng chứng kèm link tải tạm thời. */
export function getDispute(id: string) {
  return apiClient<Dispute>(`/disputes/${id}`);
}

const fail = <T>(code: string, message: string): ApiResponse<T> => ({ success: false, data: null as unknown as T, error: { code, message } });

/**
 * ⚠️ KHOẢNG TRỐNG CONTRACT (cần BE-3 xử lý): `POST /disputes/:id/evidence-upload-urls` chỉ cấp link cho khiếu nại ĐÃ tồn tại,
 * trong khi `POST /bookings/:id/disputes` chỉ nhận khoá bằng chứng đã tải lên từ trước → khách không có cách đính kèm
 * bằng chứng lúc mở khiếu nại. Đề xuất: thêm `POST /bookings/:id/disputes/evidence-upload-urls` (cùng body/response,
 * cấp khoá `dispute-evidence/<userId>/…` cho người tham gia ca). Hàm dưới đây gọi endpoint đề xuất đó;
 * nếu backend chưa có (404) thì `openDispute` vẫn mở khiếu nại nhưng báo rõ là chưa đính kèm được bằng chứng.
 */
export function requestPreOpenEvidenceUrls(bookingId: string, fileNames: string[]) {
  return apiClient<PresignedUploadUrl[]>(`/bookings/${bookingId}/disputes/evidence-upload-urls`, {
    method: 'POST',
    body: JSON.stringify({ file_names: fileNames }),
  });
}

/** Link tải bằng chứng cho khiếu nại đã mở (dùng khi bổ sung). */
export function requestEvidenceUrls(disputeId: string, fileNames: string[]) {
  return apiClient<PresignedUploadUrl[]>(`/disputes/${disputeId}/evidence-upload-urls`, {
    method: 'POST',
    body: JSON.stringify({ file_names: fileNames }),
  });
}

async function putFile(target: PresignedUploadUrl, file: File): Promise<boolean> {
  try {
    const res = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    return res.ok;
  } catch {
    return false;
  }
}

export interface OpenDisputeInput {
  bookingId: string;
  category: DisputeCategory;
  description: string;
  files: File[];
}

export interface OpenDisputeOutcome {
  disputeId: string;
  /** Số bằng chứng thực sự được đính kèm */
  attached: number;
  /** Có chọn file nhưng không đính kèm được (vd. backend chưa hỗ trợ tải trước) */
  evidenceSkipped: boolean;
}

/**
 * Mở khiếu nại: (1) xin link tải bằng chứng → (2) PUT từng file → (3) POST /bookings/:id/disputes kèm khoá.
 * Nếu bước (1)/(2) hỏng, KHÔNG chặn khách khiếu nại: mở khiếu nại không kèm bằng chứng và báo lại.
 * Escrow bị đóng băng ngay khi khiếu nại được mở (FR-DISP-01) nên không nên bắt khách thử lại nhiều lần.
 */
export async function openDispute(input: OpenDisputeInput): Promise<ApiResponse<OpenDisputeOutcome>> {
  let keys: string[] = [];
  let skipped = false;

  if (input.files.length > 0) {
    const urls = await requestPreOpenEvidenceUrls(input.bookingId, input.files.map((f) => f.name));
    if (urls.success && urls.data.length === input.files.length) {
      const results = await Promise.all(urls.data.map((u, i) => putFile(u, input.files[i])));
      if (results.every(Boolean)) keys = urls.data.map((u) => u.publicUrl);
      else skipped = true;
    } else {
      skipped = true;
    }
  }

  const res = await apiClient<{ dispute_id: string }>(`/bookings/${input.bookingId}/disputes`, {
    method: 'POST',
    body: JSON.stringify({ category: input.category, description: input.description, ...(keys.length ? { evidenceUrls: keys } : {}) }),
  });
  if (!res.success) return fail<OpenDisputeOutcome>(res.error?.code ?? 'UNKNOWN', res.error?.message ?? 'Chưa gửi được khiếu nại.');
  return { success: true, data: { disputeId: res.data.dispute_id, attached: keys.length, evidenceSkipped: skipped } };
}
