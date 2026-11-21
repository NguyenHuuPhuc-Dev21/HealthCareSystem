/**
 * availability-engine — the ONE place that answers "is this nurse free for this slot?".
 * BE-2 · Phase 2 · FR-SCHED-01 · BR-03 §2.5 · BR-14 §2.5.
 *
 * Callers (all must use these functions, never their own SQL on nurse_availabilities):
 *   - nurse-search (BE-3, Phase 2)          → findAvailableNurses(db, { nurseIds, start, end })
 *   - Radar / Job Board matching (Phase 3)  → findAvailableNurses(...)
 *   - accepting / assigning a booking       → assertNurseAvailable(tx, nurseId, slot)  (after locking the nurse row)
 *   - nurse-availabilities (BE-2)           → pure helpers for the "locked by a booking" check
 *
 * The engine checks ONLY time. ACTIVE status, deposit >= 300,000 VND, Tier and distance are the
 * caller's filters (search / matching), applied before or after this call.
 */
import { getConfigNumber } from '../../core/config';
import { AppError, badRequest } from '../../core/errors';
import type { Queryable } from '../../core/database';
import { addDays, checkSlot, effectiveIntervals, lookRange, vnDate } from './availability-engine.policy';
import { loadBusyBookings, loadScheduleRows } from './availability-engine.repo';
import type { AvailabilityCheck, EngineOptions, Interval, NurseSchedule, Slot } from './availability-engine.types';

/** Bounds that keep one call cheap. A shift is at most 24 h (BR-03 §2.1). */
export const MAX_SLOT_HOURS = 48;
export const MAX_NURSES_PER_CALL = 2000;
export const MAX_RANGE_DAYS = 62;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function bufferMinutes(opts?: EngineOptions): Promise<number> {
  return opts?.bufferMinutes ?? (await getConfigNumber('TRAVEL_BUFFER_MINUTES'));
}

function assertSlot(slot: Slot): void {
  const s = slot.start.getTime();
  const e = slot.end.getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
    throw badRequest('INVALID_SLOT', 'Slot end must be after slot start');
  }
  if (e - s > MAX_SLOT_HOURS * 3_600_000) {
    throw badRequest('INVALID_SLOT', `A slot cannot be longer than ${MAX_SLOT_HOURS} hours`);
  }
}

function assertNurseIds(ids: string[]): void {
  if (ids.length > MAX_NURSES_PER_CALL) throw badRequest('TOO_MANY_NURSES', `At most ${MAX_NURSES_PER_CALL} nurses per call`);
  if (ids.some((id) => !UUID_RE.test(id))) throw badRequest('INVALID_NURSE_ID', 'Nurse ids must be UUIDs');
}

/** Loads rows + busy bookings for every nurse, over the range the engine needs. */
async function loadSchedules(db: Queryable, nurseIds: string[], range: Interval): Promise<Map<string, NurseSchedule>> {
  const fromDate = addDays(vnDate(range.start), -1);
  const toDate = vnDate(range.end);
  const [rows, busy] = await Promise.all([
    loadScheduleRows(db, nurseIds, fromDate, toDate),
    loadBusyBookings(db, nurseIds, new Date(range.start), new Date(range.end)),
  ]);
  const out = new Map<string, NurseSchedule>();
  for (const id of nurseIds) out.set(id, { rows: rows.get(id) ?? [], busy: busy.get(id) ?? [] });
  return out;
}

/**
 * The candidates (in the order given) whose effective availability covers the whole slot.
 * Use it for search AND matching — same inputs, same answer.
 */
export async function findAvailableNurses(
  db: Queryable,
  params: { nurseIds: string[]; start: Date; end: Date },
  opts?: EngineOptions,
): Promise<string[]> {
  const slot = { start: params.start, end: params.end };
  assertSlot(slot);
  const ids = [...new Set(params.nurseIds)];
  assertNurseIds(ids);
  if (ids.length === 0) return [];
  const buffer = await bufferMinutes(opts);
  const schedules = await loadSchedules(db, ids, lookRange(slot, buffer));
  return ids.filter((id) => checkSlot(schedules.get(id)!, slot, buffer, opts?.ignoreBookingId).available);
}

/** One nurse, one slot, with the reason when unavailable. */
export async function checkNurseAvailability(
  db: Queryable,
  nurseId: string,
  slot: Slot,
  opts?: EngineOptions,
): Promise<AvailabilityCheck> {
  assertSlot(slot);
  assertNurseIds([nurseId]);
  const buffer = await bufferMinutes(opts);
  const schedules = await loadSchedules(db, [nurseId], lookRange(slot, buffer));
  return checkSlot(schedules.get(nurseId)!, slot, buffer, opts?.ignoreBookingId);
}

/**
 * Throws 409 NURSE_NOT_AVAILABLE (details.reason) when the nurse cannot take the slot.
 * Phase 3: call inside the accept/assign transaction AFTER `SELECT … FROM nurse_profiles … FOR UPDATE`
 * (nurse-availabilities locks the same row when the schedule changes).
 */
export async function assertNurseAvailable(db: Queryable, nurseId: string, slot: Slot, opts?: EngineOptions): Promise<void> {
  const r = await checkNurseAvailability(db, nurseId, slot, opts);
  if (!r.available) {
    throw new AppError(409, 'NURSE_NOT_AVAILABLE', 'The nurse is not available for this time slot', { reason: r.reason });
  }
}

/** Effective free intervals of one nurse between two instants (e.g. to show free hours on a profile). */
export async function getEffectiveAvailability(
  db: Queryable,
  nurseId: string,
  from: Date,
  to: Date,
  opts?: EngineOptions,
): Promise<{ start: Date; end: Date }[]> {
  if (!(to.getTime() > from.getTime())) throw badRequest('INVALID_RANGE', 'Range end must be after range start');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw badRequest('INVALID_RANGE', `A range cannot be longer than ${MAX_RANGE_DAYS} days`);
  }
  assertNurseIds([nurseId]);
  const buffer = await bufferMinutes(opts);
  const range = { start: from.getTime(), end: to.getTime() };
  const pad = Math.max(buffer * 60_000, 86_400_000);
  const schedules = await loadSchedules(db, [nurseId], { start: range.start - pad, end: range.end + pad });
  return effectiveIntervals(schedules.get(nurseId)!, range, buffer, opts?.ignoreBookingId).map((i) => ({
    start: new Date(i.start),
    end: new Date(i.end),
  }));
}
