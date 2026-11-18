/**
 * job-board — advance bookings (> 6 h) and direct requests. BE-3 · Phase 3 · FR-BOOK-03 Mechanism B · BR-08 §2.2.
 * Contract: docs/api/job-board.api.md
 *
 *  GET  /nurse/job-board                    open JOB_BOARD bookings this nurse may take right now:
 *                                           same gate as a claim (ACTIVE, no closure, Tier on the shift date,
 *                                           deposit rule incl. ADR-0004 grace → BANK_TRANSFER only) + free for the slot.
 *  GET  /nurse/job-board/:id                one of those, or the nurse's own direct request.
 *  POST /bookings/:id/accept                first accept wins — matching-radar claimBooking(…, 'JOB_BOARD').
 *  GET  /nurse/direct-invitation            the nurse's open direct request (15-minute window).
 *  POST /bookings/:id/accept-direct-invite  claimBooking(…, 'DIRECT_REQUEST') while the window is open.
 *  POST /bookings/:id/decline-direct-invite the request ends now.
 *  job  job-board.direct-request-sweep      windows that ended → the booking goes to the board, or to Radar if urgent.
 *
 * The 15-minute window starts when matching starts (migration 0010 trigger sets booking_offers.expires_at).
 */
import { ExecutionStatus, MatchingMode, type DirectInvitation, type JobItem, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import { checkNurseAvailability } from '../availability-engine/availability-engine.service';
import { routeMatchingMode } from '../matching-radar/matching-radar.policy';
import { getMatchingRadarService } from '../matching-radar/matching-radar.service';
import type { ClaimVia, DepositRule } from '../matching-radar/matching-radar.types';
import { eligibleFor, toDirectInvitation, toJobItem } from './job-board.policy';
import * as repo from './job-board.repo';
import type { BoardBookingRow, ClaimOk, SweepResult } from './job-board.types';

/** Operational guards (not business numbers). */
export const MAX_BOARD_SCAN = 300;
export const MAX_BOARD_ITEMS = 100;
export const SWEEP_BATCH_SIZE = 200;

export interface JobBoardDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  /** BE-2 matching-radar: the ONE claim transaction (locks, re-checks gate + availability, first accept wins). */
  claim(nurseId: string, bookingId: string, via: ClaimVia): Promise<{ bookingId: string; bookingCode: string }>;
  /** BE-2 matching-radar startRadar, after COMMIT, for an urgent booking whose direct request ended. */
  startRadar(bookingId: string, excludeNurseIds: string[]): Promise<void>;
  now?: () => number;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
}

export class JobBoardService {
  constructor(private readonly deps: JobBoardDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private cfg(key: SystemConfigKey): Promise<number> {
    return (this.deps.configNumber ?? getConfigNumber)(key);
  }

  private async depositRule(): Promise<DepositRule> {
    const [minDeposit, graceMaxShifts] = await Promise.all([this.cfg('MIN_NURSE_DEPOSIT'), this.cfg('DEPOSIT_GRACE_MAX_SHIFTS')]);
    return { minDeposit, graceMaxShifts };
  }

  /** Board rows this nurse may take now: hard gate, then availability-engine (60-minute buffer). */
  private async visible(nurseId: string, rows: BoardBookingRow[]): Promise<{ items: BoardBookingRow[]; nurse: Awaited<ReturnType<typeof repo.getNurseGate>> }> {
    const nurse = await repo.getNurseGate(this.deps.read, nurseId);
    if (!nurse) return { items: [], nurse };
    const nowMs = this.nowMs();
    const rule = await this.depositRule();
    const items: BoardBookingRow[] = [];
    for (const b of rows) {
      if (items.length >= MAX_BOARD_ITEMS) break;
      if (!eligibleFor(nurse, b, rule, nowMs)) continue;
      const free = await checkNurseAvailability(this.deps.read, nurseId, { start: new Date(b.start_time), end: new Date(b.end_time) });
      if (free.available) items.push(b);
    }
    return { items, nurse };
  }

  async listJobs(nurseId: string): Promise<JobItem[]> {
    const nowMs = this.nowMs();
    const rows = await repo.listBoardBookings(this.deps.read, new Date(nowMs), nurseId, MAX_BOARD_SCAN);
    const { items, nurse } = await this.visible(nurseId, rows);
    return nurse ? items.map((b) => toJobItem(b, nurse, nowMs)) : [];
  }

  async getJob(nurseId: string, bookingId: string): Promise<JobItem> {
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const invite = await repo.findOpenDirectOffer(this.deps.read, nurseId, now, bookingId);
    if (invite) {
      const [b, nurse] = await Promise.all([repo.getBooking(this.deps.read, bookingId), repo.getNurseGate(this.deps.read, nurseId)]);
      if (b && nurse) return toJobItem(b, nurse, nowMs, { expiresAt: invite.expires_at });
    }
    const row = await repo.findBoardBooking(this.deps.read, now, bookingId);
    const { items, nurse } = row && row.customer_id !== nurseId ? await this.visible(nurseId, [row]) : { items: [], nurse: null };
    if (items.length === 0 || !nurse) throw notFound('JOB_NOT_FOUND', 'Ca này không còn trên bảng việc hoặc bạn chưa đủ điều kiện nhận.');
    return toJobItem(items[0], nurse, nowMs);
  }

  /** POST /bookings/:id/accept — Job Board claim. Urgent bookings are claimed via Radar; an open direct request is exclusive. */
  async accept(nurseId: string, bookingId: string): Promise<ClaimOk> {
    const b = await repo.getBooking(this.deps.read, bookingId);
    if (b && b.execution_status === ExecutionStatus.MATCHING) {
      if (b.matching_mode !== MatchingMode.JOB_BOARD) {
        throw new AppError(409, 'NOT_ON_JOB_BOARD', 'Ca khẩn cấp được nhận qua Radar, không qua bảng việc.');
      }
      if (await repo.hasOpenDirectRequest(this.deps.read, bookingId)) {
        throw new AppError(409, 'DIRECT_REQUEST_PENDING', 'Khách đang chờ điều dưỡng được mời trả lời (tối đa 15 phút).');
      }
    }
    const r = await this.deps.claim(nurseId, bookingId, 'JOB_BOARD');
    return { success: true, booking_id: r.bookingId, bookingCode: r.bookingCode };
  }

  async getDirectInvitation(nurseId: string): Promise<DirectInvitation | null> {
    const nowMs = this.nowMs();
    const offer = await repo.findOpenDirectOffer(this.deps.read, nurseId, new Date(nowMs));
    if (!offer || !offer.expires_at) return null;
    const b = await repo.getBooking(this.deps.read, offer.booking_id);
    return b ? toDirectInvitation(b, offer.expires_at, nowMs) : null;
  }

  /** The window is checked strictly here (the sweep may close it up to a minute later). */
  async acceptDirectInvite(nurseId: string, bookingId: string): Promise<ClaimOk> {
    const offer = await repo.findOpenDirectOffer(this.deps.read, nurseId, new Date(this.nowMs()), bookingId);
    if (!offer) throw new AppError(403, 'NO_ACTIVE_OFFER', 'Lời mời nhận ca này đã hết hạn hoặc không dành cho bạn.');
    const r = await this.deps.claim(nurseId, bookingId, 'DIRECT_REQUEST');
    return { success: true, booking_id: r.bookingId, bookingCode: r.bookingCode };
  }

  async declineDirectInvite(nurseId: string, bookingId: string): Promise<{ success: true }> {
    const offer = await repo.findSentDirectOffer(this.deps.read, nurseId, bookingId);
    if (!offer) throw notFound('NO_DIRECT_INVITATION', 'Không có lời mời đang chờ cho ca này.');
    await this.releaseDirectRequest(offer.offer_id, offer.booking_id, offer.nurse_id, 'DECLINED');
    return { success: true };
  }

  /** Handler of the recurring `job-board.direct-request-sweep`. One failure never stops the others. */
  async runDirectRequestSweep(batchSize = SWEEP_BATCH_SIZE): Promise<SweepResult> {
    const ended = await repo.findEndedDirectOffers(this.deps.read, new Date(this.nowMs()), batchSize);
    const result: SweepResult = { expired: 0, toRadar: 0, failed: 0 };
    for (const o of ended) {
      try {
        const r = await this.releaseDirectRequest(o.offer_id, o.booking_id, o.nurse_id, 'EXPIRED');
        if (r.closed) result.expired += 1;
        if (r.radar) result.toRadar += 1;
      } catch (err) {
        result.failed += 1;
        console.error(`[job-board] direct request ${o.offer_id} could not be closed: ${(err as Error).message}`);
      }
    }
    return result;
  }

  /**
   * Ends a direct request (declined or window over). Under the booking lock: close the offer; if the booking still
   * needs a nurse, route it again — urgent (≤ URGENT_BOOKING_LEAD_HOURS) → Radar without the invited nurse,
   * otherwise it simply appears on the Job Board (BR-08 §2.2).
   */
  private async releaseDirectRequest(
    offerId: string,
    bookingId: string,
    invitedNurseId: string,
    status: 'DECLINED' | 'EXPIRED',
  ): Promise<{ closed: boolean; radar: boolean }> {
    const nowMs = this.nowMs();
    const lead = await this.cfg('URGENT_BOOKING_LEAD_HOURS');
    const out = await this.deps.withTx(async (db) => {
      const b = await repo.lockBookingForRouting(db, bookingId);
      const closed = await repo.closeDirectOffer(db, offerId, status, new Date(nowMs));
      if (!closed || !b || b.execution_status !== ExecutionStatus.MATCHING || b.nurse_id !== null) return { closed, radar: false };
      if (await repo.hasOpenDirectRequest(db, bookingId)) return { closed, radar: false };
      const mode = routeMatchingMode(new Date(b.start_time), nowMs, lead);
      if (mode !== b.matching_mode) await repo.setMatchingMode(db, bookingId, mode);
      return { closed, radar: mode === MatchingMode.RADAR_DISPATCH };
    });
    if (out.radar) await this.deps.startRadar(bookingId, [invitedNurseId]);
    return out;
  }
}

let singleton: JobBoardService | null = null;

export function getJobBoardService(): JobBoardService {
  if (!singleton) {
    singleton = new JobBoardService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      claim: (nurseId, bookingId, via) => getMatchingRadarService().claimBooking(nurseId, bookingId, via),
      startRadar: (bookingId, exclude) => getMatchingRadarService().startRadar(bookingId, exclude),
    });
  }
  return singleton;
}
