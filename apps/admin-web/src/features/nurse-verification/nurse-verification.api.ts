import { apiClient } from '../../lib/api-client';
import type {
  CredentialUrl,
  NurseReviewDetail,
  QueueItem,
  QueueQuery,
  QueueSummary,
  VerifyNurseRequest,
} from './nurse-verification.types';

/** A2 — danh sách hồ sơ theo tab + bộ lọc (lọc phía server). */
export async function getVerificationQueue(query: QueueQuery) {
  const params = new URLSearchParams({ tab: query.tab });
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.submitted && query.submitted !== 'ALL') params.set('submitted', query.submitted);
  if (query.docs && query.docs !== 'ALL') params.set('docs', query.docs);
  return apiClient<QueueItem[]>(`/admin/nurses/verification-queue?${params.toString()}`);
}

/** Số hồ sơ chờ duyệt cho badge sidebar + tab. */
export async function getQueueSummary() {
  return apiClient<QueueSummary>('/admin/nurses/verification-queue/summary');
}

/** A3 — chi tiết hồ sơ để thẩm định (không kèm URL ảnh). */
export async function getNurseReview(nurseId: string) {
  return apiClient<NurseReviewDetail>(`/admin/nurses/${nurseId}/verification`);
}

/** Presigned URL 10 phút cho 1 giấy tờ — gọi lại khi hết hạn. Backend ghi audit lượt xem. */
export async function getCredentialUrl(nurseId: string, credentialId: string) {
  return apiClient<CredentialUrl>(`/admin/nurses/${nurseId}/credentials/${credentialId}/url`);
}

/** PATCH /api/v1/admin/nurses/:id/verify (SRS §8, FR-AUTH-02). */
export async function verifyNurse(nurseId: string, payload: VerifyNurseRequest) {
  return apiClient<NurseReviewDetail>(`/admin/nurses/${nurseId}/verify`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
