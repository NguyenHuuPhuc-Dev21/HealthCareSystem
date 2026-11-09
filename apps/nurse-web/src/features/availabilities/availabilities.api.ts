import { apiClient } from '../../lib/api-client';
import type { ApiResponse } from '../../lib/api-client';
import { USE_MOCK_AVAILABILITY } from '../../lib/mock-flags';
import type {
  AvailabilityData,
  ConfirmedBooking,
  DateAvailability,
  RecurringWindow,
  TimeOffException,
  UpdateAvailabilityInput,
} from './availability.types';
import { mockGetAvailabilities, mockUpdateAvailabilities } from './availabilities.mock';

/**
 * Lịch rảnh & Ngày nghỉ (FR-SCHED-01, màn N13).
 *
 * TRẠNG THÁI: BE-2 CHƯA có endpoint — mặc định chạy MOCK
 * (VITE_USE_MOCK_AVAILABILITY). Khi BE-2 xong, đặt cờ = false; nhánh thật dưới
 * đây đã viết sẵn theo contract ĐỀ XUẤT sau, chờ BE-2 (Oanh) chốt:
 *
 * - GET /api/v1/nurse/availabilities -> { recurringWindows, timeOffExceptions,
 *   dateAvailabilities, bookings } (camelCase, đúng quy ước BE-1 đã dùng).
 *   LƯU Ý: SRS §8 hiện chỉ liệt kê PUT — GET là đề xuất bổ sung.
 * - PUT /api/v1/nurse/availabilities — ghi đè toàn bộ lịch (đúng SRS §8);
 *   server phải từ chối (409 AVAILABILITY_LOCKED) nếu bản ghi mới xóa/sửa một
 *   khung đang bao trọn ca CONFIRMED/IN_PROGRESS.
 * - 2 điểm mở cần BE-2 quyết cùng DB:
 *   (1) Khung QUA ĐÊM (endTime <= startTime, vd 19:00–06:00 — có trên board N13
 *       và trong ví dụ của chính FR-SCHED-01) đang vướng CHECK (end_time >
 *       start_time) của bảng nurse_availabilities.
 *   (2) "Mở rảnh riêng một ngày" (dateAvailabilities) chưa có giá trị enum nào
 *       trong schema (chỉ có RECURRING_AVAILABLE | TIME_OFF_EXCEPTION).
 */

function currentSession(): { phone: string } {
  try {
    const raw = localStorage.getItem('carenest_nurse_session');
    const s = raw ? JSON.parse(raw) : null;
    return { phone: s?.user?.phone ?? '' };
  } catch {
    return { phone: '' };
  }
}

function fail<T>(code: string, message: string): ApiResponse<T> {
  return { success: false, data: null as unknown as T, error: { code, message } };
}

interface AvailabilityDto {
  recurringWindows: RecurringWindow[];
  timeOffExceptions: TimeOffException[];
  dateAvailabilities: DateAvailability[];
  bookings: ConfirmedBooking[];
}

function fromDto(dto: AvailabilityDto): AvailabilityData {
  return {
    recurring: dto.recurringWindows ?? [],
    timeOff: dto.timeOffExceptions ?? [],
    dateAvailability: dto.dateAvailabilities ?? [],
    bookings: dto.bookings ?? [],
  };
}

export async function getAvailabilities(): Promise<ApiResponse<AvailabilityData>> {
  if (USE_MOCK_AVAILABILITY) {
    const data = await mockGetAvailabilities(currentSession().phone);
    return { success: true, data };
  }
  const res = await apiClient<AvailabilityDto>('/nurse/availabilities', { method: 'GET' });
  if (!res.success) return res as unknown as ApiResponse<AvailabilityData>;
  return { success: true, data: fromDto(res.data) };
}

export async function updateAvailabilities(
  input: UpdateAvailabilityInput,
): Promise<ApiResponse<AvailabilityData>> {
  if (USE_MOCK_AVAILABILITY) {
    const r = await mockUpdateAvailabilities(currentSession().phone, input);
    if (!r.ok) return fail(r.code, r.message);
    return { success: true, data: r.data };
  }
  const res = await apiClient<AvailabilityDto>('/nurse/availabilities', {
    method: 'PUT',
    body: JSON.stringify({
      recurringWindows: input.recurring,
      timeOffExceptions: input.timeOff,
      dateAvailabilities: input.dateAvailability,
    }),
  });
  if (!res.success) return res as unknown as ApiResponse<AvailabilityData>;
  return { success: true, data: fromDto(res.data) };
}