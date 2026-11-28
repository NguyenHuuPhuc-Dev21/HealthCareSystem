/**
 * booking-expiry — bookings that ran out of time. BE-3 · Phase 3 · FR-BOOK-01/03 · BR-04 §2.1 · BR-08 §2.5.
 *
 *  1. Unpaid bank transfer: DRAFT + UNPAID past the 15-minute hold → EXPIRED.
 *     Triggered by `booking-expiry.payment-timeout` (scheduled by bookings at hold_expires_at) and by the sweep.
 *  2. Unmatched: MATCHING without a nurse at UNMATCHED_EXPIRY_LEAD_MINUTES (30) before the start — or, for an
 *     urgent Radar booking, URGENT_UNMATCHED_EXPIRY_MINUTES (30) after matching started → EXPIRED, and
 *     a prepaid (ESCROW_HELD) booking is refunded 100% in the SAME transaction (SRS §5.2, SEC-5.6).
 *
 * Every booking is handled in its own transaction under the booking row lock, re-checked with the exact
 * policy, so the webhook, a claim and the sweep can never both win. Re-running is harmless (idempotent ledger keys).
 */
import { getConfigNumber } from '../../core/config';
import { withTransaction, type Queryable } from '../../core/database';
import type { SystemConfigKey } from '@healthcare-system/shared';
import { ledgerKeys, refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { expiryReason, refundDue } from './booking-expiry.policy';
import * as repo from './booking-expiry.repo';
import { bookingExpired } from '../notifications/notifications.notices';
import { notifyUser } from '../notifications/notifications.service';
import type { ExpiryNotice, ExpiryResult, ExpiryRule, SweepResult } from './booking-expiry.types';

/** Operational guard: bookings handled per sweep run (the next run, a minute later, takes the rest). */
export const SWEEP_BATCH_SIZE = 200;

export interface BookingExpiryDeps {
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
  /** Optional until core/notifications exposes a shared service (same as matching-radar). */
  notify?: (notice: ExpiryNotice) => Promise<void>;
}

export class BookingExpiryService {
  constructor(private readonly deps: BookingExpiryDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private async rule(): Promise<ExpiryRule> {
    const cfg = this.deps.configNumber ?? getConfigNumber;
    const [unmatchedLeadMinutes, urgentUnmatchedMinutes] = await Promise.all([
      cfg('UNMATCHED_EXPIRY_LEAD_MINUTES'),
      cfg('URGENT_UNMATCHED_EXPIRY_MINUTES'),
    ]);
    return { unmatchedLeadMinutes, urgentUnmatchedMinutes };
  }

  /** Expires one booking if (and only if) it is due right now. Safe to call any number of times. */
  async expireIfDue(bookingId: string, rule?: ExpiryRule): Promise<ExpiryResult> {
    const r = rule ?? (await this.rule());
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const out = await this.deps.withTx(async (db) => {
      const b = await repo.lockBooking(db, bookingId);
      if (!b) return null;
      const reason = expiryReason(b, r, nowMs);
      if (!reason) return null;
      await repo.markExpired(db, b.id, reason, now);
      let refunded = false;
      if (refundDue(b)) {
        refunded = await refundEscrow(db, {
          customerId: b.customer_id,
          bookingId: b.id,
          amount: Number(b.total_amount),
          idempotencyKey: ledgerKeys.refundUnmatched(b.id),
          externalRef: null, // simulated escrow: the sandbox refund reference is added when a real partner exists
        });
        await repo.setRefunded(db, b.id);
      }
      return { booking: b, reason, refunded };
    });
    if (!out) return { expired: false, reason: null, refunded: false };

    await this.notifyCustomer(out.booking.customer_id, out.booking.id, out.booking.booking_code, out.reason, out.refunded);
    return { expired: true, reason: out.reason, refunded: out.refunded };
  }

  /** Handler of `booking-expiry.payment-timeout` { bookingId } (scheduled by bookings, key payment-timeout:<id>). */
  async handlePaymentTimeout(payload: { bookingId: string }): Promise<ExpiryResult> {
    return this.expireIfDue(payload.bookingId);
  }

  /** Handler of the recurring `booking-expiry.sweep`: one failing booking never stops the others. */
  async runSweep(batchSize = SWEEP_BATCH_SIZE): Promise<SweepResult> {
    const r = await this.rule();
    const ids = await this.deps.withTx((db) =>
      repo.findExpiryCandidates(db, { now: new Date(this.nowMs()), ...r, limit: batchSize }),
    );
    const result: SweepResult = { paymentTimeouts: 0, unmatched: 0, refunded: 0, failed: 0 };
    for (const id of ids) {
      try {
        const e = await this.expireIfDue(id, r);
        if (e.reason === 'PAYMENT_TIMEOUT') result.paymentTimeouts += 1;
        if (e.reason === 'UNMATCHED') result.unmatched += 1;
        if (e.refunded) result.refunded += 1;
      } catch (err) {
        result.failed += 1;
        console.error(`[booking-expiry] booking ${id} could not be expired: ${(err as Error).message}`);
      }
    }
    return result;
  }

  private async notifyCustomer(userId: string, bookingId: string, code: string, reason: string, refunded: boolean) {
    if (!this.deps.notify) return;
    const body =
      reason === 'PAYMENT_TIMEOUT'
        ? 'Đơn đã hết hạn vì chưa thanh toán trong 15 phút. Bạn có thể đặt lại.'
        : refunded
          ? 'Chưa tìm được điều dưỡng cho đơn này. Số tiền đã thanh toán được hoàn lại 100%.'
          : 'Chưa tìm được điều dưỡng cho đơn này. Bạn có thể đặt lại khung giờ khác.';
    try {
      await this.deps.notify({ userId, bookingId, title: `Đơn ${code} đã hết hạn`, body });
    } catch (err) {
      console.warn(`[booking-expiry] notification for ${bookingId} failed: ${(err as Error).message}`);
    }
  }
}

let singleton: BookingExpiryService | null = null;

export function getBookingExpiryService(): BookingExpiryService {
  if (!singleton) {
    singleton = new BookingExpiryService({
      withTx: (fn) => withTransaction((client) => fn(client)),
      notify: (n) => notifyUser(bookingExpired(n)), // Phase 6 · notifications
    });
  }
  return singleton;
}
