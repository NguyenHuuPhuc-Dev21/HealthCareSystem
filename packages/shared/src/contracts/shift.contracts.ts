import {
  AdjustmentStatus,
  BookingDisputeStatus,
  ExecutionStatus,
  MobilityStatus,
  PaymentMethod,
  PaymentStatus,
} from '../enums';

export interface VitalSignRecord {
  id?: string;
  timestamp: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
  respiratoryRate?: number;
  bloodGlucose?: number;
  notes?: string;
}

export interface CareActivityItem {
  id: string;
  title: string;
  category: string;
  completed: boolean;
  completedAt?: string;
  mandatory: boolean;
}

export interface ShiftExecutionState {
  bookingId: string;
  bookingCode: string;
  patientName: string;
  patientAge: number;
  patientAddress: string;
  patientLatitude: number;
  patientLongitude: number;
  mobilityStatus: MobilityStatus;
  isInvasive: boolean;
  serviceName: string;
  startTime: string;
  endTime: string;
  scheduledHours: number;
  totalAmount: number;
  executionStatus: ExecutionStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod | string;
  disputeStatus: BookingDisputeStatus;
  checkedInAt?: string;
  checkInDistanceMeters?: number;
  checkInSelfieUrl?: string;
  isMockLocationDetected: boolean;
  assessmentCompleted: boolean;
  assessmentCompletedAt?: string;
  conditionMismatchReported: boolean;
  mismatchReason?: string;
  mismatchOption?: 'SURCHARGE' | 'REFUSE';
  vitalSigns: VitalSignRecord[];
  careActivities: CareActivityItem[];
  progressNotes: string[];
  pendingExtension?: {
    id: string;
    extraHours: number;
    extraAmount: number;
    requestedAt: string;
    status: AdjustmentStatus;
  } | null;
  checkedOutAt?: string;
  handoverNotes?: string;
  finalVitalSigns?: VitalSignRecord;
  // ---- Added by the backend (BE-2 Phase 4, docs/api/shift-execution.api.md) ----
  /** "2026-11-16 08:02:11 · 10.77690, 106.70090" — server time + GPS stamped on the check-in selfie. */
  checkInWatermark?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  serviceType?: 'TASK_BASED' | 'SHIFT_BASED' | 'CONTRACT';
  /** Condition-mismatch surcharge asked to the family (FR-SHIFT-02), if any. */
  conditionSurcharge?: ConditionSurchargeView | null;
  /** Set once checked out: the clocks started by the check-out (FR-SHIFT-04). */
  checkout?: CheckOutSummary | null;
  /** Last write to the shift log (ISO). */
  updatedAt?: string;
  /** Refused for a condition mismatch: travel support paid to the nurse (ICU_TRAVEL_SUPPORT, VND). */
  travelSupportAmount?: number;
}

export type ConditionSurchargeStatus = 'AWAITING_FAMILY' | 'AWAITING_PAYMENT' | 'IN_EFFECT' | 'DECLINED' | 'EXPIRED';

export interface ConditionSurchargeView {
  id: string;
  status: ConditionSurchargeStatus;
  reason: string | null;
  actualMobility: MobilityStatus | null;
  /** Extra amount (VND) computed by the backend with pricing-engine. */
  amount: number;
  paymentMethod: PaymentMethod | string;
  createdAt: string;
  respondedAt: string | null;
  /** Bank transfer only, while AWAITING_PAYMENT: transfer content `<booking code>-PT<n>`. */
  paymentCode: string | null;
  paymentExpiresAt: string | null;
  bankTransfer: { bankName: string; accountNumber: string; accountName: string; transferContent: string } | null;
  qrImageUrl: string | null;
}

export interface CheckOutSummary {
  checkedOutAt: string;
  /** Bank transfer: earliest automatic settlement (check-out + SETTLEMENT_COOLING_HOURS, if no dispute). */
  settlementEarliestAt: string | null;
  /** Cash: the 15% commission must be paid before this time (check-out + CASH_COMMISSION_DUE_HOURS). */
  commissionDueAt: string | null;
  /** The nurse can read the medical record until this time (check-out + RECORD_ACCESS_EXPIRY_HOURS). */
  recordAccessUntil: string;
  /** Two-way reviews are open (booking COMPLETED). */
  reviewOpen: boolean;
}

/** POST /bookings/:id/check-in/selfie-upload-url */
export interface CheckInSelfieUploadRequest {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface CheckInSelfieUploadUrl {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  contentType: string;
}

/** POST /bookings/:id/condition-surcharge/respond (family) */
export interface RespondConditionSurchargeRequest {
  approved: boolean;
}

/** POST /bookings/:id/condition-mismatch/refuse (nurse) */
export interface RefuseShiftRequest {
  reason?: string;
}

/** POST /bookings/:id/notes (nurse) */
export interface AddCareNoteRequest {
  /** Client id (UUID) so an offline retry is stored once. */
  id?: string;
  text: string;
}

/** WebSocket /ws/shifts?bookingId=… — sent on every change of the shift; the apps then reload the state. */
export interface ShiftRealtimeMessage {
  type: 'SHIFT_UPDATED';
  bookingId: string;
  change:
    | 'CHECKED_IN'
    | 'ASSESSMENT'
    | 'VITALS'
    | 'ACTIVITY'
    | 'NOTE'
    | 'SURCHARGE_REQUESTED'
    | 'SURCHARGE_ANSWERED'
    | 'SURCHARGE_PAID'
    | 'CANCELLED'
    | 'CHECKED_OUT';
  at: string;
  executionStatus: ExecutionStatus;
}

export interface CheckInRequest {
  bookingId?: string;
  latitude: number;
  longitude: number;
  isMockLocation: boolean;
  /** Key returned by POST /bookings/:id/check-in/selfie-upload-url after the PUT (files never go through the API). */
  selfieKey?: string;
  /** Reported GPS accuracy (m), stored for Admin review. */
  accuracyMeters?: number;
  /** @deprecated replaced by selfieKey (the API body limit is 1 MB and files go to storage directly). */
  selfieImageBase64?: string;
  /** Device time; ignored — the backend stamps its own time. */
  timestamp?: string;
}

export interface InitialAssessmentRequest {
  bookingId: string;
  actualMobility: MobilityStatus;
  mentalStatus: string;
  isConditionMatched: boolean;
  mismatchReason?: string;
  requestedAction?: 'SURCHARGE' | 'REFUSE';
  initialVitals: VitalSignRecord;
}

export interface AddVitalSignsRequest {
  bookingId: string;
  vitals: VitalSignRecord;
}

export interface ToggleCareActivityRequest {
  bookingId: string;
  activityId: string;
  completed: boolean;
}

export interface RespondExtensionRequest {
  bookingId: string;
  extensionId: string;
  approved: boolean;
  declineReason?: string;
}

export interface RejectPrescriptionRequest {
  bookingId: string;
  reason: string;
  evidencePhotoBase64?: string;
  evidenceFileName: string;
}

export interface CheckOutRequest {
  bookingId: string;
  checkoutTime: string;
  finalVitals: VitalSignRecord;
  completedActivityIds: string[];
  handoverNote: string;
}

export interface SosAlertRequest {
  bookingId: string;
  latitude: number;
  longitude: number;
  currentVitals?: Partial<VitalSignRecord>;
  incidentDetails?: string;
}

export interface MobileShiftSummary {
  bookingId: string;
  bookingCode: string;
  patientName: string;
  patientAge: number;
  patientAddress: string;
  patientLatitude: number;
  patientLongitude: number;
  serviceName: string;
  timeRange: string;
  mobilityNote?: string;
  allergies?: string;
  isInvasive: boolean;
  prescriptionSummary?: string;
  executionStatus?: ExecutionStatus;
  paymentStatus?: PaymentStatus;
  disputeStatus?: BookingDisputeStatus;
  paymentMethod?: PaymentMethod | string;
  totalAmount?: number;
  commissionAmount?: number;
  netAmount?: number;
  district?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

