import type { MobileShiftSummary } from '@healthcare-system/shared';
import { apiClient, ApiResponse } from '../../lib/api-client';

export type { MobileShiftSummary };

export interface PendingExtensionDto {
  id: string;
  hours: number;
  extraAmount: number;
}

export interface MobileShiftExecutionState {
  assessmentCompleted?: boolean;
  mobilityStatus?: string;
  mismatchReported?: boolean;
  pendingExtension?: PendingExtensionDto | null;
  careActivities?: Array<{ id: string; title: string; completed: boolean }>;
  vitalSigns?: Array<{
    id?: string;
    timestamp?: string;
    heartRate: number;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    temperature: number;
    spo2: number;
  }>;
}

export interface MobileAssessmentPayload {
  actualMobility: string;
  mentalStatus: string;
  isConditionMatched: boolean;
  mismatchReason?: string;
  requestedAction?: 'SURCHARGE' | 'REFUSE';
}

export interface MobileVitalSignPayload {
  timestamp: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
}

export interface MobileRejectPrescriptionPayload {
  reason: string;
  evidencePhotoUri: string;
}

export interface MobileCheckOutPayload {
  checkoutTime: string;
  finalVitals: MobileVitalSignPayload;
  completedActivityIds: string[];
  handoverNote: string;
}

export async function getMyShifts(): Promise<ApiResponse<MobileShiftSummary[]>> {
  return apiClient<MobileShiftSummary[]>('/nurse/shifts');
}

export async function getShiftExecutionState(
  bookingId: string
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/shift-state`);
}

export async function submitInitialAssessment(
  bookingId: string,
  payload: MobileAssessmentPayload
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/assessment`, {
    method: 'POST',
    body: JSON.stringify({ bookingId, ...payload }),
  });
}

export async function addVitalSigns(
  bookingId: string,
  vitals: MobileVitalSignPayload
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/vitals`, {
    method: 'POST',
    body: JSON.stringify(vitals),
  });
}

export async function toggleCareActivity(
  bookingId: string,
  activityId: string,
  completed: boolean
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(
    `/bookings/${bookingId}/activities/${activityId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    }
  );
}

export async function respondToExtension(
  bookingId: string,
  extensionId: string,
  approved: boolean
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/extend/respond`, {
    method: 'POST',
    body: JSON.stringify({ bookingId, extensionId, approved }),
  });
}

export async function rejectInvalidPrescription(
  bookingId: string,
  payload: MobileRejectPrescriptionPayload
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(
    `/bookings/${bookingId}/reject-invalid-prescription`,
    {
      method: 'POST',
      body: JSON.stringify({ bookingId, ...payload }),
    }
  );
}

export async function submitCheckOut(
  bookingId: string,
  payload: MobileCheckOutPayload
): Promise<ApiResponse<MobileShiftExecutionState>> {
  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/check-out`, {
    method: 'POST',
    body: JSON.stringify({ bookingId, ...payload }),
  });
}

