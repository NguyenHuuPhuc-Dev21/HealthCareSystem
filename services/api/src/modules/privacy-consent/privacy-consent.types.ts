/**
 * Types for privacy-consent (BE-3 · Phase 1 · FR-PRIV-01).
 * Status enums come from packages/shared; only module-local shapes live here.
 */

/** What the client told us when the patient (or guardian) ticked the consent box. */
export interface ConsentInput {
  /** Must be exactly `true` — an unticked box, a missing field or "true" (string) is refused. */
  accepted: unknown;
  /** Client IP as seen by the server (req.ip). */
  ip: string | null | undefined;
  /** Device identifier sent by the app in the `X-Device-Id` header. */
  deviceId: string | null | undefined;
}

/**
 * Columns BE-2 (patient-profiles) spreads into its INSERT INTO patient_profiles.
 * Names match the table columns exactly (db/migrations/0001_initial_schema.sql).
 */
export interface ConsentColumns {
  data_consent_accepted: true;
  consent_timestamp: Date;
  consent_ip: string | null;
  consent_device_id: string | null;
}

/** Row read by assertConsentActive. A `type` (not an interface) so it satisfies pg's QueryResultRow. */
export type ConsentStateRow = {
  id: string;
  data_consent_accepted: boolean;
  deleted_at: Date | null;
};

// ---- Medical-record access (US-HP-18, FR-PRIV-01 §2–3) -----------------------

export type RecordAccessBasis =
  | "ACTIVE_BOOKING"
  | "POST_CHECKOUT_WINDOW"
  | "ADMIN_GRANT";
export type RecordAccessDenialReason =
  | "NOT_ASSIGNED"
  | "CONSENT_WITHDRAWN"
  | "WINDOW_CLOSED";

/** Everything the access decision needs, read in ONE query (privacy-consent.repo.ts). */
export interface RecordAccessFacts {
  bookingId: string;
  assignedNurseId: string | null;
  executionStatus: string;
  patientProfileId: string;
  consentActive: boolean;
  profileDeleted: boolean;
  checkoutTime: Date | null;
  /** Latest expires_at of an unexpired Admin re-grant for THIS nurse, or null. */
  grantUntil: Date | null;
}

export interface RecordAccessDecision {
  patientProfileId: string;
  basis: RecordAccessBasis;
  /** null while the booking is CONFIRMED / IN_PROGRESS (no end time yet). */
  accessUntil: Date | null;
}

export type RecordAccessOutcome =
  | ({ allowed: true } & RecordAccessDecision)
  | { allowed: false; reason: RecordAccessDenialReason };

/** Row shape of findRecordAccessFacts (a `type` so it satisfies QueryResultRow). */
export type RecordAccessFactsRow = {
  booking_id: string;
  nurse_id: string | null;
  execution_status: string;
  patient_profile_id: string;
  data_consent_accepted: boolean;
  deleted_at: Date | null;
  checkout_time: Date | null;
  grant_until: Date | null;
};

/** Row shape of loadMedicalRecord. */
export type MedicalRecordRow = {
  full_name: string;
  dob: Date | string | null;
  gender: string | null;
  weight_kg: string | number | null;
  mobility_status: string;
  medical_history: string | null;
  is_infectious: boolean;
  address_text: string | null;
  lat: string | number | null;
  lng: string | number | null;
  is_invasive: boolean;
  prescription_image_url: string | null;
  prescription_issued_date: Date | string | null;
};

/** Response body of GET /nurse/bookings/:bookingId/medical-record (contract §2). */
export interface MedicalRecordView {
  bookingId: string;
  access: { basis: RecordAccessBasis; accessUntil: string | null };
  patient: {
    fullName: string;
    dob: string | null;
    gender: string | null;
    weightKg: number | null;
    mobilityStatus: string;
    medicalHistory: string | null;
    isInfectious: boolean;
    addressText: string | null;
    lat: number | null;
    lng: number | null;
  };
  prescription: {
    issuedDate: string | null;
    imageUrl: string;
    imageUrlExpiresInSeconds: number;
  } | null;
}

// ---- Admin re-grant (FR-PRIV-01 §3, US-HP-28) ----------------------------------

export interface GrantRecordAccessInput {
  nurseId: string;
  reason: string;
  expiresAt: Date;
}

/** Row shape of findBookingNurse. */
export type BookingNurseRow = { id: string; nurse_id: string | null };

/** Row shape of insertRecordAccessGrant. */
export type RecordAccessGrantRow = { id: string; expires_at: Date };

/** Response body of POST /admin/bookings/:bookingId/record-access-grants (contract §3). */
export interface RecordAccessGrantView {
  grantId: string;
  expiresAt: string;
}

// ---- Consent withdrawal (US-HP-03) ---------------------------------------------

/** Row shape of lockOwnedProfileConsent. */
export type OwnedProfileConsentRow = {
  id: string;
  data_consent_accepted: boolean;
};

/** Response body of POST /patient-profiles/:profileId/consent/withdraw (contract §4). */
export interface ConsentWithdrawalView {
  consent: "WITHDRAWN";
  withdrawnAt: string;
}
