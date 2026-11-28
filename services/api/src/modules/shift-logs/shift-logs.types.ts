/**
 * shift-logs — types (BE-2 · Phase 4 · FR-SHIFT-02). Status enums come from packages/shared.
 */
import type {
  AdjustmentStatus,
  BookingDisputeStatus,
  ExecutionStatus,
  MobilityStatus,
  PaymentMethod,
  PaymentStatus,
  ShiftRealtimeMessage,
} from '@healthcare-system/shared';

export type ShiftChange = ShiftRealtimeMessage['change'];

/** Everything the shift screens need, in one row (bookings ⋈ service ⋈ patient ⋈ shift_logs). */
export interface ShiftRow {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  patient_profile_id: string;
  execution_status: ExecutionStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  dispute_status: BookingDisputeStatus;
  start_time: Date;
  end_time: Date;
  base_amount: string | number;
  surcharge_amount: string | number;
  platform_fee: string | number;
  total_amount: string | number;
  commission_due_at: Date | null;
  cancellation_reason: string | null;
  service_name: string;
  service_type: 'TASK_BASED' | 'SHIFT_BASED' | 'CONTRACT';
  service_unit: string;
  service_base_price: string | number;
  is_invasive: boolean;
  patient_name: string;
  patient_dob: Date | string | null;
  weight_kg: string | number | null;
  mobility_status: MobilityStatus;
  address_text: string | null;
  patient_lat: string | number | null;
  patient_lng: string | number | null;
  nurse_name: string | null;
  nurse_avatar_url: string | null;
  nurse_tier: string | null;
  // shift_logs (all NULL before check-in)
  log_id: string | null;
  checkin_time: Date | null;
  checkin_lat: string | number | null;
  checkin_lng: string | number | null;
  checkin_distance_m: string | number | null;
  is_mock_location_detected: boolean | null;
  checkin_selfie_url: string | null;
  condition_mismatch_reported: boolean | null;
  mismatch_reason: string | null;
  mismatch_option: 'SURCHARGE' | 'REFUSE' | null;
  initial_assessment: InitialAssessment | null;
  assessed_at: Date | null;
  vital_signs_log: StoredVital[] | null;
  care_activities_log: CareItem[] | null;
  progress_notes: StoredNote[] | null;
  final_vital_signs: StoredVital | null;
  handover_note: string | null;
  checkout_time: Date | null;
  log_updated_at: Date | null;
}

export type VitalKind = 'INITIAL' | 'ROUTINE' | 'FINAL';

/** One vital-sign reading as stored in shift_logs.vital_signs_log. */
export interface StoredVital {
  id: string;
  kind: VitalKind;
  /** Server time the reading reached the backend. */
  recordedAt: string;
  /** Device time of the measurement (offline queue), never later than recordedAt + skew. */
  measuredAt: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
  respiratoryRate?: number | null;
  bloodGlucose?: number | null;
  notes?: string | null;
}

/** Validated vitals as sent by the apps. */
export interface VitalsInput {
  id?: string;
  timestamp?: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
  respiratoryRate?: number;
  bloodGlucose?: number;
  notes?: string;
}

/** One care-checklist item as stored in shift_logs.care_activities_log. */
export interface CareItem {
  id: string;
  title: string;
  category: string;
  mandatory: boolean;
  completed: boolean;
  completedAt: string | null;
}

export interface StoredNote {
  id: string;
  at: string;
  text: string;
}

export interface InitialAssessment {
  actualMobility: MobilityStatus;
  mentalStatus: string;
  isConditionMatched: boolean;
  mismatchReason: string | null;
  requestedAction: 'SURCHARGE' | 'REFUSE' | null;
}

export interface AssessmentInput {
  actualMobility: MobilityStatus;
  mentalStatus: string;
  isConditionMatched: boolean;
  mismatchReason?: string;
  requestedAction?: 'SURCHARGE' | 'REFUSE';
  initialVitals: VitalsInput;
}

/** booking_adjustments row of type CONDITION_SURCHARGE. */
export interface SurchargeRow {
  id: string;
  booking_id: string;
  status: AdjustmentStatus | 'EXPIRED';
  extra_amount: string | number;
  extra_base_amount: string | number | null;
  extra_surcharge_amount: string | number | null;
  extra_platform_fee: string | number | null;
  decline_reason: string | null;
  payment_code: string | null;
  payment_expires_at: Date | null;
  paid_at: Date | null;
  applied_at: Date | null;
  created_at: Date;
  responded_at: Date | null;
}

/** booking_adjustments row of type EXTENSION still waiting for the nurse (shown in the nurse state). */
export interface PendingExtensionRow {
  id: string;
  extra_hours: number;
  extra_amount: string | number;
  created_at: Date;
  status: AdjustmentStatus;
}

export interface SurchargePrice {
  baseAmount: number;
  surchargeAmount: number;
  platformFee: number;
  totalAmount: number;
}

export type SurchargePaymentOutcome =
  | 'SURCHARGE_PAID'
  | 'DUPLICATE'
  | 'UNKNOWN_SURCHARGE'
  | 'AMOUNT_MISMATCH'
  | 'LATE_PAYMENT_REFUNDED';

/** Notice for core notifications (sent after COMMIT, never fails the request). */
export interface ShiftNotice {
  userId: string;
  bookingId: string;
  type: string;
  title: string;
  body: string;
  priority?: 'NORMAL' | 'HIGH';
  data?: Record<string, string>;
}

export type ShiftNotify = (n: ShiftNotice) => Promise<void>;

/** Shift event publisher (WebSocket fan-out). */
export type ShiftPublish = (bookingId: string, change: ShiftChange, executionStatus: ExecutionStatus) => void;

/** Shape of GET /bookings/:id/tracking — matches patient-web booking-tracking.types.ts BookingTracking. */
export interface BookingTrackingDto {
  bookingId: string;
  code: string;
  serviceLabel: string;
  patientName: string;
  addressText: string | null;
  paymentMethod: PaymentMethod;
  executionStatus: ExecutionStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  nurse: { nurseId: string; fullName: string; avatarUrl: string | null; tier: string } | null;
  checkIn: { at: string; selfieUrl: string | null; distanceMeters: number; lat: number; lng: number; watermark: string } | null;
  checkOutAt: string | null;
  vitals: {
    id: string;
    recordedAt: string;
    pulse: number | null;
    temperatureC: number | null;
    systolic: number | null;
    diastolic: number | null;
    spo2: number | null;
    note?: string | null;
  }[];
  activities: { id: string; at: string; text: string }[];
  /** SOS is BE-3 (FR-SHIFT-05); null until that module exists. */
  emergency: null;
  extensions: unknown[];
  /** Condition-mismatch surcharge waiting for (or answered by) the family. Not in patient-web yet: FE-1 to add. */
  conditionSurcharge: unknown | null;
  serverTime: string;
}

/** List item of GET /nurse/shifts — the overlap of nurse-app MobileShiftSummary and nurse-web ShiftExecutionState. */
export interface NurseShiftItem {
  bookingId: string;
  bookingCode: string;
  patientName: string;
  patientAge: number | null;
  patientAddress: string | null;
  patientLatitude: number | null;
  patientLongitude: number | null;
  mobilityStatus: MobilityStatus | null;
  serviceName: string;
  isInvasive: boolean;
  startTime: string;
  endTime: string;
  timeRange: string;
  scheduledHours: number;
  executionStatus: ExecutionStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  disputeStatus: BookingDisputeStatus;
  totalAmount: number;
  commissionAmount: number;
  netAmount: number;
  checkedInAt: string | null;
  checkedOutAt: string | null;
}

export type ShiftListFilter = 'upcoming' | 'in_progress' | 'completed';

/** Redis channel of shift events (API processes only). */
export const SHIFT_REALTIME_CHANNEL = 'shifts:realtime';

/** WebSocket paths (the apps connect with ?bookingId=…&access_token=…). */
export const SHIFT_WS_PATHS = ['/ws/shifts', '/api/v1/ws/shifts'];

/** Notification types used by the shift modules (notifications.type is VARCHAR(40)). */
export const SHIFT_NOTICE = {
  CHECKED_IN: 'SHIFT_CHECKED_IN',
  SURCHARGE_REQUEST: 'CONDITION_SURCHARGE_REQUEST',
  SURCHARGE_ANSWERED: 'CONDITION_SURCHARGE_ANSWERED',
  CANCELLED: 'BOOKING_CANCELLED',
  COMPLETED: 'SHIFT_COMPLETED',
  COMMISSION_DUE: 'COMMISSION_DUE',
} as const;
