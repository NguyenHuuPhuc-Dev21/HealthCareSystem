/**
 * Pure rules of disputes (BE-3 · Phase 6 · FR-DISP-01). No I/O.
 */
import type { DisputeBookingRow, DisputeRow } from './disputes.types';

export type OpenError = 'NOT_A_PARTY' | 'NOT_DISPUTABLE' | 'DISPUTE_WINDOW_CLOSED' | 'DISPUTE_EXISTS';

/**
 * FR-DISP-01: the customer or the nurse of the booking, while the shift runs (IN_PROGRESS) or within
 * `windowHours` (= SETTLEMENT_COOLING_HOURS, the settlement clock) after check-out; one dispute per booking.
 */
export function openError(b: DisputeBookingRow, actorId: string, windowHours: number, nowMs: number): OpenError | null {
  if (actorId !== b.customer_id && actorId !== b.nurse_id) return 'NOT_A_PARTY';
  if (b.dispute_status !== 'NONE') return 'DISPUTE_EXISTS';
  if (b.settled_at) return 'DISPUTE_WINDOW_CLOSED';
  if (b.execution_status === 'IN_PROGRESS') return null;
  if (b.execution_status !== 'COMPLETED') return 'NOT_DISPUTABLE';
  if (!b.checkout_time) return null; // completed without a check-out record: still inside the shift's window
  return new Date(b.checkout_time).getTime() + windowHours * 3_600_000 >= nowMs ? null : 'DISPUTE_WINDOW_CLOSED';
}

/** The other side of the booking: the nurse when the customer opened it, and the reverse. */
export function counterPartyOf(d: Pick<DisputeRow, 'customer_id' | 'nurse_id' | 'raised_by_id'>): string | null {
  return d.raised_by_id === d.customer_id ? d.nurse_id : d.customer_id;
}

export function isParty(d: Pick<DisputeRow, 'customer_id' | 'nurse_id' | 'raised_by_id'>, userId: string): boolean {
  return userId === d.customer_id || userId === d.nurse_id || userId === d.raised_by_id;
}

export type RebuttalError = 'NOT_COUNTER_PARTY' | 'NOT_OPEN' | 'REBUTTAL_WINDOW_CLOSED' | 'ALREADY_SUBMITTED';

export function rebuttalError(d: DisputeRow, actorId: string, nowMs: number): RebuttalError | null {
  if (counterPartyOf(d) !== actorId) return 'NOT_COUNTER_PARTY';
  if (d.rebuttal_at) return 'ALREADY_SUBMITTED';
  if (d.status !== 'OPEN') return 'NOT_OPEN';
  if (d.rebuttal_due_at && new Date(d.rebuttal_due_at).getTime() < nowMs) return 'REBUTTAL_WINDOW_CLOSED';
  return null;
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Content type from the file name, among what core/storage accepts; null otherwise. */
export function contentTypeOf(fileName: string): string | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? null;
}
