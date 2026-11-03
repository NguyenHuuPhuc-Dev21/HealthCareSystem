/**
 * privacy-consent service (BE-3 · Phase 1 · FR-PRIV-01, NFR-PRIV-01).
 * Contract: docs/api/privacy-consent.api.md §1.
 *
 *  - captureConsent(): builds the consent columns BE-2 writes when a patient
 *    profile is created. The timestamp is SERVER time, never the client's clock.
 *  - assertConsentActive(): BE-2 calls it before creating a booking; refuses a
 *    missing/soft-deleted profile (404) or a profile whose consent was withdrawn (403).
 */
import type { Queryable } from "../../core/database";
import { badRequest, forbidden, notFound } from "../../core/errors";
import { findConsentState } from "./privacy-consent.repo";
import type { ConsentColumns, ConsentInput } from "./privacy-consent.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IP_LENGTH = 45; // patient_profiles.consent_ip VARCHAR(45)
const MAX_DEVICE_ID_LENGTH = 255; // patient_profiles.consent_device_id VARCHAR(255)

/** Trims; empty → null; too long → 400. */
function cleanOptional(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.length > max) {
    throw badRequest(
      "VALIDATION_ERROR",
      `${field} must be at most ${max} characters`,
    );
  }
  return trimmed;
}

/**
 * Validates the consent tick and returns the columns to store.
 * Throws 400 CONSENT_REQUIRED unless `accepted` is exactly `true`.
 */
export function captureConsent(
  input: ConsentInput,
  now: () => Date = () => new Date(),
): ConsentColumns {
  if (input.accepted !== true) {
    throw badRequest(
      "CONSENT_REQUIRED",
      "Explicit consent to health-data processing is required (Decree 13/2023/ND-CP)",
    );
  }
  return {
    data_consent_accepted: true,
    consent_timestamp: now(),
    consent_ip: cleanOptional(input.ip, "consent_ip", MAX_IP_LENGTH),
    consent_device_id: cleanOptional(
      input.deviceId,
      "consent_device_id",
      MAX_DEVICE_ID_LENGTH,
    ),
  };
}

/**
 * Throws unless the patient profile exists, is not soft-deleted and still has consent.
 *  - not a UUID / not found / deleted_at set → 404 PATIENT_PROFILE_NOT_FOUND
 *  - data_consent_accepted = false           → 403 CONSENT_REQUIRED
 */
export async function assertConsentActive(
  db: Queryable,
  patientProfileId: string,
): Promise<void> {
  if (!UUID_RE.test(patientProfileId)) {
    throw notFound("PATIENT_PROFILE_NOT_FOUND", "Patient profile not found");
  }
  const state = await findConsentState(db, patientProfileId);
  if (!state || state.deleted_at !== null) {
    throw notFound("PATIENT_PROFILE_NOT_FOUND", "Patient profile not found");
  }
  if (state.data_consent_accepted !== true) {
    throw forbidden(
      "CONSENT_REQUIRED",
      "Consent to health-data processing is not active for this profile",
    );
  }
}
