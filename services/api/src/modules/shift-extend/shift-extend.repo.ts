/** SQL for shift-extend (ADR-0002). Writes expect a TRANSACTION client. BE-1 · Phase 4 · FR-SHIFT-03. */
import type { Queryable } from '../../core/database';
import type { BusyRow, ExtendBookingRow, ExtensionRow } from './shift-extend.types';

const BOOKING_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.execution_status, b.payment_method, b.payment_status,
         b.start_time, b.end_time,
         s.unit AS service_unit, s.base_price AS service_base_price,
         p.weight_kg, p.mobility_status
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id`;

const EXT_COLUMNS = `
  id, booking_id, extra_hours, extra_amount, extra_base_amount, extra_surcharge_amount, extra_platform_fee,
  status::text AS status, created_at, responded_at, decline_reason, payment_code, payment_expires_at, paid_at, applied_at`;

export async function findBooking(db: Queryable, bookingId: string): Promise<ExtendBookingRow | null> {
  const { rows } = await db.query<ExtendBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

export async function lockBooking(db: Queryable, bookingId: string): Promise<ExtendBookingRow | null> {
  const { rows } = await db.query<ExtendBookingRow>(`${BOOKING_SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * Locks the nurse row: matching / job-board lock the same row before giving her a booking, so an extension and a
 * new assignment for the same nurse are decided one after the other (availability-engine contract).
 */
export async function lockNurse(db: Queryable, nurseId: string): Promise<void> {
  await db.query('SELECT 1 FROM nurse_profiles WHERE user_id = $1 FOR UPDATE', [nurseId]);
}

/** The nurse's OTHER confirmed / running bookings that touch [from, to). */
export async function loadOtherBusy(db: Queryable, nurseId: string, bookingId: string, from: Date, to: Date): Promise<BusyRow[]> {
  const { rows } = await db.query<BusyRow>(
    `SELECT id, start_time, end_time
       FROM bookings
      WHERE nurse_id = $1 AND id <> $2
        AND execution_status IN ('CONFIRMED', 'IN_PROGRESS')
        AND tstzrange(start_time, end_time) && tstzrange($3::timestamptz, $4::timestamptz)`,
    [nurseId, bookingId, from, to],
  );
  return rows;
}

/** Hours already added to this booking by applied extensions (to find its originally booked length). */
export async function appliedExtraHours(db: Queryable, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ h: number }>(
    `SELECT COALESCE(sum(extra_hours), 0)::int AS h
       FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'EXTENSION' AND applied_at IS NOT NULL`,
    [bookingId],
  );
  return rows[0]?.h ?? 0;
}

/**
 * Closes what can no longer happen: a request the nurse did not answer before the shift end, an accepted
 * transfer whose payment window passed. Called at the start of every write, under the booking lock.
 */
export async function expireStale(db: Queryable, bookingId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments a
        SET status = 'EXPIRED', responded_at = COALESCE(a.responded_at, $2)
       FROM bookings b
      WHERE b.id = a.booking_id AND a.booking_id = $1 AND a.adjustment_type = 'EXTENSION'
        AND (   (a.status = 'REQUESTED' AND b.end_time <= $2)
             OR (a.status = 'ACCEPTED' AND a.applied_at IS NULL AND a.payment_expires_at <= $2))`,
    [bookingId, now],
  );
}

export async function hasOpenExtension(db: Queryable, bookingId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'EXTENSION'
        AND (status = 'REQUESTED' OR (status = 'ACCEPTED' AND applied_at IS NULL))`,
    [bookingId],
  );
  return rows.length > 0;
}

export async function nextSequence(db: Queryable, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int + 1 AS n FROM booking_adjustments WHERE booking_id = $1 AND adjustment_type = 'EXTENSION'`,
    [bookingId],
  );
  return rows[0]!.n;
}

export async function insertExtension(
  db: Queryable,
  e: {
    bookingId: string;
    customerId: string;
    hours: number;
    amount: number;
    baseAmount: number;
    surchargeAmount: number;
    platformFee: number;
    paymentCode: string | null;
  },
): Promise<ExtensionRow> {
  const { rows } = await db.query<ExtensionRow>(
    `INSERT INTO booking_adjustments
       (booking_id, requested_by, adjustment_type, extra_hours, extra_amount,
        extra_base_amount, extra_surcharge_amount, extra_platform_fee, payment_code)
     VALUES ($1, $2, 'EXTENSION', $3, $4, $5, $6, $7, $8)
     RETURNING ${EXT_COLUMNS}`,
    [e.bookingId, e.customerId, e.hours, e.amount, e.baseAmount, e.surchargeAmount, e.platformFee, e.paymentCode],
  );
  return rows[0]!;
}

export async function lockExtension(db: Queryable, bookingId: string, extensionId: string): Promise<ExtensionRow | null> {
  const { rows } = await db.query<ExtensionRow>(
    `SELECT ${EXT_COLUMNS} FROM booking_adjustments
      WHERE id = $1 AND booking_id = $2 AND adjustment_type = 'EXTENSION' FOR UPDATE`,
    [extensionId, bookingId],
  );
  return rows[0] ?? null;
}

/** Booking id of an extension payment code (no lock: the caller then locks booking, then extension). */
export async function findBookingIdByPaymentCode(db: Queryable, paymentCode: string): Promise<string | null> {
  const { rows } = await db.query<{ booking_id: string }>(
    `SELECT booking_id FROM booking_adjustments WHERE payment_code = $1 AND adjustment_type = 'EXTENSION'`,
    [paymentCode],
  );
  return rows[0]?.booking_id ?? null;
}

export async function lockExtensionByCode(db: Queryable, paymentCode: string): Promise<ExtensionRow | null> {
  const { rows } = await db.query<ExtensionRow>(
    `SELECT ${EXT_COLUMNS} FROM booking_adjustments WHERE payment_code = $1 AND adjustment_type = 'EXTENSION' FOR UPDATE`,
    [paymentCode],
  );
  return rows[0] ?? null;
}

export async function markRejected(db: Queryable, id: string, nurseId: string, reason: string | null, now: Date): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments SET status = 'REJECTED', responded_by = $2, responded_at = $3, decline_reason = $4 WHERE id = $1`,
    [id, nurseId, now, reason],
  );
}

/** Nurse agreed. `applied` = CASH (in effect now); otherwise waits for the transfer until paymentExpiresAt. */
export async function markAccepted(
  db: Queryable,
  id: string,
  nurseId: string,
  now: Date,
  opts: { applied: boolean; paymentExpiresAt: Date | null },
): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments
        SET status = 'ACCEPTED', responded_by = $2, responded_at = $3::timestamptz,
            applied_at = CASE WHEN $4::boolean THEN $3::timestamptz ELSE NULL END, payment_expires_at = $5::timestamptz
      WHERE id = $1`,
    [id, nurseId, now, opts.applied, opts.paymentExpiresAt],
  );
}

export async function markPaid(db: Queryable, id: string, paymentRef: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments SET status = 'PAID', payment_ref = $2, paid_at = $3, applied_at = $3 WHERE id = $1`,
    [id, paymentRef, now],
  );
}

export async function markExpired(db: Queryable, id: string, now: Date): Promise<void> {
  await db.query(`UPDATE booking_adjustments SET status = 'EXPIRED', responded_at = COALESCE(responded_at, $2) WHERE id = $1`, [
    id,
    now,
  ]);
}

/**
 * Puts the extension in effect: later end, larger amounts. The bookings exclusion constraint
 * (ex_bookings_nurse_no_overlap) refuses it with SQLSTATE 23P01 if it would overlap another shift of the nurse.
 */
export async function applyToBooking(db: Queryable, bookingId: string, e: ExtensionRow): Promise<void> {
  await db.query(
    `UPDATE bookings
        SET end_time = end_time + make_interval(hours => $2::int),
            base_amount = base_amount + $3,
            surcharge_amount = surcharge_amount + $4,
            platform_fee = platform_fee + $5,
            total_amount = total_amount + $6,
            updated_at = now()
      WHERE id = $1`,
    [
      bookingId,
      e.extra_hours,
      Number(e.extra_base_amount ?? 0),
      Number(e.extra_surcharge_amount ?? 0),
      Number(e.extra_platform_fee ?? 0),
      Number(e.extra_amount),
    ],
  );
}

export async function listExtensions(db: Queryable, bookingId: string): Promise<ExtensionRow[]> {
  const { rows } = await db.query<ExtensionRow>(
    `SELECT ${EXT_COLUMNS} FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'EXTENSION'
      ORDER BY created_at, id`,
    [bookingId],
  );
  return rows;
}
