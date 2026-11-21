/**
 * Types and job names for matching-radar (BE-2 · Phase 3 · FR-BOOK-03, BR-06, BR-08).
 */
import type { ExecutionStatus, MatchingMode, NurseTier, PaymentMethod, PaymentStatus, ProfileStatus } from '@healthcare-system/shared';

/** One Radar wave for one booking (wave 1 = initial radius, wave 2 = expanded radius). */
export const RADAR_WAVE_JOB = 'matching-radar.wave';

export interface RadarWavePayload {
  bookingId: string;
  wave: 1 | 2;
  /** When this dispatch started (ISO). Wave 2 and the offer deadline are measured from it. */
  startedAt: string;
  /** Nurses that must not be offered this booking again (e.g. the nurse just released from it). */
  excludeNurseIds?: string[];
}

/** How a nurse came to claim the booking. */
export type ClaimVia = 'RADAR' | 'JOB_BOARD' | 'DIRECT_REQUEST';

/** Stable error codes of a refused claim (HTTP status in matching-radar.service). */
export type ClaimErrorCode =
  | 'BOOKING_NOT_FOUND'
  | 'ALREADY_CLAIMED'
  | 'PAYMENT_NOT_SECURED'
  | 'NO_ACTIVE_OFFER'
  | 'NURSE_NOT_ACTIVE'
  | 'ACCOUNT_CLOSING'
  | 'TIER_MISMATCH'
  | 'DEPOSIT_SHORTFALL'
  | 'SCHEDULE_CONFLICT';

/** bookings row + service + care location, as matching reads it (under FOR UPDATE OF b). */
export type MatchingBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  matching_mode: MatchingMode;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  execution_status: ExecutionStatus;
  start_time: Date;
  end_time: Date;
  base_amount: string | number;
  surcharge_amount: string | number;
  urgent_bonus_amount: string | number;
  platform_fee: string | number;
  total_amount: string | number;
  prescription_image_url: string | null;
  prescription_issued_date: string | null;
  service_name: string;
  service_type: string;
  is_invasive: boolean;
  required_tier: NurseTier;
  care_lat: string | number | null;
  care_lng: string | number | null;
  patient_name: string;
  patient_dob: string | null;
  patient_gender: string | null;
  patient_weight_kg: string | number | null;
  patient_mobility: string;
};

/** A nurse as the eligibility gate reads her (locked row at claim time). */
export type NurseGateRow = {
  user_id: string;
  user_status: string;
  profile_status: ProfileStatus;
  tier: NurseTier;
  gphn_number: string | null;
  gphn_expiry_date: string | null;
  current_lat: string | number | null;
  current_lng: string | number | null;
  deposit_balance: string | number;
  /** ADR-0004 D2: grace period end (set by credential-review when the profile first becomes ACTIVE). */
  deposit_grace_expires_at: Date | null;
  /** Grace shifts already completed (incremented at settlement, BE-3). */
  deposit_grace_shifts_used: number;
  /** Bank-transfer shifts the nurse holds right now (CONFIRMED / IN_PROGRESS) — count against the grace cap. */
  held_transfer_shifts: string | number;
  /** ADR-0004 D3: set when the nurse asked to close the account → no new jobs. */
  closure_requested_at: Date | null;
};

/** Deposit rule inputs read from system_configs. */
export interface DepositRule {
  minDeposit: number; // MIN_NURSE_DEPOSIT
  graceMaxShifts: number; // DEPOSIT_GRACE_MAX_SHIFTS
}

export interface RadarNotice {
  userId: string;
  bookingId: string;
  title: string;
  body: string;
}

export interface WaveResult {
  /** false when the booking no longer needs dispatch (claimed, cancelled, expired…). */
  dispatched: boolean;
  offered: string[]; // nurse ids offered in this wave
  radiusKm: number;
}
