import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import type { NurseSearchFilters, NurseSearchResult } from './nurse-search.types';

export const SEARCH_PAGE_SIZE = 12;

/** Ghép ngày + giờ + số giờ ca thành khoảng thời gian ISO; thiếu thông tin thì bỏ qua bộ lọc giờ. */
export function toTimeWindow(f: NurseSearchFilters): { startAt: string; endAt: string } | null {
  if (!f.date || !f.startTime || !f.durationHours) return null;
  const start = new Date(`${f.date}T${f.startTime}:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + f.durationHours * 3_600_000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

/**
 * GET /nurses/search — chỉ trả điều dưỡng ACTIVE, đủ ký quỹ, đúng Tier cho dịch vụ và còn lịch trống
 * trong khung giờ yêu cầu (FR-SEARCH-01). Contract đề xuất, xem nurse-search.types.ts.
 */
export async function searchNurses(
  filters: NurseSearchFilters,
  offset = 0,
): Promise<ApiResponse<NurseSearchResult>> {
  const q = new URLSearchParams();
  if (filters.service) q.set('serviceCode', filters.service);
  if (filters.district) q.set('district', filters.district);
  if (filters.tier) q.set('tier', filters.tier);
  if (filters.gender) q.set('gender', filters.gender);
  const window = toTimeWindow(filters);
  if (window) {
    q.set('startAt', window.startAt);
    q.set('endAt', window.endAt);
  }
  q.set('limit', String(SEARCH_PAGE_SIZE));
  q.set('offset', String(offset));
  return apiClient<NurseSearchResult>(`/nurses/search?${q.toString()}`);
}
