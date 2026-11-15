import {
  AdjustmentStatus,
  BookingDisputeStatus,
  ExecutionStatus,
  MobilityStatus,
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
}

export interface CheckInRequest {
  bookingId: string;
  latitude: number;
  longitude: number;
  isMockLocation: boolean;
  selfieImageBase64?: string;
  timestamp: string;
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
}

