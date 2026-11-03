/**
 * Data access for privacy-consent (SQL-first, ADR-0002). Parameterised SQL only.
 * Every function takes the caller's Queryable (pool or transaction client).
 */
import type { Queryable } from "../../core/database";
import type {
  ConsentStateRow,
  MedicalRecordRow,
  RecordAccessFactsRow,
} from "./privacy-consent.types";

export async function findConsentState(
  db: Queryable,
  patientProfileId: string,
): Promise<ConsentStateRow | null> {
  const { rows } = await db.query<ConsentStateRow>(
    "SELECT id, data_consent_accepted, deleted_at FROM patient_profiles WHERE id = $1",
    [patientProfileId],
  );
  return rows[0] ?? null;
}

/**
 * Booking + profile + check-out + this nurse's latest unexpired re-grant, in one query.
 * `now` is a parameter (not SQL now()) so the decision and the grant filter use the same clock.
 */
export async function findRecordAccessFacts(
  db: Queryable,
  bookingId: string,
  nurseId: string,
  now: Date,
): Promise<RecordAccessFactsRow | null> {
  const { rows } = await db.query<RecordAccessFactsRow>(
    `SELECT b.id AS booking_id, b.nurse_id, b.execution_status, b.patient_profile_id,
            p.data_consent_accepted, p.deleted_at,
            sl.checkout_time,
            (SELECT max(g.expires_at)
               FROM record_access_grants g
              WHERE g.booking_id = b.id AND g.nurse_id = $2 AND g.expires_at > $3) AS grant_until
       FROM bookings b
       JOIN patient_profiles p ON p.id = b.patient_profile_id
       LEFT JOIN shift_logs sl ON sl.booking_id = b.id
      WHERE b.id = $1`,
    [bookingId, nurseId, now],
  );
  return rows[0] ?? null;
}

/** The medical data a nurse may see for a booking (call ONLY after the access check passed). */
export async function loadMedicalRecord(
  db: Queryable,
  bookingId: string,
): Promise<MedicalRecordRow | null> {
  const { rows } = await db.query<MedicalRecordRow>(
    `SELECT p.full_name, p.dob, p.gender, p.weight_kg, p.mobility_status, p.medical_history,
            p.is_infectious, p.address_text, p.lat, p.lng,
            s.is_invasive, b.prescription_image_url, b.prescription_issued_date
       FROM bookings b
       JOIN patient_profiles p ON p.id = b.patient_profile_id
       JOIN service_categories s ON s.id = b.service_id
      WHERE b.id = $1`,
    [bookingId],
  );
  return rows[0] ?? null;
}
