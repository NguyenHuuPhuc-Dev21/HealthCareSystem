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
