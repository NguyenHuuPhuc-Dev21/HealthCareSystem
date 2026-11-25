/**
 * shift-logs — SQL (BE-2 · Phase 4). The only place the shift modules (check-in, shift-logs, check-out) touch the
 * database. Every write is called inside the caller's transaction, after lockShift (booking row FOR UPDATE).
 */
import type { Queryable } from '../../core/database';
import type { CareItem, PendingExtensionRow, ShiftRow, StoredNote, StoredVital, SurchargeRow } from './shift-logs.types';

const SHIFT_SELECT = `
  SELECT b.id, b.booking_code, b.customer_id, b.nurse_id, b.patient_profile_id,
         b.execution_status::text AS execution_status, b.payment_status::text AS payment_status,
         b.payment_method::text AS payment_method, b.dispute_status::text AS dispute_status,
         b.start_time, b.end_time, b.base_amount, b.surcharge_amount, b.platform_fee, b.total_amount,
         b.commission_due_at, b.cancellation_reason,
         s.name AS service_name, s.service_type::text AS service_type, s.unit::text AS service_unit,
         s.base_price AS service_base_price, s.is_invasive,
         p.full_name AS patient_name, p.dob AS patient_dob, p.weight_kg, p.mobility_status::text AS mobility_status,
         p.address_text, p.lat AS patient_lat, p.lng AS patient_lng,
         n.full_name AS nurse_name, n.avatar_url AS nurse_avatar_url, np.tier::text AS nurse_tier,
         l.id AS log_id, l.checkin_time, l.checkin_lat, l.checkin_lng, l.checkin_distance_m,
         l.is_mock_location_detected, l.checkin_selfie_url, l.condition_mismatch_reported,
         l.mismatch_reason, l.mismatch_option, l.initial_assessment, l.assessed_at,
         l.vital_signs_log, l.care_activities_log, l.progress_notes, l.final_vital_signs,
         l.handover_note, l.checkout_time, l.updated_at AS log_updated_at
    FROM bookings b
    JOIN service_categories s ON s.id = b.service_id
    JOIN patient_profiles p ON p.id = b.patient_profile_id
    LEFT JOIN users n ON n.id = b.nurse_id
    LEFT JOIN nurse_profiles np ON np.user_id = b.nurse_id
    LEFT JOIN shift_logs l ON l.booking_id = b.id`;

export async function findShift(db: Queryable, bookingId: string): Promise<ShiftRow | null> {
  const { rows } = await db.query<ShiftRow>(`${SHIFT_SELECT} WHERE b.id = $1`, [bookingId]);
  return rows[0] ?? null;
}

/**
 * Locks the booking row (same lock as matching, shift-extend, prescription-rejection, cancellation and
 * settlements), then reads the whole shift. A concurrent check-out, refusal or payment waits for us.
 */
export async function lockShift(db: Queryable, bookingId: string): Promise<ShiftRow | null> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM bookings WHERE id = $1 FOR UPDATE`, [bookingId]);
  if (!rows[0]) return null;
  return findShift(db, bookingId);
}

export async function listNurseShifts(db: Queryable, nurseId: string, statuses: string[], limit: number): Promise<ShiftRow[]> {
  const { rows } = await db.query<ShiftRow>(
    `${SHIFT_SELECT}
      WHERE b.nurse_id = $1 AND b.execution_status::text = ANY($2::text[])
      ORDER BY CASE WHEN b.execution_status IN ('COMPLETED', 'CANCELLED') THEN 1 ELSE 0 END,
               CASE WHEN b.execution_status IN ('COMPLETED', 'CANCELLED') THEN NULL ELSE b.start_time END ASC,
               b.start_time DESC
      LIMIT $3`,
    [nurseId, statuses, limit],
  );
  return rows;
}

// ---- shift_logs -----------------------------------------------------------------------------------------

export async function startLog(
  db: Queryable,
  p: { bookingId: string; at: Date; lat: number; lng: number; distanceM: number; selfieKey: string; checklist: CareItem[] },
): Promise<void> {
  await db.query(
    `INSERT INTO shift_logs (booking_id, checkin_time, checkin_lat, checkin_lng, checkin_distance_m, checkin_selfie_url,
                             vital_signs_log, care_activities_log, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, $7::jsonb, $2)
     ON CONFLICT (booking_id) DO UPDATE
        SET checkin_time = EXCLUDED.checkin_time, checkin_lat = EXCLUDED.checkin_lat, checkin_lng = EXCLUDED.checkin_lng,
            checkin_distance_m = EXCLUDED.checkin_distance_m, checkin_selfie_url = EXCLUDED.checkin_selfie_url,
            vital_signs_log = COALESCE(shift_logs.vital_signs_log, '[]'::jsonb),
            care_activities_log = EXCLUDED.care_activities_log, updated_at = EXCLUDED.updated_at`,
    [p.bookingId, p.at, p.lat, p.lng, p.distanceM, p.selfieKey, JSON.stringify(p.checklist)],
  );
}

/** A mock location was reported on a check-in attempt (FR-SHIFT-01): the flag stays on the shift log. */
export async function flagMockLocation(db: Queryable, bookingId: string): Promise<void> {
  await db.query(
    `INSERT INTO shift_logs (booking_id, is_mock_location_detected) VALUES ($1, TRUE)
     ON CONFLICT (booking_id) DO UPDATE SET is_mock_location_detected = TRUE, updated_at = now()`,
    [bookingId],
  );
}

export async function appendVital(db: Queryable, bookingId: string, v: StoredVital, at: Date): Promise<void> {
  await db.query(
    `UPDATE shift_logs SET vital_signs_log = COALESCE(vital_signs_log, '[]'::jsonb) || $2::jsonb, updated_at = $3
      WHERE booking_id = $1`,
    [bookingId, JSON.stringify([v]), at],
  );
}

export async function setChecklist(db: Queryable, bookingId: string, items: CareItem[], at: Date): Promise<void> {
  await db.query(`UPDATE shift_logs SET care_activities_log = $2::jsonb, updated_at = $3 WHERE booking_id = $1`, [
    bookingId,
    JSON.stringify(items),
    at,
  ]);
}

export async function appendNote(db: Queryable, bookingId: string, note: StoredNote, at: Date): Promise<void> {
  await db.query(
    `UPDATE shift_logs SET progress_notes = progress_notes || $2::jsonb, updated_at = $3 WHERE booking_id = $1`,
    [bookingId, JSON.stringify([note]), at],
  );
}

export async function saveAssessment(
  db: Queryable,
  bookingId: string,
  p: { assessment: unknown; at: Date; mismatch: boolean; reason: string | null; option: 'SURCHARGE' | 'REFUSE' | null },
): Promise<void> {
  await db.query(
    `UPDATE shift_logs
        SET initial_assessment = $2::jsonb, assessed_at = $3, condition_mismatch_reported = $4,
            mismatch_reason = $5, mismatch_option = $6, updated_at = $3
      WHERE booking_id = $1`,
    [bookingId, JSON.stringify(p.assessment), p.at, p.mismatch, p.reason, p.option],
  );
}

export async function setMismatchOption(db: Queryable, bookingId: string, option: 'SURCHARGE' | 'REFUSE', reason: string | null, at: Date) {
  await db.query(
    `UPDATE shift_logs SET mismatch_option = $2, mismatch_reason = COALESCE($3, mismatch_reason), updated_at = $4
      WHERE booking_id = $1`,
    [bookingId, option, reason, at],
  );
}

export async function finishLog(
  db: Queryable,
  bookingId: string,
  p: { at: Date; finalVital: StoredVital; items: CareItem[]; handoverNote: string },
): Promise<void> {
  await db.query(
    `UPDATE shift_logs
        SET checkout_time = $2, final_vital_signs = $3::jsonb,
            vital_signs_log = COALESCE(vital_signs_log, '[]'::jsonb) || jsonb_build_array($3::jsonb),
            care_activities_log = $4::jsonb, handover_note = $5, updated_at = $2
      WHERE booking_id = $1`,
    [bookingId, p.at, JSON.stringify(p.finalVital), JSON.stringify(p.items), p.handoverNote],
  );
}

// ---- bookings -------------------------------------------------------------------------------------------

/** CONFIRMED → IN_PROGRESS. False when the booking is no longer CONFIRMED (lost a race). */
export async function markInProgress(db: Queryable, bookingId: string, at: Date): Promise<boolean> {
  const r = await db.query(
    `UPDATE bookings SET execution_status = 'IN_PROGRESS', updated_at = $2 WHERE id = $1 AND execution_status = 'CONFIRMED'`,
    [bookingId, at],
  );
  return (r.rowCount ?? 0) === 1;
}

/** IN_PROGRESS → COMPLETED; a cash booking also gets its commission deadline (read by cash-commission, BE-3). */
export async function markCompleted(db: Queryable, bookingId: string, at: Date, commissionDueAt: Date | null): Promise<boolean> {
  const r = await db.query(
    `UPDATE bookings SET execution_status = 'COMPLETED', commission_due_at = $3, updated_at = $2
      WHERE id = $1 AND execution_status = 'IN_PROGRESS'`,
    [bookingId, at, commissionDueAt],
  );
  return (r.rowCount ?? 0) === 1;
}

/** IN_PROGRESS → CANCELLED by the nurse for a condition mismatch (no penalty: nothing else is written). */
export async function cancelForMismatch(db: Queryable, bookingId: string, nurseId: string, at: Date): Promise<boolean> {
  const r = await db.query(
    `UPDATE bookings
        SET execution_status = 'CANCELLED', cancelled_by = $2, cancellation_reason = 'CONDITION_MISMATCH',
            cancelled_at = $3, updated_at = $3
      WHERE id = $1 AND execution_status = 'IN_PROGRESS'`,
    [bookingId, nurseId, at],
  );
  return (r.rowCount ?? 0) === 1;
}

export async function setPaymentStatus(db: Queryable, bookingId: string, status: string): Promise<void> {
  await db.query(`UPDATE bookings SET payment_status = $2::payment_status_enum, updated_at = now() WHERE id = $1`, [bookingId, status]);
}

/** Money held in the customer's escrow for this booking (holds − refunds − releases), incl. paid extensions. */
export async function escrowHeld(db: Queryable, bookingId: string, customerId: string): Promise<number> {
  const { rows } = await db.query<{ held: string }>(
    `SELECT COALESCE(sum(t.balance_after - t.balance_before), 0)::text AS held
       FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
      WHERE t.booking_id = $1 AND w.user_id = $2 AND t.balance_type = 'ESCROW_LOCKED' AND t.status = 'COMPLETED'`,
    [bookingId, customerId],
  );
  return Number(rows[0].held);
}

export async function applySurchargeToBooking(db: Queryable, bookingId: string, s: SurchargeRow): Promise<void> {
  await db.query(
    `UPDATE bookings
        SET base_amount = base_amount + $2, surcharge_amount = surcharge_amount + $3,
            platform_fee = platform_fee + $4, total_amount = total_amount + $5, updated_at = now()
      WHERE id = $1`,
    [bookingId, Number(s.extra_base_amount ?? 0), Number(s.extra_surcharge_amount ?? 0), Number(s.extra_platform_fee ?? 0), Number(s.extra_amount)],
  );
}

/** Hours added by extensions already in effect (the booked window is end_time minus these). */
export async function appliedExtensionHours(db: Queryable, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ h: string }>(
    `SELECT COALESCE(sum(extra_hours), 0)::text AS h FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'EXTENSION' AND applied_at IS NOT NULL`,
    [bookingId],
  );
  return Number(rows[0].h);
}

// ---- booking_adjustments (CONDITION_SURCHARGE; EXTENSION is read only) ------------------------------------

const SURCHARGE_COLUMNS = `id, booking_id, status::text AS status, extra_amount, extra_base_amount, extra_surcharge_amount,
  extra_platform_fee, decline_reason, payment_code, payment_expires_at, paid_at, applied_at, created_at, responded_at`;

export async function latestSurcharge(db: Queryable, bookingId: string): Promise<SurchargeRow | null> {
  const { rows } = await db.query<SurchargeRow>(
    `SELECT ${SURCHARGE_COLUMNS} FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'CONDITION_SURCHARGE' ORDER BY created_at DESC LIMIT 1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function lockOpenSurcharge(db: Queryable, bookingId: string): Promise<SurchargeRow | null> {
  const { rows } = await db.query<SurchargeRow>(
    `SELECT ${SURCHARGE_COLUMNS} FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'CONDITION_SURCHARGE'
        AND (status = 'REQUESTED' OR (status = 'ACCEPTED' AND applied_at IS NULL))
      FOR UPDATE`,
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function insertSurcharge(
  db: Queryable,
  p: { bookingId: string; nurseId: string; amount: number; base: number; surcharge: number; fee: number },
): Promise<void> {
  await db.query(
    `INSERT INTO booking_adjustments
       (booking_id, requested_by, adjustment_type, extra_amount, extra_base_amount, extra_surcharge_amount, extra_platform_fee)
     VALUES ($1, $2, 'CONDITION_SURCHARGE', $3, $4, $5, $6)`,
    [p.bookingId, p.nurseId, p.amount, p.base, p.surcharge, p.fee],
  );
}

export async function nextSurchargeSeq(db: Queryable, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int + 1 AS n FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'CONDITION_SURCHARGE' AND payment_code IS NOT NULL`,
    [bookingId],
  );
  return rows[0].n;
}

export async function answerSurcharge(
  db: Queryable,
  id: string,
  p: { status: 'ACCEPTED' | 'REJECTED'; by: string; at: Date; applied: boolean; paymentCode: string | null; paymentExpiresAt: Date | null },
): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments
        SET status = $2::adjustment_status_enum, responded_by = $3, responded_at = $4::timestamptz,
            applied_at = CASE WHEN $5::boolean THEN $4::timestamptz ELSE NULL END, payment_code = $6,
            payment_expires_at = $7::timestamptz
      WHERE id = $1`,
    [id, p.status, p.by, p.at, p.applied, p.paymentCode, p.paymentExpiresAt],
  );
}

export async function markSurchargePaid(db: Queryable, id: string, ref: string, at: Date): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments SET status = 'PAID', payment_ref = $2, paid_at = $3, applied_at = $3 WHERE id = $1`,
    [id, ref, at],
  );
}

/** Accepted surcharges whose transfer did not arrive in time are EXPIRED (the family can be asked again). */
export async function expireStaleSurcharges(db: Queryable, bookingId: string, now: Date): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments SET status = 'EXPIRED'
      WHERE booking_id = $1 AND adjustment_type = 'CONDITION_SURCHARGE'
        AND status = 'ACCEPTED' AND applied_at IS NULL AND payment_expires_at IS NOT NULL AND payment_expires_at < $2`,
    [bookingId, now],
  );
}

/**
 * The shift ended (check-out) or was cancelled: every request still open — extension or surcharge, waiting for
 * an answer or for a transfer — can no longer be used. A transfer that still arrives is refunded 100% by the
 * payment handlers (shift-extend, condition surcharge), which only apply ACCEPTED-and-unapplied rows.
 */
export async function expireOpenAdjustments(db: Queryable, bookingId: string): Promise<void> {
  await db.query(
    `UPDATE booking_adjustments SET status = 'EXPIRED'
      WHERE booking_id = $1 AND (status = 'REQUESTED' OR (status = 'ACCEPTED' AND applied_at IS NULL))`,
    [bookingId],
  );
}

export async function findBookingIdBySurchargeCode(db: Queryable, code: string): Promise<string | null> {
  const { rows } = await db.query<{ booking_id: string }>(
    `SELECT booking_id FROM booking_adjustments WHERE payment_code = $1 AND adjustment_type = 'CONDITION_SURCHARGE'`,
    [code],
  );
  return rows[0]?.booking_id ?? null;
}

export async function lockSurchargeByCode(db: Queryable, code: string): Promise<SurchargeRow | null> {
  const { rows } = await db.query<SurchargeRow>(
    `SELECT ${SURCHARGE_COLUMNS} FROM booking_adjustments
      WHERE payment_code = $1 AND adjustment_type = 'CONDITION_SURCHARGE' FOR UPDATE`,
    [code],
  );
  return rows[0] ?? null;
}

export async function pendingExtension(db: Queryable, bookingId: string): Promise<PendingExtensionRow | null> {
  const { rows } = await db.query<PendingExtensionRow>(
    `SELECT id, extra_hours, extra_amount, created_at, status::text AS status FROM booking_adjustments
      WHERE booking_id = $1 AND adjustment_type = 'EXTENSION' AND status = 'REQUESTED'
      ORDER BY created_at DESC LIMIT 1`,
    [bookingId],
  );
  return rows[0] ?? null;
}

/** WebSocket: may this user follow this booking? (customer, assigned nurse, or an Admin) */
export async function canWatch(db: Queryable, bookingId: string, user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'ADMIN') {
    const { rows } = await db.query(`SELECT 1 FROM bookings WHERE id = $1`, [bookingId]);
    return rows.length > 0;
  }
  const { rows } = await db.query(`SELECT 1 FROM bookings WHERE id = $1 AND (customer_id = $2 OR nurse_id = $2)`, [bookingId, user.id]);
  return rows.length > 0;
}
