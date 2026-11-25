/**
 * SQL for bookings (ADR-0002). Writes expect a TRANSACTION client. BE-2 · Phase 3.
 */
import type { Queryable } from '../../core/database';
import type { PriceSnapshot } from '../pricing-engine/pricing-engine.types';
import type { BookingRow, ServiceRow } from './bookings.types';

export async function findServiceByCode(db: Queryable, code: string): Promise<ServiceRow | null> {
  const { rows } = await db.query<ServiceRow>(
    `SELECT id, code, name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active
       FROM service_categories WHERE code = $1`,
    [code],
  );
  return rows[0] ?? null;
}

/** Owned, not deleted profile facts for a quote (no eKYC / consent gate: a quote creates nothing). */
export async function findOwnedProfileForQuote(
  db: Queryable,
  customerId: string,
  profileId: string,
): Promise<{ weight_kg: string | number | null; mobility_status: string } | null> {
  const { rows } = await db.query<{ weight_kg: string | number | null; mobility_status: string }>(
    `SELECT weight_kg, mobility_status FROM patient_profiles WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL`,
    [profileId, customerId],
  );
  return rows[0] ?? null;
}

/**
 * Account status of the customer, read FOR SHARE so an Admin suspension (admin-users, FOR UPDATE on the same row)
 * and a new booking never interleave.
 */
export async function lockCustomerStatus(db: Queryable, customerId: string): Promise<string | null> {
  const { rows } = await db.query<{ status: string }>(`SELECT status::text AS status FROM users WHERE id = $1 FOR SHARE`, [customerId]);
  return rows[0]?.status ?? null;
}

/** A nurse the customer may invite directly: ACTIVE account and ACTIVE profile. */
export async function isInvitableNurse(db: Queryable, nurseId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM nurse_profiles np JOIN users u ON u.id = np.user_id
      WHERE np.user_id = $1 AND np.profile_status = 'ACTIVE' AND u.status = 'ACTIVE'`,
    [nurseId],
  );
  return rows.length > 0;
}

export interface NewBooking {
  code: string;
  customerId: string;
  patientProfileId: string;
  serviceId: string;
  matchingMode: string;
  paymentMethod: string;
  start: Date;
  end: Date;
  holdExpiresAt: Date | null;
  prescriptionKey: string | null;
  prescriptionIssuedDate: string | null;
  price: PriceSnapshot;
}

/** Returns the new id, or null when the booking code is already taken (the caller retries with a new code). */
export async function insertBooking(db: Queryable, b: NewBooking): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO bookings
       (booking_code, customer_id, patient_profile_id, service_id, matching_mode, payment_method,
        start_time, end_time, hold_expires_at, prescription_image_url, prescription_issued_date,
        base_amount, surcharge_amount, platform_fee, total_amount, execution_status, payment_status)
     VALUES ($1, $2, $3, $4, $5::matching_mode_enum, $6::payment_method_enum,
             $7, $8, $9, $10, $11::date,
             $12, $13, $14, $15, 'DRAFT', 'UNPAID')
     ON CONFLICT (booking_code) DO NOTHING
     RETURNING id`,
    [
      b.code,
      b.customerId,
      b.patientProfileId,
      b.serviceId,
      b.matchingMode,
      b.paymentMethod,
      b.start,
      b.end,
      b.holdExpiresAt,
      b.prescriptionKey,
      b.prescriptionIssuedDate,
      b.price.baseAmount,
      b.price.surchargeAmount,
      b.price.platformFee,
      b.price.totalAmount,
    ],
  );
  return rows[0]?.id ?? null;
}

/** The customer's direct request to a chosen nurse. BE-3 job-board sets the 15-minute window when matching starts. */
export async function insertDirectRequest(db: Queryable, bookingId: string, nurseId: string): Promise<void> {
  await db.query(
    `INSERT INTO booking_offers (booking_id, nurse_id, offer_type, status) VALUES ($1, $2, 'DIRECT_REQUEST', 'SENT')`,
    [bookingId, nurseId],
  );
}

const BOOKING_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.patient_profile_id, b.nurse_id, b.matching_mode, b.payment_method,
         b.start_time, b.end_time, b.hold_expires_at, b.prescription_image_url,
         b.base_amount, b.surcharge_amount, b.platform_fee, b.total_amount,
         b.execution_status, b.payment_status, b.dispute_status, b.created_at,
         s.code AS service_code, s.name AS service_name, s.unit AS service_unit, s.base_price AS service_base_price,
         s.is_invasive, p.full_name AS patient_name, p.weight_kg AS patient_weight_kg, p.mobility_status AS patient_mobility,
         inv.nurse_id AS invited_nurse_id, inv.full_name AS invited_nurse_name, inv.expires_at AS invited_respond_by
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id
    LEFT JOIN LATERAL (
      SELECT o.nurse_id, u.full_name, o.expires_at
        FROM booking_offers o JOIN users u ON u.id = o.nurse_id
       WHERE o.booking_id = b.id AND o.offer_type = 'DIRECT_REQUEST'
       ORDER BY o.sent_at DESC LIMIT 1
    ) inv ON TRUE`;

/** Owner only: another customer's booking id returns null (the caller answers 403, no existence leak). */
export async function findOwnedBooking(db: Queryable, customerId: string, bookingId: string): Promise<BookingRow | null> {
  const { rows } = await db.query<BookingRow>(`${BOOKING_SELECT} WHERE b.id = $1 AND b.customer_id = $2`, [bookingId, customerId]);
  return rows[0] ?? null;
}

export async function listOwnedBookings(db: Queryable, customerId: string, limit: number): Promise<BookingRow[]> {
  const { rows } = await db.query<BookingRow>(
    `${BOOKING_SELECT} WHERE b.customer_id = $1 ORDER BY b.created_at DESC, b.id LIMIT $2`,
    [customerId, limit],
  );
  return rows;
}
