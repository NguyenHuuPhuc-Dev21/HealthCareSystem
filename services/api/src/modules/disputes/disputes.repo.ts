/**
 * SQL of disputes (BE-3 · Phase 6 · FR-DISP-01/02).
 */
import type { Queryable } from '../../core/database';
import type { DisputeBookingRow, DisputeRow, Resolution } from './disputes.types';

export async function lockBooking(db: Queryable, bookingId: string): Promise<DisputeBookingRow | null> {
  const { rows } = await db.query<DisputeBookingRow>(
    `SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.payment_method::text AS payment_method,
            b.payment_status::text AS payment_status, b.execution_status::text AS execution_status,
            b.dispute_status::text AS dispute_status, b.settled_at, l.checkout_time
       FROM bookings b LEFT JOIN shift_logs l ON l.booking_id = b.id
      WHERE b.id = $1
      FOR UPDATE OF b`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function insertDispute(
  db: Queryable,
  d: { bookingId: string; raisedBy: string; category: string | null; description: string; evidence: string[]; rebuttalDueAt: Date; at: Date },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO disputes (booking_id, raised_by_id, reason_code, description, evidence_urls, rebuttal_due_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7) RETURNING id`,
    [d.bookingId, d.raisedBy, d.category, d.description, JSON.stringify(d.evidence), d.rebuttalDueAt, d.at],
  );
  return rows[0].id;
}

export async function setBookingDisputeStatus(db: Queryable, bookingId: string, status: string): Promise<void> {
  await db.query(`UPDATE bookings SET dispute_status = $2::booking_dispute_status_enum, updated_at = now() WHERE id = $1`, [bookingId, status]);
}

const SELECT = `
  SELECT d.id, d.booking_id, b.booking_code, b.customer_id, b.nurse_id, d.raised_by_id, ru.role::text AS raised_by_role,
         d.reason_code, d.description, d.evidence_urls, d.status::text AS status, d.refund_amount, d.release_amount,
         d.resolution_note, d.resolved_at, d.rebuttal_text, d.rebuttal_evidence_urls, bu.role::text AS rebuttal_by_role,
         d.rebuttal_at, d.rebuttal_due_at, d.trust_score_delta, d.deposit_deducted, d.created_at, d.updated_at,
         a.transaction_id AS appealed_transaction_id, t.amount AS penalty_amount, pd.reason::text AS penalty_reason,
         pd.sla_rule_ref
    FROM disputes d
    JOIN bookings b ON b.id = d.booking_id
    JOIN users ru ON ru.id = d.raised_by_id
    LEFT JOIN users bu ON bu.id = d.rebuttal_by
    LEFT JOIN deposit_penalty_appeals a ON a.dispute_id = d.id
    LEFT JOIN wallet_transactions t ON t.id = a.transaction_id
    LEFT JOIN deposit_penalty_details pd ON pd.transaction_id = a.transaction_id`;

export async function findDispute(db: Queryable, id: string): Promise<DisputeRow | null> {
  const { rows } = await db.query<DisputeRow>(`${SELECT} WHERE d.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function lockDispute(db: Queryable, id: string): Promise<DisputeRow | null> {
  const { rows } = await db.query<DisputeRow>(`${SELECT} WHERE d.id = $1 FOR UPDATE OF d`, [id]);
  return rows[0] ?? null;
}

/** Every dispute the nurse is part of: on her bookings, or opened by her (incl. penalty appeals). */
export async function listForNurse(db: Queryable, nurseId: string, limit: number): Promise<DisputeRow[]> {
  const { rows } = await db.query<DisputeRow>(
    `${SELECT} WHERE b.nurse_id = $1 OR d.raised_by_id = $1 ORDER BY d.created_at DESC, d.id DESC LIMIT $2`,
    [nurseId, limit],
  );
  return rows;
}

export async function listForCustomer(db: Queryable, customerId: string, limit: number): Promise<DisputeRow[]> {
  const { rows } = await db.query<DisputeRow>(
    `${SELECT} WHERE b.customer_id = $1 AND d.reason_code IS DISTINCT FROM 'PENALTY_APPEAL'
      ORDER BY d.created_at DESC, d.id DESC LIMIT $2`,
    [customerId, limit],
  );
  return rows;
}

/** Admin queue: open first (oldest first), then the latest resolved. */
export async function listForAdmin(db: Queryable, status: string | null, limit: number): Promise<DisputeRow[]> {
  const { rows } = await db.query<DisputeRow>(
    `${SELECT} WHERE ($1::text IS NULL OR d.status::text = $1)
      ORDER BY (d.status IN ('OPEN', 'UNDER_REVIEW')) DESC,
               CASE WHEN d.status IN ('OPEN', 'UNDER_REVIEW') THEN d.created_at END ASC,
               d.resolved_at DESC NULLS LAST
      LIMIT $2`,
    [status, limit],
  );
  return rows;
}

export async function saveRebuttal(db: Queryable, id: string, r: { by: string; text: string; evidence: string[]; at: Date }): Promise<void> {
  await db.query(
    `UPDATE disputes
        SET rebuttal_text = $3, rebuttal_evidence_urls = $4::jsonb, rebuttal_by = $2, rebuttal_at = $5,
            status = 'UNDER_REVIEW', updated_at = $5
      WHERE id = $1`,
    [id, r.by, r.text, JSON.stringify(r.evidence), r.at],
  );
}

export async function saveResolution(
  db: Queryable,
  id: string,
  r: { outcome: Resolution; by: string; note: string; refund: number | null; release: number | null; trustDelta: number | null; deposit: number | null; at: Date },
): Promise<void> {
  await db.query(
    `UPDATE disputes
        SET status = $2::dispute_status_enum, resolved_by = $3, resolution_note = $4, refund_amount = $5,
            release_amount = $6, trust_score_delta = $7, deposit_deducted = $8, resolved_at = $9, updated_at = $9
      WHERE id = $1`,
    [id, r.outcome, r.by, r.note, r.refund, r.release, r.trustDelta, r.deposit, r.at],
  );
}

/** What the customer escrow still holds for this booking (holds − refunds − releases). */
export async function escrowHeld(db: Queryable, bookingId: string, customerId: string): Promise<number> {
  const { rows } = await db.query<{ held: string }>(
    `SELECT COALESCE(sum(t.balance_after - t.balance_before), 0)::text AS held
       FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
      WHERE t.booking_id = $1 AND w.user_id = $2 AND t.balance_type = 'ESCROW_LOCKED' AND t.status = 'COMPLETED'`,
    [bookingId, customerId],
  );
  return Number(rows[0].held);
}

export async function markBookingRefunded(db: Queryable, bookingId: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = 'REFUNDED', updated_at = now() WHERE id = $1`, [bookingId]);
}

export async function userRole(db: Queryable, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ role: string }>(`SELECT role::text AS role FROM users WHERE id = $1`, [userId]);
  return rows[0]?.role ?? null;
}
