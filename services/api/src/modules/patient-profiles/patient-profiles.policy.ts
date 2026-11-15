/**
 * patient-profiles policy — PURE rules (no DB, no clock). BE-2 · Phase 1 · FR-AUTH-03, US-HP-06 AC-01.
 */
import { KycStatus, LocationType } from '@healthcare-system/shared';

/**
 * Location-based eKYC gate (FR-AUTH-03 §2, BR-14 §2.1, RTM TC-KYC-01):
 *  - HOME care     → the customer account must be eKYC VERIFIED before a booking can be created;
 *  - HOSPITAL care → phone + OTP is enough.
 */
export function requiresCustomerEkyc(locationType: LocationType): boolean {
  return locationType === LocationType.HOME;
}

export type EkycGateResult = { allowed: true } | { allowed: false; code: 'EKYC_REQUIRED' };

export function checkEkycGate(kycStatus: KycStatus, locationType: LocationType): EkycGateResult {
  if (!requiresCustomerEkyc(locationType) || kycStatus === KycStatus.VERIFIED) return { allowed: true };
  return { allowed: false, code: 'EKYC_REQUIRED' };
}

/** Why a customer may not (re)submit eKYC right now, or null when they may. */
export function ekycSubmissionBlocker(kycStatus: KycStatus): 'EKYC_ALREADY_VERIFIED' | 'EKYC_ALREADY_SUBMITTED' | null {
  if (kycStatus === KycStatus.VERIFIED) return 'EKYC_ALREADY_VERIFIED';
  if (kycStatus === KycStatus.PENDING) return 'EKYC_ALREADY_SUBMITTED';
  return null; // UNVERIFIED: first submission, or again after a rejection
}

/** Keeps the last 4 digits: "079200001234" → "********1234". */
export function maskCccd(cccd: string | null): string | null {
  if (!cccd) return null;
  return cccd.length <= 4 ? '*'.repeat(cccd.length) : `${'*'.repeat(cccd.length - 4)}${cccd.slice(-4)}`;
}

/** Date of birth must be a past (or today's) Vietnam date and not absurdly old. */
export function dobProblem(dob: string | null, today: string): 'DOB_IN_FUTURE' | 'DOB_TOO_OLD' | null {
  if (!dob) return null;
  if (dob > today) return 'DOB_IN_FUTURE';
  if (dob < '1900-01-01') return 'DOB_TOO_OLD';
  return null;
}
