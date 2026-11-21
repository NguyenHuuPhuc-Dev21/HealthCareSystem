import { apiClient, ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';

export interface CheckInResponseData {
  execution_status: string;
  checked_in_at: string;
}

export async function submitCheckIn(
  bookingId: string,
  formData: FormData
): Promise<ApiResponse<CheckInResponseData>> {
  if (env.useMockShifts) {
    const entries = (formData as any)?._parts;
    let isMock = false;
    if (Array.isArray(entries)) {
      const mockEntry = entries.find((e: any[]) => e[0] === 'isMockLocation');
      if (mockEntry && mockEntry[1] === 'true') {
        isMock = true;
      }
    }
    if (isMock) {
      return {
        success: false,
        data: null as unknown as CheckInResponseData,
        error: {
          code: 'MOCK_LOCATION_DETECTED',
          message: 'Hệ thống phát hiện định vị giả lập. Không thể điểm danh vào ca.',
        },
      };
    }

    return {
      success: true,
      data: {
        execution_status: 'IN_PROGRESS',
        checked_in_at: new Date().toISOString(),
      },
    };
  }

  const res = await apiClient<CheckInResponseData>(`/bookings/${bookingId}/check-in`, {
    method: 'POST',
    body: formData,
  });

  if (!res.success) {
    if (res.error?.code === 'OUT_OF_RADIUS') {
      return {
        success: false,
        data: null as unknown as CheckInResponseData,
        error: {
          code: 'OUT_OF_RADIUS',
          message: 'Vị trí hiện tại của bạn cách điểm hẹn vượt quá bán kính cho phép (200m).',
        },
      };
    }
    if (res.error?.code === 'MOCK_LOCATION_DETECTED') {
      return {
        success: false,
        data: null as unknown as CheckInResponseData,
        error: {
          code: 'MOCK_LOCATION_DETECTED',
          message: 'Hệ thống phát hiện vị trí giả lập (Fake GPS). Vui lòng tắt ứng dụng giả lập định vị.',
        },
      };
    }
  }

  return res;
}
