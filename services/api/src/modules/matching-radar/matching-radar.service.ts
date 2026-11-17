/**
 * matching-radar — Radar Dispatch for urgent bookings + the ONE claim transaction every matching path uses.
 * BE-2 · Phase 3 · FR-BOOK-03 · BR-06 · BR-08 · RTM TC-MATCH-01/02. Contract: docs/api/bookings.api.md
 *
 *  activateMatching(tx, bookingId)   DRAFT → MATCHING once payment is secured (CASH, or BANK_TRANSFER in ESCROW_HELD).
 *                                    Called by bookings (cash) and by BE-3's gateway webhook (after ESCROW_HELD).
 *  startRadar(bookingId)             after commit: schedules wave 1 on the shared job queue (no setTimeout).
 *  runWave(payload)                  wave 1: nurses within 5 km; wave 2 (+5 min): nurses within 10 km not offered yet.
 *                                    All Radar offers stop being claimable RADAR_WINDOW_MINUTES after the start.
 *  claimBooking(nurseId, id, via)    first accept wins: lock nurse row → lock booking row → re-validate
 *                                    ACTIVE, Tier (valid on the shift date), deposit, live offer, availability
 *                                    (60-min buffer) → CONFIRMED. Used by Radar here and by BE-3's Job Board / direct invite.
 *  redispatch(payload)               a booking that lost its nurse (tier-lifecycle) goes back to Radar or stays on the Job Board.
 *
 * Every number (radii, delays, window, deposit, urgent lead) comes from system_configs.
 */
import { ExecutionStatus, MatchingMode, PaymentMethod, PaymentStatus, type RadarJob } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError } from '../../core/errors';
import { jobs } from '../../core/jobs';
import { vnClock, vnDate } from '../availability-engine/availability-engine.policy';
import { checkNurseAvailability, findAvailableNurses } from '../availability-engine/availability-engine.service';
import type { RedispatchPayload } from '../tier-lifecycle/tier-lifecycle.types';
import { boundingBox, distanceKm, eligibilityBlocker, routeMatchingMode, waveRadiusKm } from './matching-radar.policy';
import * as repo from './matching-radar.repo';
import {
  RADAR_WAVE_JOB,
  type ClaimErrorCode,
  type ClaimVia,
  type DepositRule,
  type MatchingBookingRow,
  type RadarNotice,
  type RadarWavePayload,
  type WaveResult,
} from './matching-radar.types';

const MINUTE_MS = 60_000;

async function loadDepositRule(): Promise<DepositRule> {
  const [minDeposit, graceMaxShifts] = await Promise.all([
    getConfigNumber('MIN_NURSE_DEPOSIT'),
    getConfigNumber('DEPOSIT_GRACE_MAX_SHIFTS'),
  ]);
  return { minDeposit, graceMaxShifts };
}
/** Upper bound of nurses offered per wave (operational guard, not a business number). */
const MAX_CANDIDATES_PER_WAVE = 500;
/** Postgres exclusion_violation (ex_bookings_nurse_no_overlap). */
const EXCLUSION_VIOLATION = '23P01';

const CLAIM_ERRORS: Record<ClaimErrorCode, [number, string]> = {
  BOOKING_NOT_FOUND: [404, 'Không tìm thấy ca này.'],
  ALREADY_CLAIMED: [409, 'Ca này đã có điều dưỡng khác nhận.'],
  PAYMENT_NOT_SECURED: [409, 'Ca này chưa sẵn sàng để nhận.'],
  NO_ACTIVE_OFFER: [403, 'Lời mời nhận ca này đã hết hạn hoặc không dành cho bạn.'],
  NURSE_NOT_ACTIVE: [403, 'Hồ sơ của bạn chưa ở trạng thái hoạt động nên chưa thể nhận ca.'],
  ACCOUNT_CLOSING: [403, 'Bạn đã yêu cầu ngừng hợp tác nên không nhận ca mới.'],
  TIER_MISMATCH: [403, 'Ca này yêu cầu Tier 2 với giấy phép hành nghề còn hiệu lực.'],
  DEPOSIT_SHORTFALL: [403, 'Số dư ký quỹ chưa đủ để nhận ca này. Vui lòng nạp thêm.'],
  SCHEDULE_CONFLICT: [409, 'Bạn không rảnh trong khung giờ này (trùng lịch hoặc thiếu 60 phút di chuyển).'],
};

function claimError(code: ClaimErrorCode, details?: unknown): AppError {
  const [status, message] = CLAIM_ERRORS[code];
  return new AppError(status, code, message, details);
}

export interface MatchingRadarDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  scheduler: { scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown> };
  /** Optional until core/notifications exposes a shared service (see README). */
  notify?: (notice: RadarNotice) => Promise<void>;
  now?: () => number;
}

const num = (v: string | number | null): number => Number(v ?? 0);

function ageOn(dob: string | null, today: string): number {
  if (!dob) return 0;
  const age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  return today.slice(5) < dob.slice(5) ? age - 1 : age;
}

/** Vietnamese given name only ("Trần Văn Bình" → "Bình"): the full identity is shown after the claim. */
function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

/**
 * DRAFT → MATCHING. Run inside the caller's transaction, AFTER payment is secured.
 * Idempotent: a booking already in MATCHING is left as it is. Returns whether Radar must be started
 * (call `startRadar` after the transaction commits).
 */
export async function activateMatching(
  db: Queryable,
  bookingId: string,
  nowMs: number = Date.now(),
): Promise<{ matchingMode: MatchingMode; startRadar: boolean }> {
  const b = await repo.lockBooking(db, bookingId);
  if (!b) throw claimError('BOOKING_NOT_FOUND');
  if (b.execution_status === ExecutionStatus.MATCHING) return { matchingMode: b.matching_mode, startRadar: false };
  if (b.execution_status !== ExecutionStatus.DRAFT) {
    throw new AppError(409, 'BOOKING_NOT_DRAFT', `Booking is ${b.execution_status}; matching cannot start`);
  }
  if (b.payment_method === PaymentMethod.BANK_TRANSFER && b.payment_status !== PaymentStatus.ESCROW_HELD) {
    throw new AppError(409, 'PAYMENT_REQUIRED', 'Bank-transfer bookings start matching only after the payment is held in escrow');
  }
  // The route is decided when matching really starts: payment may come up to 15 minutes after creation.
  // A direct request to a chosen nurse is a Job Board mechanism (BR-08 §2.2): no Radar broadcast while it is open.
  const mode = (await repo.hasOpenDirectRequest(db, bookingId))
    ? MatchingMode.JOB_BOARD
    : routeMatchingMode(new Date(b.start_time), nowMs, await getConfigNumber('URGENT_BOOKING_LEAD_HOURS'));
  await repo.setMatching(db, bookingId, mode);
  return { matchingMode: mode, startRadar: mode === MatchingMode.RADAR_DISPATCH };
}

export class MatchingRadarService {
  constructor(private readonly deps: MatchingRadarDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** Schedules wave 1 now. Safe to call twice for one dispatch start (idempotency key). */
  async startRadar(bookingId: string, excludeNurseIds: string[] = []): Promise<void> {
    const startedAt = new Date(this.nowMs());
    const payload: RadarWavePayload = { bookingId, wave: 1, startedAt: startedAt.toISOString(), excludeNurseIds };
    await this.deps.scheduler.scheduleJob(RADAR_WAVE_JOB, payload, startedAt, `radar:${bookingId}:${startedAt.getTime()}:1`);
  }

  /** One Radar wave. No-op when the booking no longer needs a nurse. */
  async runWave(payload: RadarWavePayload): Promise<WaveResult> {
    const [initialKm, expandedKm, delayMin, windowMin, rule] = await Promise.all([
      getConfigNumber('RADAR_INITIAL_RADIUS_KM'),
      getConfigNumber('RADAR_EXPANDED_RADIUS_KM'),
      getConfigNumber('RADAR_EXPANSION_DELAY_MIN'),
      getConfigNumber('RADAR_WINDOW_MINUTES'),
      loadDepositRule(),
    ]);
    const radiusKm = waveRadiusKm(payload.wave, initialKm, expandedKm);
    const startedMs = Date.parse(payload.startedAt);
    const windowEnd = new Date(startedMs + windowMin * MINUTE_MS);
    const now = this.nowMs();

    const outcome = await this.deps.withTx(async (db) => {
      const b = await repo.lockBooking(db, payload.bookingId);
      if (
        !b ||
        b.execution_status !== ExecutionStatus.MATCHING ||
        b.nurse_id !== null ||
        b.matching_mode !== MatchingMode.RADAR_DISPATCH ||
        b.care_lat === null ||
        b.care_lng === null ||
        now >= windowEnd.getTime()
      ) {
        return null;
      }
      const care = { lat: Number(b.care_lat), lng: Number(b.care_lng) };
      const start = new Date(b.start_time);
      const end = new Date(b.end_time);

      const candidates = await repo.findRadarCandidates(db, {
        bookingId: b.id,
        customerId: b.customer_id,
        box: boundingBox(care.lat, care.lng, radiusKm),
        minDeposit: rule.minDeposit,
        excludeNurseIds: payload.excludeNurseIds ?? [],
        limit: MAX_CANDIDATES_PER_WAVE,
      });
      const inRange = candidates.filter((n) => {
        const km = distanceKm(n, care);
        return km !== null && km <= radiusKm && eligibilityBlocker(n, b, start, rule, now) === null;
      });
      // Same engine as nurse search: declared schedule − time-off − bookings ± 60-minute buffer.
      const offered = await findAvailableNurses(db, { nurseIds: inRange.map((n) => n.user_id), start, end });
      await repo.insertRadarOffers(db, b.id, offered, radiusKm, payload.wave, windowEnd);
      return { booking: b, offered };
    });

    if (!outcome) return { dispatched: false, offered: [], radiusKm };

    if (payload.wave === 1) {
      const next: RadarWavePayload = { ...payload, wave: 2 };
      await this.deps.scheduler.scheduleJob(
        RADAR_WAVE_JOB,
        next,
        new Date(startedMs + delayMin * MINUTE_MS),
        `radar:${payload.bookingId}:${startedMs}:2`,
      );
    }
    if (this.deps.notify) {
      for (const nurseId of outcome.offered) {
        try {
          await this.deps.notify({
            userId: nurseId,
            bookingId: payload.bookingId,
            title: 'Có ca khẩn cấp gần bạn',
            body: `${outcome.booking.service_name} · ${vnClock(new Date(outcome.booking.start_time).getTime())} ${vnDate(new Date(outcome.booking.start_time).getTime())}. Ai nhận trước được ca.`,
          });
        } catch (err) {
          console.warn(`[matching-radar] notification to ${nurseId} failed: ${(err as Error).message}`);
        }
      }
    }
    return { dispatched: true, offered: outcome.offered, radiusKm };
  }

  /** GET /nurse/radar — the nurse's current open Radar offer, or null. */
  async getRadarJob(nurseId: string): Promise<RadarJob | null> {
    const now = this.nowMs();
    const offer = await repo.findCurrentRadarOffer(this.deps.read, nurseId, new Date(now));
    if (!offer) return null;
    const b = await repo.getBooking(this.deps.read, offer.booking_id);
    if (!b) return null;
    const { rows } = await this.deps.read.query<{ current_lat: string | null; current_lng: string | null }>(
      `SELECT current_lat, current_lng FROM nurse_profiles WHERE user_id = $1`,
      [nurseId],
    );
    const km =
      rows[0] && b.care_lat !== null && b.care_lng !== null
        ? distanceKm(rows[0], { lat: Number(b.care_lat), lng: Number(b.care_lng) })
        : null;
    return toRadarJob(b, offer, km, now);
  }

  /**
   * First accept wins. One transaction; the nurse row is locked first, then the booking row
   * (same order as tier-lifecycle and nurse-availabilities, so no deadlocks).
   */
  async claimBooking(nurseId: string, bookingId: string, via: ClaimVia): Promise<{ bookingId: string; bookingCode: string }> {
    const now = this.nowMs();
    const rule = await loadDepositRule();
    let claimed: MatchingBookingRow;
    try {
      claimed = await this.deps.withTx(async (db) => {
        const nurse = await repo.lockNurse(db, nurseId);
        if (!nurse) throw claimError('NURSE_NOT_ACTIVE');
        const b = await repo.lockBooking(db, bookingId);
        if (!b) throw claimError('BOOKING_NOT_FOUND');
        if (b.execution_status !== ExecutionStatus.MATCHING || b.nurse_id !== null) throw claimError('ALREADY_CLAIMED');
        if (b.payment_method === PaymentMethod.BANK_TRANSFER && b.payment_status !== PaymentStatus.ESCROW_HELD) {
          throw claimError('PAYMENT_NOT_SECURED');
        }
        if (b.customer_id === nurseId) throw claimError('NO_ACTIVE_OFFER');

        const start = new Date(b.start_time);
        const blocker = eligibilityBlocker(nurse, b, start, rule, now);
        if (blocker) {
          throw claimError(
            blocker,
            blocker === 'DEPOSIT_SHORTFALL' ? { minDeposit: rule.minDeposit, paymentMethod: b.payment_method } : undefined,
          );
        }

        // Radar and direct requests are addressed to named nurses; the Job Board is open to every eligible nurse.
        if (via !== 'JOB_BOARD' && !(await repo.findLiveOffer(db, bookingId, nurseId, via, new Date(now)))) {
          throw claimError('NO_ACTIVE_OFFER');
        }
        const free = await checkNurseAvailability(db, nurseId, { start, end: new Date(b.end_time) });
        if (!free.available) throw claimError('SCHEDULE_CONFLICT', { reason: free.reason });

        await repo.confirmBooking(db, bookingId, nurseId);
        await repo.settleOffers(db, bookingId, nurseId, via, new Date(now));
        return b;
      });
    } catch (err) {
      if ((err as { code?: string }).code === EXCLUSION_VIOLATION) throw claimError('SCHEDULE_CONFLICT', { reason: 'BOOKING_CONFLICT' });
      throw err;
    }

    if (this.deps.notify) {
      try {
        await this.deps.notify({
          userId: claimed.customer_id,
          bookingId,
          title: `Đã có điều dưỡng nhận đơn ${claimed.booking_code}`,
          body: 'Bạn có thể xem thông tin điều dưỡng trong mục Đơn của tôi.',
        });
      } catch (err) {
        console.warn(`[matching-radar] notification to customer failed: ${(err as Error).message}`);
      }
    }
    return { bookingId, bookingCode: claimed.booking_code };
  }

  /** POST /bookings/:id/dismiss-radar — the nurse passes on this offer; it is not shown to her again. */
  async dismissRadar(nurseId: string, bookingId: string): Promise<{ dismissed: boolean }> {
    return { dismissed: await repo.declineOffer(this.deps.read, bookingId, nurseId, new Date(this.nowMs())) };
  }

  /**
   * Handler of `matching-radar.redispatch` (scheduled by tier-lifecycle when a nurse is taken off a booking).
   * Still MATCHING without a nurse → urgent bookings go (back) to Radar, later ones stay on the Job Board.
   */
  async redispatch(payload: RedispatchPayload): Promise<{ matchingMode: MatchingMode | null }> {
    const now = this.nowMs();
    const lead = await getConfigNumber('URGENT_BOOKING_LEAD_HOURS');
    const mode = await this.deps.withTx(async (db) => {
      const b = await repo.lockBooking(db, payload.bookingId);
      if (!b || b.execution_status !== ExecutionStatus.MATCHING || b.nurse_id !== null) return null;
      const next = routeMatchingMode(new Date(b.start_time), now, lead);
      if (next !== b.matching_mode) await repo.setMatchingMode(db, b.id, next);
      return next;
    });
    if (mode === MatchingMode.RADAR_DISPATCH) await this.startRadar(payload.bookingId, [payload.releasedNurseId]);
    return { matchingMode: mode };
  }
}

function toRadarJob(
  b: MatchingBookingRow,
  offer: { round_no: number; expires_at: Date },
  km: number | null,
  nowMs: number,
): RadarJob {
  const start = new Date(b.start_time).getTime();
  const end = new Date(b.end_time).getTime();
  const expires = new Date(offer.expires_at).getTime();
  const total = num(b.total_amount);
  const bonus = num(b.urgent_bonus_amount);
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
    matchingMode: 'RADAR_DISPATCH',
    status: 'MATCHING',
    wave: offer.round_no >= 2 ? 2 : 1,
    radarExpiresAt: new Date(expires).toISOString(),
    expiresInSeconds: Math.max(0, Math.floor((expires - nowMs) / 1000)),
    isUrgent: true,
  };
}

let singleton: MatchingRadarService | null = null;

export function getMatchingRadarService(): MatchingRadarService {
  if (!singleton) {
    singleton = new MatchingRadarService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      scheduler: jobs,
    });
  }
  return singleton;
}
