/**
 * settlements — paying out the customer escrow. BE-3 · Phase 5 · FR-PAY-02 · BR-04 §2.1 · ADR-0004 D2.
 * Contract: docs/api/settlements.api.md
 *
 *  POST /bookings/:id/confirm-completion   (customer) settle now instead of waiting for the cooling window
 *  job  settlements.sweep (every 5 min)    shifts checked out ≥ SETTLEMENT_COOLING_HOURS ago with no dispute,
 *                                          and cancellation shares still PENDING (cancellation-policy rows 2–4)
 *  settleShift(db, id, 'DISPUTE_RELEASED') for disputes (Phase 6) when a dispute is resolved for the nurse
 *
 * One transaction under the booking lock (a dispute opened at the same moment either lands first and blocks, or
 * after and finds the booking SETTLED):
 *   customer escrow  ESCROW_RELEASE −gross
 *   nurse wallet     ESCROW_RELEASE +payout (available) · DEPOSIT_WITHHOLD +withheld (deposit, ADR-0004 D2)
 *   grace counter    deposit_grace_shifts_used + 1 when the shift was worked with a short deposit
 *   settlements row  gross = commission + net, net = withheld + payout · booking SETTLED
 */
import type { SystemConfigKey } from '@healthcare-system/shared';
import { TxType } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, forbidden } from '../../core/errors';
import { ledgerKeys, releaseEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { lockNurseWallet, postNurseEntry } from '../wallets-ledger/wallets-ledger.ledger';
import { cancellationGross, shiftSettleBlocker, splitSettlement } from './settlements.policy';
import * as repo from './settlements.repo';
import {
  SETTLEMENT_BATCH_SIZE,
  type ConfirmCompletionResult,
  type SettleBookingRow,
  type SettleOutcome,
  type SettlementKind,
  type SettlementSweepResult,
  type SettlementTrigger,
} from './settlements.types';

export type ConfigReader = (key: SystemConfigKey) => Promise<number>;

export class SettlementInconsistencyError extends Error {
  constructor(bookingId: string, held: number, due: number) {
    super(`Booking ${bookingId}: escrow holds ${held}, settlement needs ${due}`);
    this.name = 'SettlementInconsistencyError';
  }
}

export const settlementKeys = {
  payout: (bookingId: string) => `settle:${bookingId}:payout`,
  withhold: (bookingId: string) => `settle:${bookingId}:withhold`,
};

async function payOut(
  db: Queryable,
  b: SettleBookingRow,
  p: { kind: SettlementKind; trigger: SettlementTrigger; gross: number; commission: number; countsAsShift: boolean },
  nowMs: number,
  cfg: ConfigReader,
): Promise<SettleOutcome> {
  const held = await repo.escrowHeld(db, b.id, b.customer_id);
  if (held !== p.gross) throw new SettlementInconsistencyError(b.id, held, p.gross);

  const [minDeposit, withholdRate] = await Promise.all([cfg('MIN_NURSE_DEPOSIT'), cfg('DEPOSIT_WITHHOLD_RATE')]);
  const wallet = await lockNurseWallet(db, b.nurse_id!);
  const split = splitSettlement({
    gross: p.gross,
    commission: p.commission,
    depositBalance: Number(wallet.deposit_balance),
    minDeposit,
    withholdRate,
    countsAsShift: p.countsAsShift,
  });

  if (split.gross > 0) {
    await releaseEscrow(db, { customerId: b.customer_id, bookingId: b.id, amount: split.gross, idempotencyKey: ledgerKeys.release(b.id), externalRef: null });
  }
  if (split.payout > 0) {
    await postNurseEntry(db, { userId: b.nurse_id!, bookingId: b.id, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: split.payout, idempotencyKey: settlementKeys.payout(b.id), externalRef: null });
  }
  if (split.withheld > 0) {
    await postNurseEntry(db, { userId: b.nurse_id!, bookingId: b.id, txType: TxType.DEPOSIT_WITHHOLD, balance: 'DEPOSIT', delta: split.withheld, idempotencyKey: settlementKeys.withhold(b.id), externalRef: null });
  }
  if (split.graceShift) await repo.countGraceShift(db, wallet.id);
  const at = new Date(nowMs);
  await repo.insertSettlement(db, { bookingId: b.id, nurseId: b.nurse_id!, kind: p.kind, trigger: p.trigger, split, at });
  await repo.markBookingSettled(db, b.id, at);
  return { settled: true, split, kind: p.kind };
}

/** A worked bank-transfer shift. Runs in the caller's transaction; never settles twice (booking lock + settled_at). */
export async function settleShift(
  db: Queryable,
  bookingId: string,
  trigger: Exclude<SettlementTrigger, 'CANCELLATION_SHARE'>,
  nowMs: number,
  cfg: ConfigReader = getConfigNumber,
): Promise<SettleOutcome> {
  const b = await repo.lockBooking(db, bookingId);
  if (!b) return { settled: false, reason: 'NOT_FOUND' };
  if (await repo.hasCancellationOutcome(db, b.id)) return { settled: false, reason: b.settled_at ? 'ALREADY_SETTLED' : 'NOTHING_PENDING' };
  const blocker = shiftSettleBlocker(b, trigger, await cfg('SETTLEMENT_COOLING_HOURS'), nowMs);
  if (blocker) return { settled: false, reason: blocker };
  return payOut(db, b, { kind: 'SHIFT', trigger, gross: Number(b.total_amount), commission: Number(b.platform_fee), countsAsShift: true }, nowMs, cfg);
}

/**
 * Shares cancellation-policy kept in escrow (settlement_status PENDING). Rows 2–3 are paid at once; row 4
 * (stopped after check-in — hours actually worked) waits for the cooling window and no dispute, like a shift.
 */
export async function settleCancellationShare(db: Queryable, bookingId: string, nowMs: number, cfg: ConfigReader = getConfigNumber): Promise<SettleOutcome> {
  const b = await repo.lockBooking(db, bookingId);
  if (!b) return { settled: false, reason: 'NOT_FOUND' };
  const c = await repo.lockCancellationShare(db, bookingId);
  if (!c || c.settlement_status !== 'PENDING') return { settled: false, reason: 'NOTHING_PENDING' };
  if (b.settled_at) return { settled: false, reason: 'ALREADY_SETTLED' };
  if (!b.nurse_id) return { settled: false, reason: 'NO_NURSE' };
  const worked = c.scenario === 'CUSTOMER_STOP_AFTER_CHECKIN';
  if (worked) {
    if (b.dispute_status !== 'NONE') return { settled: false, reason: 'DISPUTE_OPEN' };
    if (!b.checkout_time) return { settled: false, reason: 'NOT_CHECKED_OUT' };
    const cooling = await cfg('SETTLEMENT_COOLING_HOURS');
    if (new Date(b.checkout_time).getTime() + cooling * 3_600_000 > nowMs) return { settled: false, reason: 'COOLING' };
  }
  const { gross, commission } = cancellationGross(c, await cfg('PLATFORM_COMMISSION_RATE'));
  const out = await payOut(db, b, { kind: 'CANCELLATION', trigger: 'CANCELLATION_SHARE', gross, commission, countsAsShift: worked }, nowMs, cfg);
  await repo.markCancellationDone(db, bookingId);
  return out;
}

export interface SettlementsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
  configNumber?: ConfigReader;
}

export class SettlementsService {
  constructor(private readonly deps: SettlementsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private get cfg(): ConfigReader {
    return this.deps.configNumber ?? getConfigNumber;
  }

  /** The customer confirms the shift is done: settle now (FR-PAY-02). Idempotent. */
  async confirmCompletion(customerId: string, bookingId: string): Promise<ConfirmCompletionResult> {
    if (!(await repo.isOwnedBy(this.deps.read, bookingId, customerId))) {
      throw forbidden('FORBIDDEN', 'You do not have access to this booking'); // no existence leak
    }
    const nowMs = this.nowMs();
    const r = await this.deps.withTx((db) => settleShift(db, bookingId, 'CUSTOMER_CONFIRMED', nowMs, this.cfg));
    if (!r.settled && r.reason !== 'ALREADY_SETTLED') {
      if (r.reason === 'NOT_TRANSFER_BOOKING') throw badRequest('NOT_TRANSFER_BOOKING', 'A cash booking is paid on site');
      if (r.reason === 'DISPUTE_OPEN') throw conflict('DISPUTE_OPEN', 'A dispute is open on this booking');
      if (r.reason === 'NOT_CHECKED_OUT' || r.reason === 'NOT_COMPLETED') {
        throw conflict('SHIFT_NOT_FINISHED', 'The nurse has not checked out yet');
      }
      throw new AppError(409, 'NOT_SETTLEABLE', 'This booking cannot be settled', { reason: r.reason });
    }
    const { rows } = await this.deps.read.query<{ booking_code: string; settled_at: Date }>(
      `SELECT booking_code, settled_at FROM bookings WHERE id = $1`,
      [bookingId],
    );
    return { bookingId, bookingCode: rows[0].booking_code, settled: true, settledAt: new Date(rows[0].settled_at).toISOString() };
  }

  /** For disputes (Phase 6): a dispute resolved for the nurse releases the frozen settlement. */
  async releaseAfterDispute(bookingId: string): Promise<SettleOutcome> {
    const nowMs = this.nowMs();
    return this.deps.withTx((db) => settleShift(db, bookingId, 'DISPUTE_RELEASED', nowMs, this.cfg));
  }

  /** Admin (admin-finance, Phase 7): the escrow was corrected / explained — the sweep may settle the booking again. */
  async resolveHold(adminId: string, bookingId: string, note: string): Promise<void> {
    if (note.trim().length < 10) throw badRequest('VALIDATION_ERROR', 'Explain how the escrow mismatch was resolved');
    if (!(await repo.resolveHold(this.deps.read, bookingId, adminId, note.trim()))) {
      throw new AppError(404, 'HOLD_NOT_FOUND', 'No open settlement hold for this booking');
    }
  }

  async runSweep(): Promise<SettlementSweepResult> {
    const nowMs = this.nowMs();
    const cooling = await this.cfg('SETTLEMENT_COOLING_HOURS');
    const out: SettlementSweepResult = { shifts: 0, cancellations: 0, skipped: 0, failed: 0 };
    const shifts = await repo.listDueShiftIds(this.deps.read, new Date(nowMs - cooling * 3_600_000), SETTLEMENT_BATCH_SIZE);
    const shares = await repo.listPendingCancellationIds(this.deps.read, SETTLEMENT_BATCH_SIZE);
    const run = async (id: string, fn: (db: Queryable) => Promise<SettleOutcome>, kind: 'shifts' | 'cancellations') => {
      try {
        const r = await this.deps.withTx(fn);
        if (r.settled) out[kind] += 1;
        else out.skipped += 1;
      } catch (err) {
        out.failed += 1;
        console.error(`[settlements] booking ${id} could not be settled:`, err);
        // A broken escrow alerts once, then waits for an Admin instead of blocking every later batch.
        if (err instanceof SettlementInconsistencyError) await repo.holdBooking(this.deps.read, id, err.message).catch(() => undefined);
      }
    };
    for (const id of shifts) await run(id, (db) => settleShift(db, id, 'COOLING_ELAPSED', nowMs, this.cfg), 'shifts');
    for (const id of shares) await run(id, (db) => settleCancellationShare(db, id, nowMs, this.cfg), 'cancellations');
    return out;
  }
}

let singleton: SettlementsService | null = null;

export function getSettlementsService(): SettlementsService {
  if (!singleton) {
    singleton = new SettlementsService({ read: { query }, withTx: (fn) => withTransaction((client) => fn(client)) });
  }
  return singleton;
}
