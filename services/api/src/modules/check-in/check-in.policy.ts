/**
 * check-in — pure rules (BE-2 · Phase 4 · FR-SHIFT-01). Every threshold comes from system_configs (passed in).
 */
import { ExecutionStatus, haversineDistanceMeters } from '@healthcare-system/shared';
import type { CheckInProblem, SelfieProblem, SelfieUploadRow } from './check-in.types';

const MINUTE_MS = 60_000;

/** Check-in is possible from start − opensBeforeMinutes until the scheduled end. */
export function checkInOpensAt(startMs: number, opensBeforeMinutes: number): number {
  return startMs - opensBeforeMinutes * MINUTE_MS;
}

export function checkInProblem(
  b: { nurseId: string | null; executionStatus: string; startMs: number; endMs: number },
  nurseId: string,
  nowMs: number,
  opensBeforeMinutes: number,
): CheckInProblem | null {
  if (b.nurseId !== nurseId) return 'NOT_ASSIGNED_NURSE';
  if (b.executionStatus === ExecutionStatus.IN_PROGRESS || b.executionStatus === ExecutionStatus.COMPLETED) return 'ALREADY_CHECKED_IN';
  if (b.executionStatus !== ExecutionStatus.CONFIRMED) return 'BOOKING_NOT_CONFIRMED';
  if (nowMs < checkInOpensAt(b.startMs, opensBeforeMinutes)) return 'TOO_EARLY_TO_CHECK_IN';
  if (nowMs >= b.endMs) return 'SHIFT_ALREADY_ENDED';
  return null;
}

/** Distance (m, 0.1 m precision) between the device and the care address (Haversine, FR-SHIFT-01). */
export function distanceToCare(device: { lat: number; lng: number }, care: { lat: number; lng: number }): number {
  return Math.round(haversineDistanceMeters(device.lat, device.lng, care.lat, care.lng) * 10) / 10;
}

export function withinRadius(distanceM: number, maxRadiusM: number): boolean {
  return distanceM <= maxRadiusM;
}

/**
 * The selfie must come from a URL issued for THIS booking to THIS nurse at most maxAgeMinutes ago and never used:
 * a photo taken earlier (gallery, another shift) cannot be replayed.
 */
export function selfieProblem(
  u: SelfieUploadRow | null,
  p: { bookingId: string; nurseId: string; nowMs: number; maxAgeMinutes: number },
): SelfieProblem | null {
  if (!u || u.booking_id !== p.bookingId || u.nurse_id !== p.nurseId) return 'SELFIE_NOT_ISSUED';
  if (u.used_at) return 'SELFIE_ALREADY_USED';
  if (new Date(u.issued_at).getTime() + p.maxAgeMinutes * MINUTE_MS < p.nowMs) return 'SELFIE_EXPIRED';
  return null;
}
