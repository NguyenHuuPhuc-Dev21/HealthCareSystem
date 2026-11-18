/**
 * gateway-webhooks policy — PURE rules (no DB, no clock). BE-3 · Phase 3 · FR-PAY-01 · SEC-5.3.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';
import type { PaymentBookingRow, ReceivingAccount } from './gateway-webhooks.types';

/**
 * The string the gateway signs: every field of `data`, keys sorted A→Z, `key=value` joined by `&`
 * (null / undefined → empty string; objects as JSON). Same convention as PayOS.
 */
export function canonicalData(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      const text = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${text}`;
    })
    .join('&');
}

export function signData(data: Record<string, unknown>, secret: string): string {
  return createHmac('sha256', secret).update(canonicalData(data)).digest('hex');
}

/** Constant-time comparison; false for any malformed input. */
export function verifySignature(data: Record<string, unknown>, signature: string, secret: string): boolean {
  if (!secret) return false;
  const expected = Buffer.from(signData(data, secret), 'hex');
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export type WebhookAction = 'HOLD' | 'LATE_REFUND' | 'EXTRA_REFUND' | 'AMOUNT_MISMATCH' | 'NOT_TRANSFER_BOOKING';

/**
 * What to do with a successful, verified payment for this booking (checked under the booking lock):
 *  - the amount must equal the stored total (server-authoritative, SEC-5.2);
 *  - DRAFT + UNPAID inside the 15-minute hold → hold escrow and start matching;
 *  - hold passed or booking expired / cancelled → the money arrived too late: hold + refund 100%;
 *  - already paid (ESCROW_HELD / SETTLED / REFUNDED) under another reference → refund the extra payment.
 */
export function decideWebhookAction(b: PaymentBookingRow, amount: number, nowMs: number): WebhookAction {
  if (b.payment_method !== PaymentMethod.BANK_TRANSFER) return 'NOT_TRANSFER_BOOKING';
  if (amount !== Number(b.total_amount)) return 'AMOUNT_MISMATCH';
  if (b.payment_status !== PaymentStatus.UNPAID) return 'EXTRA_REFUND';
  const holdPassed = b.hold_expires_at !== null && new Date(b.hold_expires_at).getTime() <= nowMs;
  if (b.execution_status !== ExecutionStatus.DRAFT || holdPassed) return 'LATE_REFUND';
  return 'HOLD';
}

/**
 * VietQR "quick link" image with amount and transfer content pre-filled (napas VietQR standard).
 * null when the receiving account is not configured.
 */
export function vietQrImageUrl(acc: ReceivingAccount | null, amount: number, content: string): string | null {
  if (!acc) return null;
  const q = new URLSearchParams({ amount: String(amount), addInfo: content, accountName: acc.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(acc.bankBin)}-${encodeURIComponent(acc.accountNumber)}-compact2.png?${q.toString()}`;
}
