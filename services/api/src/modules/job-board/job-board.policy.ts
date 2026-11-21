/**
 * job-board policy — PURE rules (no DB, no clock). BE-3 · Phase 3 · FR-BOOK-03 · BR-08 §2.2/§2.3 · ADR-0004 D2.
 *
 * Who may see / take a job is NOT decided here: it is matching-radar's eligibilityBlocker (ACTIVE, no closure
 * request, Tier valid on the shift date, deposit rule incl. the grace period: a nurse short of the deposit only
 * sees BANK_TRANSFER jobs). This file maps rows to FE-2's shapes with need-to-know data only.
 */
import type { DirectInvitation, JobItem } from '@healthcare-system/shared';
import { PaymentStatus } from '@healthcare-system/shared';
import { vnClock, vnDate } from '../availability-engine/availability-engine.policy';
import { distanceKm, eligibilityBlocker } from '../matching-radar/matching-radar.policy';
import type { DepositRule, NurseGateRow } from '../matching-radar/matching-radar.types';
import type { BoardBookingRow } from './job-board.types';

const num = (v: string | number | null): number => Number(v ?? 0);

/** Vietnamese given name only ("Trần Văn Bình" → "Bình"); the full identity is shown after the claim. */
export function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

export function ageOn(dob: string | null, today: string): number {
  if (!dob) return 0;
  const age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  return today.slice(5) < dob.slice(5) ? age - 1 : age;
}

/** The same hard gate as a claim (BR-08 §2.3 items 1–3). Availability (item 4) is checked by the caller. */
export function eligibleFor(nurse: NurseGateRow, b: BoardBookingRow, rule: DepositRule, nowMs: number): boolean {
  return eligibilityBlocker(nurse, b, new Date(b.start_time), rule, nowMs) === null;
}

export function toJobItem(
  b: BoardBookingRow,
  nurse: Pick<NurseGateRow, 'current_lat' | 'current_lng'>,
  nowMs: number,
  invite?: { expiresAt: Date | null },
): JobItem {
  const start = new Date(b.start_time).getTime();
  const end = new Date(b.end_time).getTime();
  const total = num(b.total_amount);
  const bonus = num(b.urgent_bonus_amount);
  const km = b.care_lat === null || b.care_lng === null ? null : distanceKm(nurse, { lat: Number(b.care_lat), lng: Number(b.care_lng) });
  return {
    id: b.id,
    code: b.booking_code,
    serviceName: b.service_name,
    serviceType: b.service_type === 'SHIFT_BASED' ? 'shift' : 'procedure',
    requiredTier: b.required_tier,
    isInvasive: b.is_invasive,
    hasPrescription: b.prescription_image_url !== null,
    ...(b.prescription_issued_date ? { prescriptionPrescribedDate: b.prescription_issued_date } : {}),
    date: vnDate(start),
    startTime: vnClock(start),
    endTime: vnClock(end),
    district: '', // not stored on patient_profiles; the full address is shown after the claim (need-to-know)
    distanceKm: km === null ? 0 : Math.round(km * 10) / 10,
    patientName: givenName(b.patient_name),
    patientAge: ageOn(b.patient_dob, vnDate(nowMs)),
    ...(b.patient_gender ? { patientGender: b.patient_gender } : {}),
    ...(b.patient_weight_kg !== null ? { patientWeight: Number(b.patient_weight_kg) } : {}),
    mobilityStatus: b.patient_mobility,
    totalAmount: total,
    baseAmount: num(b.base_amount),
    ...(bonus > 0 ? { urgentBonus: bonus } : {}),
    durationHours: (end - start) / 3_600_000,
    netAmount: total - num(b.platform_fee) + bonus,
    paymentMethod: b.payment_method,
    paymentStatus: b.payment_status === PaymentStatus.ESCROW_HELD ? 'ESCROW_HELD' : 'UNPAID',
    matchingMode: 'JOB_BOARD',
    ...(invite
      ? {
          isDirectInvite: true,
          inviterName: givenName(b.customer_name),
          ...(invite.expiresAt ? { directInviteExpiresAt: new Date(invite.expiresAt).toISOString() } : {}),
        }
      : {}),
    status: 'MATCHING',
  };
}

export function toDirectInvitation(b: BoardBookingRow, expiresAt: Date, nowMs: number): DirectInvitation {
  const start = new Date(b.start_time).getTime();
  const exp = new Date(expiresAt).getTime();
  return {
    bookingId: b.id,
    code: b.booking_code,
    inviterName: givenName(b.customer_name),
    patientName: givenName(b.patient_name),
    patientAge: ageOn(b.patient_dob, vnDate(nowMs)),
    serviceName: b.service_name,
    date: vnDate(start),
    startTime: vnClock(start),
    endTime: vnClock(new Date(b.end_time).getTime()),
    district: '',
    totalAmount: num(b.total_amount),
    expiresAt: new Date(exp).toISOString(),
    expiresInSeconds: Math.max(0, Math.floor((exp - nowMs) / 1000)),
  };
}
