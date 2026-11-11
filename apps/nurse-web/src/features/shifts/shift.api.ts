import { apiClient } from '../../lib/api-client';
import { USE_MOCK_SHIFTS } from '../../lib/mock-flags';
import {
  ShiftExecutionState,
  CheckInRequest,
  InitialAssessmentRequest,
  AddVitalSignsRequest,
  ToggleCareActivityRequest,
  RespondExtensionRequest,
  RejectPrescriptionRequest,
  CheckOutRequest,
  SosAlertRequest,
} from './shift.types';
import * as mockShift from './shift.mock';

export async function getShiftExecutionState(bookingId: string): Promise<{ success: boolean; data?: ShiftExecutionState; message?: string }> {
  if (USE_MOCK_SHIFTS) {
    try {
      const data = await mockShift.mockGetShiftExecutionState(bookingId);
      return { success: true, data };
    } catch (e: any) {
      return { success: false, message: e.message || 'Lỗi tải trạng thái ca' };
    }
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${bookingId}/shift-state`);
  return {
    success: res.success,
    data: res.data,
    message: res.error?.message,
  };
}

export async function submitCheckIn(
  payload: CheckInRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockSubmitCheckIn(payload);
  }

  const formData = new FormData();
  formData.append('latitude', payload.latitude.toString());
  formData.append('longitude', payload.longitude.toString());
  formData.append('is_mock_location', payload.isMockLocation ? 'true' : 'false');
  formData.append('timestamp', payload.timestamp);
  if (payload.selfieImageBase64) {
    formData.append('selfie_image', payload.selfieImageBase64);
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${payload.bookingId}/check-in`, {
    method: 'POST',
    body: formData,
  });

  return {
    success: res.success,
    message: res.success ? 'Điểm danh thành công!' : (res.error?.message || 'Điểm danh thất bại'),
    data: res.data,
  };
}

export async function submitInitialAssessment(
  payload: InitialAssessmentRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockSubmitInitialAssessment(payload);
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${payload.bookingId}/assessment`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    success: res.success,
    message: res.success ? 'Đã lưu đánh giá ban đầu' : (res.error?.message || 'Lưu đánh giá thất bại'),
    data: res.data,
  };
}

export async function addVitalSigns(
  payload: AddVitalSignsRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockAddVitalSigns(payload);
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${payload.bookingId}/vitals`, {
    method: 'POST',
    body: JSON.stringify(payload.vitals),
  });

  return {
    success: res.success,
    message: res.success ? 'Đã lưu sinh tồn' : (res.error?.message || 'Lưu sinh tồn thất bại'),
    data: res.data,
  };
}

export async function toggleCareActivity(
  payload: ToggleCareActivityRequest
): Promise<{ success: boolean; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockToggleCareActivity(payload);
  }

  const res = await apiClient<ShiftExecutionState>(
    `/bookings/${payload.bookingId}/activities/${payload.activityId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ completed: payload.completed }),
    }
  );

  return {
    success: res.success,
    data: res.data,
  };
}

export async function respondToExtension(
  payload: RespondExtensionRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockRespondExtension(payload);
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${payload.bookingId}/extend/respond`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    success: res.success,
    message: res.success ? 'Đã gửi phản hồi gia hạn' : (res.error?.message || 'Gửi phản hồi thất bại'),
    data: res.data,
  };
}

export async function rejectInvalidPrescription(
  payload: RejectPrescriptionRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockRejectInvalidPrescription(payload);
  }

  const res = await apiClient<ShiftExecutionState>(
    `/bookings/${payload.bookingId}/reject-invalid-prescription`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  return {
    success: res.success,
    message: res.success ? 'Đã xử lý từ chối y lệnh' : (res.error?.message || 'Thất bại'),
    data: res.data,
  };
}

export async function triggerSosAlert(
  payload: SosAlertRequest
): Promise<{ success: boolean; message: string; emergencyId: string }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockTriggerSos(payload);
  }

  const res = await apiClient<{ emergency_id: string }>(`/bookings/${payload.bookingId}/sos`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    success: res.success,
    message: res.success ? 'Đã gửi tín hiệu SOS khẩn cấp!' : (res.error?.message || 'Gửi SOS thất bại'),
    emergencyId: res.data?.emergency_id || '',
  };
}

export async function submitCheckOut(
  payload: CheckOutRequest
): Promise<{ success: boolean; message: string; data?: ShiftExecutionState }> {
  if (USE_MOCK_SHIFTS) {
    return mockShift.mockSubmitCheckOut(payload);
  }

  const res = await apiClient<ShiftExecutionState>(`/bookings/${payload.bookingId}/check-out`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    success: res.success,
    message: res.success ? 'Hoàn tất ca trực thành công!' : (res.error?.message || 'Check-out thất bại'),
    data: res.data,
  };
}

