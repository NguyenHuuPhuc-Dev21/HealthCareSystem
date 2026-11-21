import type { MobileShiftSummary } from '@healthcare-system/shared';
import { apiClient, ApiResponse } from '../../lib/api-client';
import { env } from '../../lib/env';
import { mockGetShiftById, mockGetShifts } from '../shifts/shifts.mock';
import {
  enqueueAction,
  isNetworkConnected,
  validateCheckOutPrerequisites,
  type QueuedAction,
} from './offline-queue';

export type { MobileShiftSummary };

export interface GetMyShiftsParams {
  status?: 'upcoming' | 'in_progress' | 'completed';
}

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

export interface ShiftMutationResult<T = MobileShiftExecutionState> {
  success: boolean;
  data?: T;
  isOfflineQueued?: boolean;
  error?: {
    code?: string;
    message: string;
  };
}

export async function getMyShifts(
  params?: GetMyShiftsParams
): Promise<ApiResponse<MobileShiftSummary[]>> {
  if (env.useMockShifts) {
    const list = mockGetShifts(params);
    return { success: true, data: list };
  }

  const query = params?.status ? `?status=${params.status}` : '';
  return apiClient<MobileShiftSummary[]>(`/nurse/shifts${query}`);
}

export async function getShiftState(
  bookingId: string
): Promise<ApiResponse<MobileShiftSummary | null>> {
  if (env.useMockShifts) {
    const item = mockGetShiftById(bookingId);
    return { success: true, data: item };
  }

  return apiClient<MobileShiftSummary>(`/bookings/${bookingId}/shift-state`);
}

export async function getShiftExecutionState(
  bookingId: string
): Promise<ApiResponse<MobileShiftExecutionState>> {
  if (env.useMockShifts) {
    return {
      success: true,
      data: {
        assessmentCompleted: false,
        mobilityStatus: 'PARTIAL',
        mismatchReported: false,
        careActivities: [
          { id: '1', title: 'Đo sinh tồn ban đầu (Mạch, Huyết áp, Thân nhiệt, SpO2)', completed: false },
          { id: '2', title: 'Đối chiếu y lệnh gốc và thuốc, vật tư tại chỗ', completed: false },
          { id: '3', title: 'Thực hiện quy trình chăm sóc điều dưỡng', completed: false },
          { id: '4', title: 'Đo sinh tồn cuối ca và hướng dẫn người nhà theo dõi', completed: false },
        ],
        vitalSigns: [],
      },
    };
  }

  return apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/shift-state`);
}

/**
 * Submits initial 30-min clinical assessment.
 * Automatically saves to offline queue when disconnected.
 */
export async function submitInitialAssessment(
  bookingId: string,
  payload: MobileAssessmentPayload
): Promise<ShiftMutationResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId,
      type: 'SUBMIT_ASSESSMENT',
      payload,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: {
        assessmentCompleted: true,
        mobilityStatus: payload.actualMobility,
        mismatchReported: !payload.isConditionMatched,
      },
    };
  }

  if (env.useMockShifts) {
    return {
      success: true,
      data: {
        assessmentCompleted: true,
        mobilityStatus: payload.actualMobility,
        mismatchReported: !payload.isConditionMatched,
      },
    };
  }

  try {
    const res = await apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/assessment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, ...payload }),
    });

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId,
        type: 'SUBMIT_ASSESSMENT',
        payload,
      });
      return {
        success: true,
        isOfflineQueued: true,
        data: {
          assessmentCompleted: true,
          mobilityStatus: payload.actualMobility,
          mismatchReported: !payload.isConditionMatched,
        },
      };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId,
      type: 'SUBMIT_ASSESSMENT',
      payload,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: {
        assessmentCompleted: true,
        mobilityStatus: payload.actualMobility,
        mismatchReported: !payload.isConditionMatched,
      },
    };
  }
}

/**
 * Adds vital signs log entry.
 * Enqueues to offline queue if device is offline or network fails.
 */
export async function addVitalSigns(
  bookingId: string,
  vitals: MobileVitalSignPayload
): Promise<ShiftMutationResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId,
      type: 'ADD_VITALS',
      payload: vitals,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: {
        vitalSigns: [vitals],
      },
    };
  }

  if (env.useMockShifts) {
    return {
      success: true,
      data: {
        vitalSigns: [vitals],
      },
    };
  }

  try {
    const res = await apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vitals),
    });

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId,
        type: 'ADD_VITALS',
        payload: vitals,
      });
      return {
        success: true,
        isOfflineQueued: true,
        data: {
          vitalSigns: [vitals],
        },
      };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId,
      type: 'ADD_VITALS',
      payload: vitals,
    });
    return {
      success: true,
      isOfflineQueued: true,
      data: {
        vitalSigns: [vitals],
      },
    };
  }
}

/**
 * Toggles a care activity checkbox.
 * Enqueues to offline queue if offline or network fails.
 */
export async function toggleCareActivity(
  bookingId: string,
  activityId: string,
  completed: boolean
): Promise<ShiftMutationResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId,
      type: 'TOGGLE_ACTIVITY',
      payload: { activityId, completed },
    });
    return { success: true, isOfflineQueued: true };
  }

  if (env.useMockShifts) {
    return { success: true };
  }

  try {
    const res = await apiClient<MobileShiftExecutionState>(
      `/bookings/${bookingId}/activities/${activityId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed }),
      }
    );

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId,
        type: 'TOGGLE_ACTIVITY',
        payload: { activityId, completed },
      });
      return { success: true, isOfflineQueued: true };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId,
      type: 'TOGGLE_ACTIVITY',
      payload: { activityId, completed },
    });
    return { success: true, isOfflineQueued: true };
  }
}

export async function respondToExtension(
  bookingId: string,
  extensionId: string,
  approved: boolean
): Promise<ShiftMutationResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId,
      type: 'RESPOND_EXTENSION',
      payload: { extensionId, approved },
    });
    return { success: true, isOfflineQueued: true };
  }

  if (env.useMockShifts) {
    return { success: true };
  }

  try {
    const res = await apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/extend/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, extensionId, approved }),
    });

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId,
        type: 'RESPOND_EXTENSION',
        payload: { extensionId, approved },
      });
      return { success: true, isOfflineQueued: true };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId,
      type: 'RESPOND_EXTENSION',
      payload: { extensionId, approved },
    });
    return { success: true, isOfflineQueued: true };
  }
}

export async function rejectInvalidPrescription(
  bookingId: string,
  payload: MobileRejectPrescriptionPayload
): Promise<ShiftMutationResult> {
  const online = await isNetworkConnected();

  if (!online) {
    await enqueueAction({
      bookingId,
      type: 'REJECT_PRESCRIPTION',
      payload,
    });
    return { success: true, isOfflineQueued: true };
  }

  if (env.useMockShifts) {
    return { success: true };
  }

  try {
    const res = await apiClient<MobileShiftExecutionState>(
      `/bookings/${bookingId}/reject-invalid-prescription`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, ...payload }),
      }
    );

    if (!res.success && (!res.error?.code || res.error?.code === 'NETWORK_ERROR')) {
      await enqueueAction({
        bookingId,
        type: 'REJECT_PRESCRIPTION',
        payload,
      });
      return { success: true, isOfflineQueued: true };
    }

    return res;
  } catch {
    await enqueueAction({
      bookingId,
      type: 'REJECT_PRESCRIPTION',
      payload,
    });
    return { success: true, isOfflineQueued: true };
  }
}

/**
 * Submits shift check-out.
 * Hard requirement: online network connection AND empty offline queue.
 */
export async function submitCheckOut(
  bookingId: string,
  payload: MobileCheckOutPayload
): Promise<ApiResponse<MobileShiftExecutionState>> {
  // Step 1: Validate online and queue empty
  const prereq = await validateCheckOutPrerequisites(bookingId);
  if (!prereq.allowed) {
    return {
      success: false,
      data: null as unknown as MobileShiftExecutionState,
      error: {
        code: 'CHECKOUT_PRECONDITION_FAILED',
        message: prereq.reason || 'Chưa đủ điều kiện kết thúc ca trực.',
      },
    };
  }

  if (env.useMockShifts) {
    return {
      success: true,
      data: {
        assessmentCompleted: true,
        careActivities: payload.completedActivityIds.map((id) => ({
          id,
          title: `Việc #${id}`,
          completed: true,
        })),
        vitalSigns: [payload.finalVitals],
      },
    };
  }

  const res = await apiClient<MobileShiftExecutionState>(`/bookings/${bookingId}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, ...payload }),
  });

  if (!res.success) {
    if (res.error?.code === 'CHECKOUT_REPORT_REQUIRED') {
      return {
        success: false,
        data: null as unknown as MobileShiftExecutionState,
        error: {
          code: 'CHECKOUT_REPORT_REQUIRED',
          message: 'Bắt buộc nhập ghi chú bàn giao và sinh hiệu cuối ca để kết thúc ca trực.',
        },
      };
    }
  }

  return res;
}

/**
 * Executes a single queued item against the server with Idempotency-Key.
 */
export async function executeQueuedShiftAction(action: QueuedAction): Promise<boolean> {
  if (env.useMockShifts) {
    return true;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'Idempotency-Key': action.idempotencyKey,
    };

    switch (action.type) {
      case 'ADD_VITALS': {
        const res = await apiClient(`/bookings/${action.bookingId}/vitals`, {
          method: 'POST',
          headers,
          body: JSON.stringify(action.payload),
        });
        return res.success;
      }
      case 'TOGGLE_ACTIVITY': {
        const { activityId, completed } = action.payload;
        const res = await apiClient(
          `/bookings/${action.bookingId}/activities/${activityId}`,
          {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ completed }),
          }
        );
        return res.success;
      }
      case 'SUBMIT_ASSESSMENT': {
        const res = await apiClient(`/bookings/${action.bookingId}/assessment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ bookingId: action.bookingId, ...action.payload }),
        });
        return res.success;
      }
      case 'RESPOND_EXTENSION': {
        const { extensionId, approved } = action.payload;
        const res = await apiClient(`/bookings/${action.bookingId}/extend/respond`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ bookingId: action.bookingId, extensionId, approved }),
        });
        return res.success;
      }
      case 'REJECT_PRESCRIPTION': {
        const res = await apiClient(
          `/bookings/${action.bookingId}/reject-invalid-prescription`,
          {
            method: 'POST',
            headers,
            body: JSON.stringify({ bookingId: action.bookingId, ...action.payload }),
          }
        );
        return res.success;
      }
      case 'TRIGGER_SOS': {
        const res = await apiClient(`/bookings/${action.bookingId}/sos`, {
          method: 'POST',
          headers,
          body: JSON.stringify(action.payload),
        });
        return res.success;
      }
      default:
        return true;
    }
  } catch {
    return false;
  }
}
