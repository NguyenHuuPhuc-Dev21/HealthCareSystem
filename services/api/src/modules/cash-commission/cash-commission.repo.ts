/**
 * SQL of cash-commission (BE-3 · Phase 5 · FR-PAY-02 cash part).
 */
import type { Queryable } from '../../core/database';
import { COMMISSION_SUSPENSION_REASON, type CommissionBookingRow, type CommissionPaymentRow, type DebtRow } from './cash-commission.types';

/** Completed cash shifts of this nurse that carry a commission deadline (set at check-out). */
export async function listDebts(db: Queryable, nurseId: string): Promise<DebtRow[]> {
  const { rows } = await db.query<DebtRow>(
    `SELECT b.id AS booking_id, b.booking_code, s.name AS service_name, b.total_amount, b.platform_fee,
            b.commission_due_at, c.paid_at
       FROM bookings b
       JOIN service_categories s ON s.id = b.service_id
       LEFT JOIN commission_payments c ON c.booking_id = b.id
      WHERE b.nurse_id = $1 AND b.payment_method = 'CASH' AND b.execution_status = 'COMPLETED'
        AND b.commission_due_at IS NOT NULL AND b.platform_fee > 0`,
    [nurseId],
  );
  return rows;
}

export async function lockBooking(db: Queryable, bookingId: string): Promise<CommissionBookingRow | null> {
  const { rows } = await db.query<CommissionBookingRow>(
    `SELECT id, booking_code, nurse_id, payment_method::text AS payment_method, execution_status::text AS execution_status,
            platform_fee, commission_due_at, settled_at
       FROM bookings WHERE id = $1 FOR UPDATE`,
    [bookingId],
  );
  return rows[0] ?? null;
}

const PAYMENT_COLUMNS = 'booking_id, nurse_id, amount, payment_code, provider_ref, paid_at';

export async function findPayment(db: Queryable, bookingId: string): Promise<CommissionPaymentRow | null> {
  const { rows } = await db.query<CommissionPaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM commission_payments WHERE booking_id = $1`, [bookingId]);
  return rows[0] ?? null;
}

export async function insertPayment(db: Queryable, p: { bookingId: string; nurseId: string; amount: number; code: string }): Promise<CommissionPaymentRow> {
  const { rows } = await db.query<CommissionPaymentRow>(
    `INSERT INTO commission_payments (booking_id, nurse_id, amount, payment_code) VALUES ($1, $2, $3, $4) RETURNING ${PAYMENT_COLUMNS}`,
    [p.bookingId, p.nurseId, p.amount, p.code],
  );
  return rows[0];
}

export async function codeExists(db: Queryable, code: string): Promise<boolean> {
  const { rows } = await db.query(`SELECT 1 FROM commission_payments WHERE payment_code = $1`, [code]);
  return rows.length > 0;
}

export async function lockPaymentByCode(db: Queryable, code: string): Promise<CommissionPaymentRow | null> {
  const { rows } = await db.query<CommissionPaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM commission_payments WHERE payment_code = $1 FOR UPDATE`, [code]);
  return rows[0] ?? null;
}

export async function markPaid(db: Queryable, bookingId: string, f: { providerRef: string; transactionId: string; at: Date }): Promise<void> {
  await db.query(`UPDATE commission_payments SET provider_ref = $2, transaction_id = $3, paid_at = $4 WHERE booking_id = $1`, [
    bookingId,
    f.providerRef,
    f.transactionId,
    f.at,
  ]);
  await db.query(`UPDATE bookings SET payment_status = 'SETTLED', settled_at = $2, updated_at = now() WHERE id = $1`, [bookingId, f.at]);
}

const OVERDUE = `
  b.payment_method = 'CASH' AND b.execution_status = 'COMPLETED' AND b.settled_at IS NULL
  AND b.commission_due_at IS NOT NULL AND b.commission_due_at <= $1 AND b.platform_fee > 0`;

/** ACTIVE nurses with an overdue commission → SUSPENDED (COMMISSION_OVERDUE). Returns who was suspended. */
export async function suspendOverdueNurses(db: Queryable, now: Date): Promise<string[]> {
  const { rows } = await db.query<{ user_id: string }>(
    `UPDATE nurse_profiles np
        SET profile_status = 'SUSPENDED', suspended_reason = $2, updated_at = now()
      WHERE np.profile_status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM bookings b WHERE b.nurse_id = np.user_id AND ${OVERDUE})
      RETURNING np.user_id`,
    [now, COMMISSION_SUSPENSION_REASON],
  );
  return rows.map((r) => r.user_id);
}

/** Back to ACTIVE once no overdue commission is left — only a suspension this module made. */
export async function reactivateIfCleared(db: Queryable, nurseId: string, now: Date): Promise<boolean> {
  const { rowCount } = await db.query(
    `UPDATE nurse_profiles np
        SET profile_status = 'ACTIVE', suspended_reason = NULL, updated_at = now()
      WHERE np.user_id = $2 AND np.profile_status = 'SUSPENDED' AND np.suspended_reason = $3
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.nurse_id = np.user_id AND ${OVERDUE})`,
    [now, nurseId, COMMISSION_SUSPENSION_REASON],
  );
  return (rowCount ?? 0) > 0;
}
