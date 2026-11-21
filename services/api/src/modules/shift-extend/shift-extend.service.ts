/**
 * shift-extend — extending a running shift in 1-hour steps (BE-1 / Dev A, Phase 4).
 * Traceability: FR-SHIFT-03 · BR-15 §2.3 · BR-13 · SRS §4.4 · SEC-05 (amounts are computed by the server only)
 *
 *  1. Customer: quote, then request (POST /bookings/:id/extend). The price of the extra hours is fixed now,
 *     with pricing-engine (BE-2) — same formula as the booking, the service priced per hour.
 *  2. Nurse: accept or decline (POST /bookings/:id/extend/respond). Accepting re-checks, under her row lock,
 *     that the extra time does not collide with her next shift (+ travel buffer).
 *       CASH          → in effect at once: end_time and amounts increased (paid in cash at check-out).
 *       BANK_TRANSFER → waits for the transfer (PAYMENT_TIMEOUT_MINUTES) to the extension's own payment code;
 *                       gateway-webhooks (BE-3) calls `confirmExtensionPayment`, which holds the money in escrow
 *                       and puts the extension in effect. A payment that can no longer be used is refunded 100%.
 *  Nurse first, money second: a declined extension never needs a refund.
 *
 * Every write runs under the booking row lock; one extension at a time per booking (unique index, migration 0013).
 */
import { ExecutionStatus, PaymentMethod, ServiceUnit, UserRole, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, notFound } from '../../core/errors';
import { holdEscrow, ledgerEntryExists, ledgerKeys, refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { vietQrImageUrl } from '../gateway-webhooks/gateway-webhooks.policy';
import { receivingAccountFromEnv } from '../gateway-webhooks/gateway-webhooks.service';
import { loadRates, quotePrice } from '../pricing-engine/pricing-engine.service';
import { toSnapshot } from '../pricing-engine/pricing-engine.policy';
import { extensionPaymentCode, hourlyRate, hoursToMs, nextShiftConflict, requestProblem, viewStatus } from './shift-extend.policy';
import * as repo from './shift-extend.repo';
import type { RespondBody } from './shift-extend.schema';
import type {
  ExtendBookingRow,
  ExtendQuote,
  ExtensionNotice,
  ExtensionPaymentOutcome,
  ExtensionRow,
  ExtensionView,
  PricingRates,
  ReceivingAccountLike,
} from './shift-extend.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MINUTE_MS = 60_000;

const REQUEST_MESSAGES = {
  BOOKING_NOT_IN_PROGRESS: 'Only a running shift can be extended',
  EXTENSION_WINDOW_CLOSED: 'An extension must be requested before the deadline ahead of the scheduled end',
  INVALID_EXTENSION_HOURS: 'Extensions are whole hours, within the allowed maximum',
} as const;

const notFoundBooking = () => notFound('BOOKING_NOT_FOUND', 'Booking not found');
const conflictError = () =>
  new AppError(409, 'NEXT_SHIFT_CONFLICT', 'The nurse has another shift right after this one; try fewer hours');

export interface ShiftExtendDeps {
  /** Pool, for read-only work. */
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  /** Surcharge rates; defaults to pricing-engine's loadRates (system_configs). */
  loadRates?: () => Promise<PricingRates>;
  /** Account customers transfer to (same as gateway-webhooks); null when not configured. */
  receivingAccount: () => ReceivingAccountLike | null;
  /** Optional until core/notifications exposes a shared service (same as booking-expiry, matching-radar). */
  notify?: (notice: ExtensionNotice) => Promise<void>;
  now?: () => number;
}

interface Viewer {
  id: string;
  role: UserRole;
}

export class ShiftExtendService {
  constructor(private readonly deps: ShiftExtendDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private async rules() {
    const [deadlineMinutes, maxHours, bufferMinutes, paymentMinutes] = await Promise.all([
      this.deps.getNumber('EXTENSION_REQUEST_DEADLINE_MINUTES'),
      this.deps.getNumber('MAX_EXTENSION_HOURS'),
      this.deps.getNumber('TRAVEL_BUFFER_MINUTES'),
      this.deps.getNumber('PAYMENT_TIMEOUT_MINUTES'),
    ]);
    return { deadlineMinutes, maxHours, bufferMinutes, paymentMinutes };
  }

  private assertRequestAllowed(b: ExtendBookingRow, hours: number, deadlineMinutes: number, maxHours: number): void {
    const problem = requestProblem(b.execution_status, hours, this.nowMs(), new Date(b.end_time).getTime(), deadlineMinutes, maxHours);
    if (!problem) return;
    const status = problem === 'INVALID_EXTENSION_HOURS' ? 400 : 409;
    const details =
      problem === 'EXTENSION_WINDOW_CLOSED'
        ? { deadline: new Date(new Date(b.end_time).getTime() - deadlineMinutes * MINUTE_MS).toISOString() }
        : problem === 'INVALID_EXTENSION_HOURS'
          ? { maxHours }
          : undefined;
    throw new AppError(status, problem, REQUEST_MESSAGES[problem], details);
  }

  /** Price of `hours` more after the current scheduled end. */
  private async price(db: Queryable, b: ExtendBookingRow, hours: number): Promise<ExtendQuote> {
    const start = new Date(b.end_time);
    const end = new Date(start.getTime() + hoursToMs(hours));
    const lengthHours = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / hoursToMs(1);
    const bookedHours = lengthHours - (await repo.appliedExtraHours(db, b.id));
    const rate = hourlyRate(b.service_unit, Number(b.service_base_price), bookedHours);
    const q = await quotePrice(
      db,
      {
        service: { unit: ServiceUnit.PER_HOUR, basePrice: rate },
        patient: { weightKg: b.weight_kg === null ? null : Number(b.weight_kg), mobilityStatus: b.mobility_status },
        start,
        end,
      },
      await (this.deps.loadRates ?? loadRates)(),
    );
    return { ...q, extraHours: hours, from: start.toISOString(), to: end.toISOString() };
  }

  private async assertNoNextShiftConflict(db: Queryable, b: ExtendBookingRow, hours: number, bufferMinutes: number) {
    const from = new Date(b.end_time);
    const to = new Date(from.getTime() + hoursToMs(hours));
    const busy = await repo.loadOtherBusy(db, b.nurse_id!, b.id, from, new Date(to.getTime() + bufferMinutes * MINUTE_MS));
    if (nextShiftConflict(busy, from.getTime(), to.getTime(), bufferMinutes)) throw conflictError();
  }

  /** POST /bookings/:id/extend/quote — what `hours` more would cost (nothing is stored). */
  async quote(customerId: string, bookingId: string, hours: number): Promise<ExtendQuote> {
    const b = await this.ownedBooking(this.deps.read, customerId, bookingId);
    const r = await this.rules();
    this.assertRequestAllowed(b, hours, r.deadlineMinutes, r.maxHours);
    return this.price(this.deps.read, b, hours);
  }

  /** POST /bookings/:id/extend — the customer asks; the nurse is notified. */
  async request(customerId: string, bookingId: string, hours: number): Promise<ExtensionView> {
    const r = await this.rules();
    const now = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const b = await this.ownedBooking(db, customerId, bookingId, true);
      await repo.expireStale(db, b.id, now);
      this.assertRequestAllowed(b, hours, r.deadlineMinutes, r.maxHours);
      if (await repo.hasOpenExtension(db, b.id)) {
        throw new AppError(409, 'EXTENSION_PENDING', 'Another extension of this shift is not finished yet');
      }
      await this.assertNoNextShiftConflict(db, b, hours, r.bufferMinutes);

      const q = await this.price(db, b, hours);
      const snap = toSnapshot(q);
      const bank = b.payment_method === PaymentMethod.BANK_TRANSFER;
      const seq = await repo.nextSequence(db, b.id);
      try {
        const ext = await repo.insertExtension(db, {
          bookingId: b.id,
          customerId,
          hours,
          amount: snap.totalAmount,
          baseAmount: snap.baseAmount,
          surchargeAmount: snap.surchargeAmount,
          platformFee: snap.platformFee,
          paymentCode: bank ? extensionPaymentCode(b.booking_code, seq) : null,
        });
        return { b, ext };
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          throw new AppError(409, 'EXTENSION_PENDING', 'Another extension of this shift is not finished yet');
        }
        throw err;
      }
    });
    await this.notify(out.b.nurse_id, out.b, 'Yêu cầu gia hạn ca', `Gia đình xin gia hạn thêm ${hours} giờ. Vui lòng đồng ý hoặc từ chối.`);
    return this.view(out.b, out.ext);
  }

  /** POST /bookings/:id/extend/respond — the assigned nurse accepts or declines. */
  async respond(nurseId: string, bookingId: string, body: RespondBody): Promise<ExtensionView> {
    if (body.bookingId && body.bookingId !== bookingId) {
      throw badRequest('BOOKING_ID_MISMATCH', 'bookingId in the body does not match the URL');
    }
    const r = await this.rules();
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const out = await this.deps.withTx(async (db) => {
      const b = UUID_RE.test(bookingId) ? await repo.lockBooking(db, bookingId) : null;
      if (!b) throw notFoundBooking();
      if (b.nurse_id !== nurseId) throw new AppError(403, 'NOT_ASSIGNED_NURSE', 'Only the nurse of this booking can answer');
      await repo.expireStale(db, b.id, now);
      const ext = await repo.lockExtension(db, b.id, body.extensionId);
      if (!ext) throw notFound('EXTENSION_NOT_FOUND', 'Extension request not found');
      if (ext.status !== 'REQUESTED') {
        throw new AppError(409, 'EXTENSION_NOT_PENDING', 'This extension request is no longer waiting for an answer', {
          status: viewStatus(ext.status, ext.applied_at),
        });
      }
      if (b.execution_status !== ExecutionStatus.IN_PROGRESS) {
        throw new AppError(409, 'BOOKING_NOT_IN_PROGRESS', REQUEST_MESSAGES.BOOKING_NOT_IN_PROGRESS);
      }

      if (!body.approved) {
        await repo.markRejected(db, ext.id, nurseId, body.declineReason ?? null, now);
        return { b, ext: (await repo.lockExtension(db, b.id, ext.id))!, approved: false };
      }

      await repo.lockNurse(db, nurseId);
      await this.assertNoNextShiftConflict(db, b, ext.extra_hours, r.bufferMinutes);
      if (b.payment_method === PaymentMethod.CASH) {
        await repo.markAccepted(db, ext.id, nurseId, now, { applied: true, paymentExpiresAt: null });
        await this.apply(db, b.id, ext);
      } else {
        await repo.markAccepted(db, ext.id, nurseId, now, {
          applied: false,
          paymentExpiresAt: new Date(nowMs + r.paymentMinutes * MINUTE_MS),
        });
      }
      return { b, ext: (await repo.lockExtension(db, b.id, ext.id))!, approved: true };
    });

    const bank = out.b.payment_method === PaymentMethod.BANK_TRANSFER;
    const body2 = !out.approved
      ? 'Điều dưỡng không thể gia hạn ca lần này.'
      : bank
        ? `Điều dưỡng đã đồng ý gia hạn ${out.ext.extra_hours} giờ. Vui lòng chuyển khoản trong ${r.paymentMinutes} phút để xác nhận.`
        : `Điều dưỡng đã đồng ý gia hạn ${out.ext.extra_hours} giờ. Phần phí thêm thanh toán bằng tiền mặt khi kết thúc ca.`;
    await this.notify(out.b.customer_id, out.b, `Gia hạn ca ${out.b.booking_code}`, body2);
    return this.view(out.b, out.ext);
  }

  /** GET /bookings/:id/extensions — the customer, the assigned nurse, or an Admin. */
  async list(viewer: Viewer, bookingId: string): Promise<ExtensionView[]> {
    const now = new Date(this.nowMs());
    return this.deps.withTx(async (db) => {
      const b = UUID_RE.test(bookingId) ? await repo.lockBooking(db, bookingId) : null;
      const allowed =
        b && (viewer.role === UserRole.ADMIN || b.customer_id === viewer.id || (viewer.role === UserRole.NURSE && b.nurse_id === viewer.id));
      if (!b || !allowed) throw notFoundBooking();
      await repo.expireStale(db, b.id, now);
      const rows = await repo.listExtensions(db, b.id);
      return rows.map((e) => this.view(b, e));
    });
  }

  /**
   * Dev / demo only (PAYMENT_SIMULATOR_ENABLED=true, never in production): pays the extension as if the gateway
   * had confirmed the exact transfer, through the same function the real webhook uses.
   */
  async simulatePayment(customerId: string, bookingId: string, extensionId: string): Promise<{ outcome: ExtensionPaymentOutcome }> {
    if (!UUID_RE.test(extensionId)) throw notFound('EXTENSION_NOT_FOUND', 'Extension request not found');
    const ext = await this.deps.withTx(async (db) => {
      await this.ownedBooking(db, customerId, bookingId);
      return repo.lockExtension(db, bookingId, extensionId);
    });
    if (!ext || !ext.payment_code) throw notFound('EXTENSION_NOT_FOUND', 'Extension request not found');
    const nowMs = this.nowMs();
    return this.deps.withTx(async (db) => ({
      outcome: await confirmExtensionPayment(
        db,
        { paymentCode: ext.payment_code!, amount: Number(ext.extra_amount), providerRef: `SIM-${ext.payment_code}-${nowMs}` },
        { nowMs, bufferMinutes: await this.deps.getNumber('TRAVEL_BUFFER_MINUTES') },
      ),
    }));
  }

  private async apply(db: Queryable, bookingId: string, ext: ExtensionRow): Promise<void> {
    try {
      await repo.applyToBooking(db, bookingId, ext);
    } catch (err) {
      if ((err as { code?: string }).code === '23P01') throw conflictError(); // ex_bookings_nurse_no_overlap
      throw err;
    }
  }

  private async ownedBooking(db: Queryable, customerId: string, bookingId: string, lock = false): Promise<ExtendBookingRow> {
    const b = UUID_RE.test(bookingId) ? await (lock ? repo.lockBooking(db, bookingId) : repo.findBooking(db, bookingId)) : null;
    if (!b || b.customer_id !== customerId) throw notFoundBooking(); // no existence leak
    return b;
  }

  private view(b: ExtendBookingRow, e: ExtensionRow): ExtensionView {
    const status = viewStatus(e.status, e.applied_at);
    const amount = Number(e.extra_amount);
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
    const acc = status === 'AWAITING_PAYMENT' && e.payment_code ? this.deps.receivingAccount() : null;
    return {
      id: e.id,
      hours: e.extra_hours,
      amount,
      paymentMethod: b.payment_method,
      status,
      createdAt: new Date(e.created_at).toISOString(),
      respondedAt: iso(e.responded_at),
      declineReason: e.decline_reason,
      paymentCode: e.payment_code,
      paymentExpiresAt: iso(e.payment_expires_at),
      bankTransfer: acc
        ? { bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName, transferContent: e.payment_code! }
        : null,
      qrImageUrl: acc ? vietQrImageUrl(acc, amount, e.payment_code!) : null,
      appliedAt: iso(e.applied_at),
    };
  }

  private async notify(userId: string | null, b: ExtendBookingRow, title: string, body: string): Promise<void> {
    if (!this.deps.notify || !userId) return;
    try {
      await this.deps.notify({ userId, bookingId: b.id, title, body });
    } catch (err) {
      console.warn(`[shift-extend] notification for ${b.id} failed: ${(err as Error).message}`);
    }
  }
}

/**
 * For gateway-webhooks (BE-3): a verified, successful transfer whose orderCode is an extension payment code
 * (`isExtensionPaymentCode`). Call it INSIDE the webhook transaction. Idempotent on `providerRef`.
 *
 *  EXTENSION_PAID         held in the customer's escrow, extension in effect (end_time and amounts increased)
 *  DUPLICATE              this reference was already booked — nothing happens
 *  UNKNOWN_EXTENSION      no extension has this code — nothing moves (Admin reconciles)
 *  AMOUNT_MISMATCH        amount ≠ the extension price — nothing moves (Admin reconciles, same rule as bookings)
 *  LATE_PAYMENT_REFUNDED  the extension can no longer be used (declined, expired, shift over, nurse now busy):
 *                         the money is held and refunded 100% in the same transaction
 */
export async function confirmExtensionPayment(
  db: Queryable,
  p: { paymentCode: string; amount: number; providerRef: string },
  opts: { nowMs: number; bufferMinutes: number },
): Promise<ExtensionPaymentOutcome> {
  const bookingId = await repo.findBookingIdByPaymentCode(db, p.paymentCode);
  if (!bookingId) return 'UNKNOWN_EXTENSION';
  const b = await repo.lockBooking(db, bookingId);
  if (!b) return 'UNKNOWN_EXTENSION';
  if (await ledgerEntryExists(db, ledgerKeys.hold(p.providerRef))) return 'DUPLICATE';

  const now = new Date(opts.nowMs);
  await repo.expireStale(db, b.id, now);
  const ext = await repo.lockExtensionByCode(db, p.paymentCode);
  if (!ext) return 'UNKNOWN_EXTENSION';
  if (p.amount !== Number(ext.extra_amount)) return 'AMOUNT_MISMATCH';

  const move = { customerId: b.customer_id, bookingId: b.id, amount: p.amount, externalRef: p.providerRef };
  await holdEscrow(db, { ...move, idempotencyKey: ledgerKeys.hold(p.providerRef) });

  let usable =
    ext.status === 'ACCEPTED' && ext.applied_at === null && b.execution_status === ExecutionStatus.IN_PROGRESS && b.nurse_id !== null;
  if (usable) {
    await repo.lockNurse(db, b.nurse_id!);
    const from = new Date(b.end_time).getTime();
    const to = from + hoursToMs(ext.extra_hours);
    const busy = await repo.loadOtherBusy(db, b.nurse_id!, b.id, new Date(from), new Date(to + opts.bufferMinutes * MINUTE_MS));
    usable = !nextShiftConflict(busy, from, to, opts.bufferMinutes);
  }
  if (usable) {
    await repo.applyToBooking(db, b.id, ext);
    await repo.markPaid(db, ext.id, p.providerRef, now);
    return 'EXTENSION_PAID';
  }

  await refundEscrow(db, { ...move, idempotencyKey: ledgerKeys.refundPayment(p.providerRef), externalRef: null });
  if (ext.status === 'ACCEPTED' && ext.applied_at === null) await repo.markExpired(db, ext.id, now);
  return 'LATE_PAYMENT_REFUNDED';
}

let singleton: ShiftExtendService | null = null;

export function getShiftExtendService(): ShiftExtendService {
  if (!singleton) {
    singleton = new ShiftExtendService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      getNumber: getConfigNumber,
      receivingAccount: () => receivingAccountFromEnv(),
    });
  }
  return singleton;
}
