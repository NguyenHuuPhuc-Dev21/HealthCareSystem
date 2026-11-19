import type {
  AvailabilityData,
  UpdateAvailabilityInput,
} from '@healthcare-system/shared';
import { apiClient, type ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import {
  mockGetAvailabilities,
  mockUpdateAvailabilities,
} from './availability.mock';

export async function getAvailabilities(): Promise<ApiResponse<AvailabilityData>> {
  if (env.useMockAvailability) {
    const data = await mockGetAvailabilities();
    return {
      success: true,
      data,
    };
  }

  return apiClient<AvailabilityData>('/nurse/availabilities');
}

export async function updateAvailabilities(
  input: UpdateAvailabilityInput
): Promise<ApiResponse<AvailabilityData>> {
  if (env.useMockAvailability) {
    const res = await mockUpdateAvailabilities(input);
    if (!res.success) {
      return {
        success: false,
        data: null as unknown as AvailabilityData,
        error: {
          code: res.code,
          message: res.message,
        },
      };
    }
    return {
      success: true,
      data: res.data,
    };
  }

  const res = await apiClient<AvailabilityData>('/nurse/availabilities', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.success && res.error?.code === 'AVAILABILITY_LOCKED') {
    return {
      success: false,
      data: null as unknown as AvailabilityData,
      error: {
        code: 'AVAILABILITY_LOCKED',
        message: res.error.message || 'Khung giờ đang có ca trực đã nhận, không thể xóa hoặc sửa.',
      },
    };
  }

  return res;
}
