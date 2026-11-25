/**
 * gateway-webhooks — prepaid bank transfer → escrow → matching. BE-3 · Phase 3 · FR-PAY-01 · BR-04 §2.1 · SEC-5.3–5.6.
 * Contract: docs/api/gateway-webhooks.api.md
 *
 *  POST /payments/escrow-webhook   (gateway) HMAC-SHA256 verified, idempotent on the gateway reference.
 *      An orderCode `<booking code>-GH<n>` is a shift-extension payment: it goes to shift-extend's
 *      confirmExtensionPayment (BE-1) in the same transaction — escrow hold + extension in effect, or 100% refund.
 *      One transaction under the booking lock:
 *        ESCROW_HOLD in the customer's escrow → payment_status ESCROW_HELD → activateMatching (BE-2)
 *      and, after COMMIT, startRadar for urgent bookings. A payment that arrives after the 15-minute
 *      hold (or for an expired / already-paid booking) is held and refunded 100% in the same transaction.
 *  GET  /bookings/:id/payment-link (customer) VietQR + transfer details for the pending payment.
 *  POST /payments/dev/simulate-escrow (customer, dev only) signs and sends a fake successful webhook.
 *
 *      An orderCode "KQ…" is a nurse deposit top-up (ADR-0004): it goes to deposits' confirmTopup in the same
 *      transaction — TOPUP of at most the shortfall, the rest returned by the custody partner.
 *      An orderCode "HH…" is a cash-booking commission self-paid by the nurse: cash-commission's
 *      confirmCommissionPayment, same transaction — COMMISSION_PAYMENT (no balance moves), booking SETTLED.
 *      An orderCode `<booking code>-PT<n>` is a condition-mismatch surcharge (FR-SHIFT-02): shift-logs'
 *      confirmConditionSurchargePayment (BE-2), same transaction — escrow hold + surcharge in effect, or 100% refund.
 *
 * Escrow and deposit stay separate balances: this file books only escrow; the deposit is booked by deposits.
 */
import { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, forbidden } from '../../core/errors';
import { markExpired } from '../booking-expiry/booking-expiry.repo';
import { confirmCommissionPayment } from '../cash-commission/cash-commission.ledger';
import { isCommissionCode } from '../cash-commission/cash-commission.policy';
import { codeExists as commissionCodeExists } from '../cash-commission/cash-commission.repo';
import { confirmTopup } from '../deposits/deposits.ledger';
import { isDepositTopupCode } from '../deposits/deposits.policy';
import { topupCodeExists } from '../deposits/deposits.repo';
import { activateMatching, getMatchingRadarService } from '../matching-radar/matching-radar.service';
import { isExtensionPaymentCode } from '../shift-extend/shift-extend.policy';
import { findBookingIdByPaymentCode } from '../shift-extend/shift-extend.repo';
import { isConditionSurchargePaymentCode } from '../shift-logs/shift-logs.policy';
import { findBookingIdBySurchargeCode } from '../shift-logs/shift-logs.repo';
import { confirmConditionSurchargePayment } from '../shift-logs/shift-logs.service';
import { confirmExtensionPayment } from '../shift-extend/shift-extend.service';
import { holdEscrow, ledgerEntryExists, ledgerKeys, refundEscrow } from './gateway-webhooks.ledger';
import { decideWebhookAction, signData, verifySignature, vietQrImageUrl } from './gateway-webhooks.policy';
import * as repo from './gateway-webhooks.repo';
import { escrowWebhookSchema, type WebhookData } from './gateway-webhooks.schema';
import type { ExtensionPaymentResult, PaymentLinkDto, ReceivingAccount, WebhookOutcome, WebhookResult } from './gateway-webhooks.types';

type ExtensionPayment = { paymentCode: string; amount: number; providerRef: string };

/**
 * Default handler for `<code>-GH<n>` payments: shift-extend's confirmExtensionPayment (BE-1), run in the webhook's
 * transaction. The booking id is read first only to label the payment_webhook_events row.
 */
export async function defaultExtensionPayment(db: Queryable, p: ExtensionPayment, nowMs: number): Promise<ExtensionPaymentResult> {
  const bookingId = await findBookingIdByPaymentCode(db, p.paymentCode);
  const outcome = await confirmExtensionPayment(db, p, { nowMs, bufferMinutes: await getConfigNumber('TRAVEL_BUFFER_MINUTES') });
  return { outcome, bookingId };
}

export interface GatewayWebhooksDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  /** HMAC secret shared with the gateway (PAYMENT_GATEWAY_WEBHOOK_SECRET). */
  secret: () => string;
  /** Account customers transfer to (VietQR); null when not configured. */
  receivingAccount: () => ReceivingAccount | null;
  /** BE-2 matching-radar startRadar — called after COMMIT for urgent bookings. */
  startRadar: (bookingId: string) => Promise<void>;
  /** Shift-extension payments (`<code>-GH<n>`); defaults to defaultExtensionPayment. */
  confirmExtensionPayment?: (db: Queryable, p: ExtensionPayment, nowMs: number) => Promise<ExtensionPaymentResult>;
  now?: () => number;
}

export class GatewayWebhooksService {
  constructor(private readonly deps: GatewayWebhooksDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** POST /payments/escrow-webhook. Throws 400 (malformed) / 401 (bad signature); everything else answers 200. */
  async handleEscrowWebhook(body: unknown): Promise<WebhookResult> {
    const parsed = escrowWebhookSchema.safeParse(body);
    if (!parsed.success) throw badRequest('VALIDATION_ERROR', 'Webhook body is invalid', parsed.error.flatten());
    const { data, signature } = parsed.data;
    if (!verifySignature(data, signature, this.deps.secret())) {
      throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature'); // SEC-5.3: no state change
    }

    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    const result = await this.deps.withTx(async (db) => {
      const event = (outcome: WebhookOutcome, bookingId: string | null) =>
        repo
          .insertWebhookEvent(db, { providerRef: data.reference, orderCode: data.orderCode, bookingId, amount: data.amount, outcome, payload: parsed.data })
          .then(() => ({ outcome, bookingId, startRadar: false }));

      // "KQ…" AND a real top-up with that code: nurse deposit (ADR-0004), never a booking.
      if (isDepositTopupCode(data.orderCode) && (await topupCodeExists(db, data.orderCode))) {
        if (!parsed.data.success || parsed.data.code !== '00') return event('NOT_SUCCESS', null);
        const r = await confirmTopup(db, { paymentCode: data.orderCode, amount: data.amount, providerRef: data.reference }, nowMs);
        return event(r.outcome, null);
      }

      // "HH…" AND a real commission code: cash-booking commission (FR-PAY-02), never escrow.
      if (isCommissionCode(data.orderCode) && (await commissionCodeExists(db, data.orderCode))) {
        if (!parsed.data.success || parsed.data.code !== '00') return event('NOT_SUCCESS', null);
        const r = await confirmCommissionPayment(db, { paymentCode: data.orderCode, amount: data.amount, providerRef: data.reference }, nowMs);
        return event(r.outcome, r.bookingId);
      }

      // `<code>-GH<n>` AND a real extension with that code: a booking code that happens to end in -GH<digits>
      // (random suffix) still goes the booking way.
      if (isExtensionPaymentCode(data.orderCode) && (await findBookingIdByPaymentCode(db, data.orderCode)) !== null) {
        if (!parsed.data.success || parsed.data.code !== '00') return event('NOT_SUCCESS', null);
        const r = await (this.deps.confirmExtensionPayment ?? defaultExtensionPayment)(
          db,
          { paymentCode: data.orderCode, amount: data.amount, providerRef: data.reference },
          nowMs,
        );
        return event(r.outcome, r.bookingId);
      }

      // `<code>-PT<n>` AND a real condition surcharge with that code (BE-2 shift-logs): same rule as -GH<n>.
      if (isConditionSurchargePaymentCode(data.orderCode) && (await findBookingIdBySurchargeCode(db, data.orderCode)) !== null) {
        if (!parsed.data.success || parsed.data.code !== '00') return event('NOT_SUCCESS', null);
        const r = await confirmConditionSurchargePayment(
          db,
          { paymentCode: data.orderCode, amount: data.amount, providerRef: data.reference },
          nowMs,
        );
        return event(r.outcome, r.bookingId);
      }

      const b = await repo.lockBookingByCode(db, data.orderCode);
      if (!parsed.data.success || parsed.data.code !== '00') return event('NOT_SUCCESS', b?.id ?? null);
      if (!b) return event('UNKNOWN_BOOKING', null);
      if (await ledgerEntryExists(db, ledgerKeys.hold(data.reference))) return event('DUPLICATE', b.id);

      const move = { customerId: b.customer_id, bookingId: b.id, amount: data.amount, externalRef: data.reference };
      const action = decideWebhookAction(b, data.amount, nowMs);
      switch (action) {
        case 'AMOUNT_MISMATCH':
        case 'NOT_TRANSFER_BOOKING':
          return event(action, b.id); // nothing moves; Admin reconciles with the gateway (SEC-5.10)

        case 'HOLD': {
          await holdEscrow(db, { ...move, idempotencyKey: ledgerKeys.hold(data.reference) });
          await repo.setPaymentStatus(db, b.id, PaymentStatus.ESCROW_HELD);
          const started = await activateMatching(db, b.id, nowMs); // DRAFT → MATCHING (BE-2)
          const r = await event('HELD', b.id);
          return { ...r, startRadar: started.startRadar };
        }

        case 'LATE_REFUND':
        case 'EXTRA_REFUND': {
          // The money really arrived: book it, then give it back in full (exactly once per reference).
          await holdEscrow(db, { ...move, idempotencyKey: ledgerKeys.hold(data.reference) });
          await refundEscrow(db, { ...move, idempotencyKey: ledgerKeys.refundPayment(data.reference), externalRef: null });
          if (action === 'LATE_REFUND') {
            if (b.execution_status === ExecutionStatus.DRAFT) await markExpired(db, b.id, 'PAYMENT_TIMEOUT', now);
            await repo.setPaymentStatus(db, b.id, PaymentStatus.REFUNDED);
            return event('LATE_PAYMENT_REFUNDED', b.id);
          }
          return event('EXTRA_PAYMENT_REFUNDED', b.id);
        }
      }
    });

    if (result.startRadar && result.bookingId) await this.deps.startRadar(result.bookingId);
    return { received: true, outcome: result.outcome, bookingId: result.bookingId };
  }

  /** GET /bookings/:id/payment-link — only for the owner's bank-transfer booking still waiting for payment. */
  async getPaymentLink(customerId: string, bookingId: string): Promise<PaymentLinkDto> {
    const b = await repo.findOwnedBooking(this.deps.read, customerId, bookingId);
    if (!b) throw forbidden('FORBIDDEN', 'You do not have access to this booking'); // no existence leak
    if (b.payment_method !== PaymentMethod.BANK_TRANSFER) {
      throw badRequest('NOT_TRANSFER_BOOKING', 'This booking is paid in cash on site');
    }
    const holdEnd = b.hold_expires_at ? new Date(b.hold_expires_at).getTime() : 0;
    if (b.execution_status !== ExecutionStatus.DRAFT || b.payment_status !== PaymentStatus.UNPAID || holdEnd <= this.nowMs()) {
      throw new AppError(409, 'PAYMENT_NOT_PENDING', 'This booking is not waiting for payment', {
        executionStatus: b.execution_status,
        paymentStatus: b.payment_status,
      });
    }
    const amount = Number(b.total_amount);
    const acc = this.deps.receivingAccount();
    return {
      bookingId: b.id,
      bookingCode: b.booking_code,
      amount,
      checkoutUrl: null,
      qrImageUrl: vietQrImageUrl(acc, amount, b.booking_code),
      expiresAt: new Date(holdEnd).toISOString(),
      bankTransfer: acc
        ? { bankName: acc.bankName, accountNumber: acc.accountNumber, accountName: acc.accountName, transferContent: b.booking_code }
        : null,
    };
  }

  /**
   * Dev / demo only (PAYMENT_SIMULATOR_ENABLED=true, never in production): builds and signs the webhook the
   * sandbox gateway would send for a successful transfer of the exact amount, and runs the real handler.
   */
  async simulateEscrowPayment(customerId: string, bookingId: string): Promise<WebhookResult> {
    const b = await repo.findOwnedBooking(this.deps.read, customerId, bookingId);
    if (!b) throw forbidden('FORBIDDEN', 'You do not have access to this booking');
    const data: WebhookData = {
      orderCode: b.booking_code,
      amount: Number(b.total_amount),
      reference: `SIM-${b.booking_code}-${this.nowMs()}`,
      description: b.booking_code,
      transactionDateTime: new Date(this.nowMs()).toISOString(),
    };
    return this.handleEscrowWebhook({ code: '00', desc: 'success', success: true, data, signature: signData(data, this.deps.secret()) });
  }
}

/** Receiving account from env; null unless all four values are set. */
export function receivingAccountFromEnv(env: NodeJS.ProcessEnv = process.env): ReceivingAccount | null {
  const bankBin = env.PAYMENT_RECEIVING_BANK_BIN?.trim();
  const bankName = env.PAYMENT_RECEIVING_BANK_NAME?.trim();
  const accountNumber = env.PAYMENT_RECEIVING_ACCOUNT_NO?.trim();
  const accountName = env.PAYMENT_RECEIVING_ACCOUNT_NAME?.trim();
  return bankBin && bankName && accountNumber && accountName ? { bankBin, bankName, accountNumber, accountName } : null;
}

export function simulatorEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAYMENT_SIMULATOR_ENABLED === 'true' && env.NODE_ENV !== 'production';
}

let singleton: GatewayWebhooksService | null = null;

export function getGatewayWebhooksService(): GatewayWebhooksService {
  if (!singleton) {
    singleton = new GatewayWebhooksService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      secret: () => process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? '',
      receivingAccount: () => receivingAccountFromEnv(),
      startRadar: (bookingId) => getMatchingRadarService().startRadar(bookingId),
    });
  }
  return singleton;
}
