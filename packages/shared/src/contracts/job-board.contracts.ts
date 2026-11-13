export type JobServiceType = 'procedure' | 'shift';
export type JobBoardFilter = 'all' | 'shift' | 'task' | 'near' | 'bonus';

export interface JobItem {
  id: string;
  code: string;
  serviceName: string;
  serviceType: JobServiceType;
  requiredTier: 'TIER_1_BASIC' | 'TIER_2_SPECIALIST';
  isInvasive: boolean;
  hasPrescription: boolean;
  prescriptionUrl?: string;
  prescriptionFileName?: string;
  prescriptionPrescribedDate?: string;
  prescriptionExpiryDays?: number;
  date: string;
  startTime: string;
  endTime: string;
  district: string;
  distanceKm: number;
  patientName: string;
  patientAge: number;
  patientGender?: string;
  patientWeight?: number;
  mobilityStatus?: string;
  medicalCondition?: string;
  medicalHistory?: string;
  allergies?: string;
  contagionRisk?: string;
  fullAddress?: string;
  customerName?: string;
  customerPhoneMasked?: string;
  note?: string;
  totalAmount: number;
  baseAmount: number;
  urgentBonus?: number;
  nightSurcharge?: number;
  durationHours?: number;
  netAmount?: number;
  cancellationPenaltyPercent?: number;
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  paymentStatus: 'ESCROW_HELD' | 'UNPAID';
  matchingMode: 'JOB_BOARD' | 'RADAR_DISPATCH';
  isDirectInvite?: boolean;
  inviterName?: string;
  directInviteExpiresAt?: string;
  status: 'MATCHING' | 'CONFIRMED' | 'IN_PROGRESS';
  isLockedForTier1?: boolean;
}

export interface RadarJob extends JobItem {
  wave: 1 | 2;
  radarExpiresAt: string;
  expiresInSeconds?: number;
  isUrgent?: boolean;
}

export interface DirectInvitation {
  bookingId: string;
  code: string;
  inviterName: string;
  patientName: string;
  patientAge: number;
  serviceName: string;
  date: string;
  startTime: string;
  endTime: string;
  district: string;
  totalAmount: number;
  expiresAt: string;
  expiresInSeconds?: number;
}

export interface ClaimJobResult {
  success: boolean;
  bookingId?: string;
  message?: string;
  errorCode?: 'ALREADY_CLAIMED' | 'TIER_MISMATCH' | 'DEPOSIT_SHORTFALL' | 'SCHEDULE_CONFLICT';
}

