/**
 * matching-radar policy — PURE rules (no DB, no clock). BE-2 · Phase 3 · FR-BOOK-03, BR-08 §2.3.
 */
import { MatchingMode, NurseTier, PaymentMethod, ProfileStatus, UserStatus, haversineDistanceMeters } from '@healthcare-system/shared';
import { vnDate } from '../availability-engine/availability-engine.policy';
import { isTier2ValidOn } from '../tier-lifecycle/tier-lifecycle.policy';
import type { ClaimErrorCode, DepositRule, NurseGateRow } from './matching-radar.types';

const HOUR_MS = 3_600_000;

/** Start within `urgentLeadHours` (6 h) → Radar Dispatch; later → Job Board (FR-BOOK-03). */
export function routeMatchingMode(start: Date, nowMs: number, urgentLeadHours: number): MatchingMode {
  return start.getTime() - nowMs <= urgentLeadHours * HOUR_MS ? MatchingMode.RADAR_DISPATCH : MatchingMode.JOB_BOARD;
}

/** Invasive services and services whose required tier is Tier 2 need a Tier 2 nurse with a valid GPHN. */
export function needsTier2(service: { is_invasive: boolean; required_tier: NurseTier | string }): boolean {
  return service.is_invasive || service.required_tier === NurseTier.TIER_2_SPECIALIST;
}

/**
 * Deposit gate (FR-PAY-03 rule 6, FR-BOOK-03, ADR-0004 D2):
 *  - full deposit (>= MIN_NURSE_DEPOSIT) → any booking;
 *  - otherwise the GRACE PERIOD: only BANK_TRANSFER bookings (100% already in escrow, so a penalty can be taken
 *    from the shift money), while now < deposit_grace_expires_at and
 *    (grace shifts completed + transfer shifts currently held) < DEPOSIT_GRACE_MAX_SHIFTS;
 *  - cash bookings always need the full deposit;
 *  - a debt (deposit_balance < 0 after a penalty) is never covered by grace (BR-04, FR-PAY-03).
 * Counting held shifts as well caps the exposure: a nurse in grace can never hold more than the cap at once.
 */
export function depositAllows(nurse: NurseGateRow, paymentMethod: PaymentMethod | string, rule: DepositRule, nowMs: number): boolean {
  if (Number(nurse.deposit_balance) >= rule.minDeposit) return true;
  if (paymentMethod !== PaymentMethod.BANK_TRANSFER) return false;
  // A debt (negative deposit after a penalty) is never covered by grace: BR-04 / FR-PAY-03 unchanged by ADR-0004.
  if (Number(nurse.deposit_balance) < 0) return false;
  if (!nurse.deposit_grace_expires_at || new Date(nurse.deposit_grace_expires_at).getTime() <= nowMs) return false;
  return Number(nurse.deposit_grace_shifts_used) + Number(nurse.held_transfer_shifts) < rule.graceMaxShifts;
}

/**
 * Hard eligibility gate (BR-08 §2.3 items 1–3), re-checked on the backend at the moment of a claim.
 * Tier 2 is judged on the SHIFT date (GPHN must still be valid that day), not on the tier column alone.
 * Availability (item 4) is availability-engine's job; radius (item 5) is the offer's.
 */
export function eligibilityBlocker(
  nurse: NurseGateRow,
  booking: { is_invasive: boolean; required_tier: NurseTier | string; payment_method: PaymentMethod | string },
  shiftStart: Date,
  rule: DepositRule,
  nowMs: number,
): Extract<ClaimErrorCode, 'NURSE_NOT_ACTIVE' | 'ACCOUNT_CLOSING' | 'TIER_MISMATCH' | 'DEPOSIT_SHORTFALL'> | null {
  if (nurse.profile_status !== ProfileStatus.ACTIVE || nurse.user_status !== UserStatus.ACTIVE) return 'NURSE_NOT_ACTIVE';
  if (nurse.closure_requested_at) return 'ACCOUNT_CLOSING';
  if (
    needsTier2(booking) &&
    !isTier2ValidOn(
      { tier: nurse.tier, gphnNumber: nurse.gphn_number, gphnExpiryDate: nurse.gphn_expiry_date },
      vnDate(shiftStart.getTime()),
    )
  ) {
    return 'TIER_MISMATCH';
  }
  if (!depositAllows(nurse, booking.payment_method, rule, nowMs)) return 'DEPOSIT_SHORTFALL';
  return null;
}

/** Distance in km between the nurse's last known position and the care location, or null when unknown. */
export function distanceKm(
  nurse: { current_lat: string | number | null; current_lng: string | number | null },
  care: { lat: number; lng: number },
): number | null {
  if (nurse.current_lat === null || nurse.current_lng === null) return null;
  return haversineDistanceMeters(Number(nurse.current_lat), Number(nurse.current_lng), care.lat, care.lng) / 1000;
}

/** Radius of a wave: wave 1 = initial (5 km), wave 2 = expanded (10 km). */
export function waveRadiusKm(wave: 1 | 2, initialKm: number, expandedKm: number): number {
  return wave === 1 ? initialKm : expandedKm;
}

/** Rough degrees for a bounding box around a point (pre-filter before the exact Haversine check). */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}
