import {
  ExecutionStatus,
  PaymentStatus,
  BookingDisputeStatus,
  MobilityStatus,
  AdjustmentStatus,
} from '@healthcare-system/shared';

export interface VitalSignRecord {
  timestamp: string;
  heartRate: number; // bpm
  bloodPressureSystolic: number; // mmHg
  bloodPressureDiastolic: number; // mmHg
  temperature: number; // Celsius
  spo2: number; // %
  respiratoryRate?: number; // breaths / min
  bloodGlucose?: number; // mmol/L
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
  
  // Check-in info
  checkedInAt?: string;
  checkInDistanceMeters?: number;
  checkInSelfieUrl?: string;
  isMockLocationDetected: boolean;

  // 30-min initial assessment
  assessmentCompleted: boolean;
  assessmentCompletedAt?: string;
  conditionMismatchReported: boolean;
  mismatchReason?: string;
  mismatchOption?: 'SURCHARGE' | 'REFUSE';

  // Real-time clinical logs
  vitalSigns: VitalSignRecord[];
  careActivities: CareActivityItem[];
  progressNotes: string[];

  // Pending Extension
  pendingExtension?: {
    id: string;
    extraHours: number;
    extraAmount: number;
    requestedAt: string;
    status: AdjustmentStatus;
  } | null;

  // Check-out
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
