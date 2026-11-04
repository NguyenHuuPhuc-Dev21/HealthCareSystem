/**
 * Data access for privacy-consent (SQL-first, ADR-0002). Parameterised SQL only.
 * Every function takes the caller's Queryable (pool or transaction client).
 */
import type { Queryable } from "../../core/database";
import type {
  BookingNurseRow,
  ConsentStateRow,
  MedicalRecordRow,
  OwnedProfileConsentRow,
  PrivacyRequestRow,
  PrivacyRequestStatusValue,
  PrivacyRequestTypeValue,
  RecordAccessFactsRow,
  RecordAccessGrantRow,
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

/** The booking's assigned nurse (Admin re-grant check). */
export async function findBookingNurse(
  db: Queryable,
  bookingId: string,
): Promise<BookingNurseRow | null> {
  const { rows } = await db.query<BookingNurseRow>(
    "SELECT id, nurse_id FROM bookings WHERE id = $1",
    [bookingId],
  );
  return rows[0] ?? null;
}

export async function insertRecordAccessGrant(
  db: Queryable,
  grant: {
    bookingId: string;
    nurseId: string;
    grantedBy: string;
    reason: string;
    expiresAt: Date;
  },
): Promise<RecordAccessGrantRow> {
  const { rows } = await db.query<RecordAccessGrantRow>(
    `INSERT INTO record_access_grants (booking_id, nurse_id, granted_by, reason, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, expires_at`,
    [
      grant.bookingId,
      grant.nurseId,
      grant.grantedBy,
      grant.reason,
      grant.expiresAt,
    ],
  );
  return rows[0];
}

/**
 * The caller's own, not-deleted profile, locked for the rest of the transaction
 * (two withdraw requests at once cannot both succeed). null = not the owner / deleted / missing.
 */
export async function lockOwnedProfileConsent(
  db: Queryable,
  profileId: string,
  customerId: string,
): Promise<OwnedProfileConsentRow | null> {
  const { rows } = await db.query<OwnedProfileConsentRow>(
    `SELECT id, data_consent_accepted
       FROM patient_profiles
      WHERE id = $1 AND customer_id = $2 AND deleted_at IS NULL
      FOR UPDATE`,
    [profileId, customerId],
  );
  return rows[0] ?? null;
}

export async function markConsentWithdrawn(
  db: Queryable,
  profileId: string,
  at: Date,
): Promise<void> {
  await db.query(
    "UPDATE patient_profiles SET data_consent_accepted = FALSE, consent_withdrawn_at = $2 WHERE id = $1",
    [profileId, at],
  );
}

// ---- Data-subject requests -----------------------------------------------------

const PRIVACY_REQUEST_COLUMNS =
  "id, customer_id, patient_profile_id, request_type, status, processed_by, processed_at, created_at";

export async function hasPendingPrivacyRequest(
  db: Queryable,
  profileId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    "SELECT id FROM privacy_requests WHERE patient_profile_id = $1 AND status = 'PENDING' LIMIT 1",
    [profileId],
  );
  return rows.length > 0;
}

export async function insertPrivacyRequest(
  db: Queryable,
  req: {
    customerId: string;
    profileId: string;
    requestType: PrivacyRequestTypeValue;
  },
): Promise<PrivacyRequestRow> {
  const { rows } = await db.query<PrivacyRequestRow>(
    `INSERT INTO privacy_requests (customer_id, patient_profile_id, request_type)
     VALUES ($1, $2, $3)
     RETURNING ${PRIVACY_REQUEST_COLUMNS}`,
    [req.customerId, req.profileId, req.requestType],
  );
  return rows[0];
}

export async function listPrivacyRequestsOfCustomer(
  db: Queryable,
  customerId: string,
): Promise<PrivacyRequestRow[]> {
  const { rows } = await db.query<PrivacyRequestRow>(
    `SELECT ${PRIVACY_REQUEST_COLUMNS} FROM privacy_requests
      WHERE customer_id = $1
      ORDER BY created_at DESC, id`,
    [customerId],
  );
  return rows;
}

/** Admin list, oldest first; status = null means every status. total = rows matching the filter. */
export async function listPrivacyRequests(
  db: Queryable,
  filter: {
    status: PrivacyRequestStatusValue | null;
    limit: number;
    offset: number;
  },
): Promise<{ rows: PrivacyRequestRow[]; total: number }> {
  const where =
    "WHERE ($1::privacy_request_status_enum IS NULL OR status = $1::privacy_request_status_enum)";
  const count = await db.query<{ n: string | number }>(
    `SELECT count(*) AS n FROM privacy_requests ${where}`,
    [filter.status],
  );
  const { rows } = await db.query<PrivacyRequestRow>(
    `SELECT ${PRIVACY_REQUEST_COLUMNS} FROM privacy_requests ${where}
      ORDER BY created_at ASC, id
      LIMIT $2 OFFSET $3`,
    [filter.status, filter.limit, filter.offset],
  );
  return { rows, total: Number(count.rows[0].n) };
}

/** Locks the request for the rest of the transaction (no double processing). */
export async function lockPrivacyRequest(
  db: Queryable,
  requestId: string,
): Promise<PrivacyRequestRow | null> {
  const { rows } = await db.query<PrivacyRequestRow>(
    `SELECT ${PRIVACY_REQUEST_COLUMNS} FROM privacy_requests WHERE id = $1 FOR UPDATE`,
    [requestId],
  );
  return rows[0] ?? null;
}

export async function markPrivacyRequestProcessed(
  db: Queryable,
  requestId: string,
  status: "DONE" | "REJECTED",
  adminId: string,
  at: Date,
): Promise<void> {
  await db.query(
    "UPDATE privacy_requests SET status = $2, processed_by = $3, processed_at = $4 WHERE id = $1",
    [requestId, status, adminId, at],
  );
}

/** True when any booking of the profile has an OPEN / UNDER_REVIEW dispute (NFR-PRIV-01). */
export async function profileHasOpenDispute(
  db: Queryable,
  profileId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `SELECT d.id
       FROM disputes d
       JOIN bookings b ON b.id = d.booking_id
      WHERE b.patient_profile_id = $1 AND d.status IN ('OPEN', 'UNDER_REVIEW')
      LIMIT 1`,
    [profileId],
  );
  return rows.length > 0;
}

/**
 * Anonymizes the profile (contract §4): personal and medical fields cleared, deleted_at set.
 * Bookings, ledger and audit rows keep pointing at the row (financial/legal records).
 * Also used by the retention sweep.
 */
export async function anonymizeProfile(
  db: Queryable,
  profileId: string,
  at: Date,
): Promise<void> {
  await db.query(
    `UPDATE patient_profiles
        SET full_name = 'Đã ẩn danh',
            dob = NULL,
            medical_history = NULL,
            address_text = NULL,
            lat = NULL,
            lng = NULL,
            weight_kg = NULL,
            consent_ip = NULL,
            consent_device_id = NULL,
            deleted_at = $2
      WHERE id = $1`,
    [profileId, at],
  );
}
