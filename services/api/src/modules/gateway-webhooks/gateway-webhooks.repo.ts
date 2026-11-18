/**
 * SQL for gateway-webhooks (ADR-0002). Writes expect a TRANSACTION client. BE-3 · Phase 3.
 * Ledger rows are written by gateway-webhooks.ledger.ts.
 */
import type { Queryable } from '../../core/database';
import type { PaymentBookingRow, WebhookOutcome } from './gateway-webhooks.types';

const SELECT = `
  SELECT id, booking_code, customer_id, payment_method, payment_status, execution_status, hold_expires_at, total_amount
    FROM bookings`;

/** Locks the booking: the webhook, the payment-timeout job and the expiry sweep run one at a time per booking. */
export async function lockBookingByCode(db: Queryable, code: string): Promise<PaymentBookingRow | null> {
  const { rows } = await db.query<PaymentBookingRow>(`${SELECT} WHERE booking_code = $1 FOR UPDATE`, [code]);
  return rows[0] ?? null;
}

export async function findOwnedBooking(db: Queryable, customerId: string, bookingId: string): Promise<PaymentBookingRow | null> {
  const { rows } = await db.query<PaymentBookingRow>(`${SELECT} WHERE id = $1 AND customer_id = $2`, [bookingId, customerId]);
  return rows[0] ?? null;
}

export async function setPaymentStatus(db: Queryable, bookingId: string, status: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = $2::payment_status_enum, updated_at = now() WHERE id = $1`, [bookingId, status]);
}

export async function insertWebhookEvent(
  db: Queryable,
  e: { providerRef: string; orderCode: string; bookingId: string | null; amount: number; outcome: WebhookOutcome; payload: unknown },
): Promise<void> {
  await db.query(
    `INSERT INTO payment_webhook_events (provider_ref, order_code, booking_id, amount, outcome, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [e.providerRef, e.orderCode, e.bookingId, e.amount, e.outcome, JSON.stringify(e.payload)],
  );
}
