/**
 * privacy-consent service (BE-3 · Phase 1 · FR-PRIV-01, NFR-PRIV-01).
 * Contract: docs/api/privacy-consent.api.md §1.
 *
 *  - captureConsent(): builds the consent columns BE-2 writes when a patient
 *    profile is created. The timestamp is SERVER time, never the client's clock.
 *  - assertConsentActive(): BE-2 calls it before creating a booking; refuses a
 *    missing/soft-deleted profile (404) or a profile whose consent was withdrawn (403).
 *  - assertRecordAccess(): the medical-record access window (US-HP-18) for any module
 *    that shows medical data to a nurse.
 *  - PrivacyConsentService.getMedicalRecord(): GET /nurse/bookings/:bookingId/medical-record,
 *    audit-logged as VIEW_MEDICAL_RECORD on EVERY view (NFR-SEC-01.6).
 */
import {
  AuditAction,
  PRESIGNED_URL_MAX_EXPIRY_SECONDS,
} from "@healthcare-system/shared";
import { writeAuditLog } from "../../core/audit";
import { getConfigNumber } from "../../core/config";
import {
  withTransaction,
  type DbClient,
  type Queryable,
} from "../../core/database";
import { AppError, badRequest, forbidden, notFound } from "../../core/errors";
import * as storage from "../../core/storage";
import { decideRecordAccess } from "./privacy-consent.policy";
import {
  findConsentState,
  findRecordAccessFacts,
  loadMedicalRecord,
} from "./privacy-consent.repo";
import type {
  ConsentColumns,
  ConsentInput,
  MedicalRecordRow,
  MedicalRecordView,
  RecordAccessDecision,
} from "./privacy-consent.types";

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

// ---- Medical-record access (US-HP-18) ----------------------------------------

export interface RecordAccessOptions {
  /** Defaults to the real clock. Tests pass a fixed date. */
  now?: Date;
  /** Defaults to system_configs.RECORD_ACCESS_EXPIRY_HOURS (never hard-coded). */
  expiryHours?: number;
}

/**
 * Throws unless `nurseId` may see the medical record of `bookingId` right now.
 *  - unknown booking                       → 404 BOOKING_NOT_FOUND
 *  - denied                                → 403 RECORD_ACCESS_DENIED, details.reason =
 *                                            NOT_ASSIGNED | CONSENT_WITHDRAWN | WINDOW_CLOSED
 * Pass the transaction client when you then read the data, so both see the same state.
 */
export async function assertRecordAccess(
  db: Queryable,
  args: { bookingId: string; nurseId: string },
  options: RecordAccessOptions = {},
): Promise<RecordAccessDecision> {
  if (!UUID_RE.test(args.bookingId))
    throw notFound("BOOKING_NOT_FOUND", "Booking not found");
  const now = options.now ?? new Date();
  const expiryHours =
    options.expiryHours ??
    (await getConfigNumber("RECORD_ACCESS_EXPIRY_HOURS"));

  const row = await findRecordAccessFacts(
    db,
    args.bookingId,
    args.nurseId,
    now,
  );
  if (!row) throw notFound("BOOKING_NOT_FOUND", "Booking not found");

  const outcome = decideRecordAccess(
    {
      bookingId: row.booking_id,
      assignedNurseId: row.nurse_id,
      executionStatus: row.execution_status,
      patientProfileId: row.patient_profile_id,
      consentActive: row.data_consent_accepted === true,
      profileDeleted: row.deleted_at !== null,
      checkoutTime: row.checkout_time ? new Date(row.checkout_time) : null,
      grantUntil: row.grant_until ? new Date(row.grant_until) : null,
    },
    args.nurseId,
    expiryHours,
    now,
  );
  if (!outcome.allowed) {
    throw new AppError(
      403,
      "RECORD_ACCESS_DENIED",
      "You do not have access to this medical record",
      {
        reason: outcome.reason,
      },
    );
  }
  return {
    patientProfileId: outcome.patientProfileId,
    basis: outcome.basis,
    accessUntil: outcome.accessUntil,
  };
}

/**
 * DATE columns come back as a string or as a JS Date at LOCAL midnight (node-pg).
 * Use the local calendar fields: toISOString() would shift the day in UTC+7.
 */
function toDateOnly(value: Date | string | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${mm}-${dd}`;
}

function toNumberOrNull(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

export interface PrivacyConsentDeps {
  /** Runs fn inside ONE transaction (access check + read + audit commit together). */
  withTx<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
  /** Presigned GET for an object key (≤ 10 minutes, core/storage). */
  downloadUrl(key: string): Promise<string>;
  /** system_configs.RECORD_ACCESS_EXPIRY_HOURS */
  recordAccessExpiryHours(): Promise<number>;
  now?: () => Date;
}

export class PrivacyConsentService {
  constructor(private readonly deps: PrivacyConsentDeps) {}

  /**
   * GET /nurse/bookings/:bookingId/medical-record.
   * Access check, data read and the VIEW_MEDICAL_RECORD audit row run in ONE transaction:
   * if the audit insert fails, the nurse gets nothing (no unaudited view).
   */
  async getMedicalRecord(
    nurseId: string,
    bookingId: string,
    ip: string | null,
  ): Promise<MedicalRecordView> {
    const now = (this.deps.now ?? (() => new Date()))();
    const expiryHours = await this.deps.recordAccessExpiryHours();

    const { decision, row } = await this.deps.withTx(async (client) => {
      const decision = await assertRecordAccess(
        client,
        { bookingId, nurseId },
        { now, expiryHours },
      );
      const row: MedicalRecordRow | null = await loadMedicalRecord(
        client,
        bookingId,
      );
      if (!row) throw notFound("BOOKING_NOT_FOUND", "Booking not found");
      await writeAuditLog(client, {
        actorId: nurseId,
        action: AuditAction.VIEW_MEDICAL_RECORD,
        targetTable: "patient_profiles",
        targetId: decision.patientProfileId,
        newValue: { bookingId, basis: decision.basis },
        ipAddress: ip ?? undefined,
      });
      return { decision, row };
    });

    // The image key never leaves the server: the nurse gets a 10-minute link (NFR-SEC-01).
    const prescription =
      row.is_invasive && row.prescription_image_url
        ? {
            issuedDate: toDateOnly(row.prescription_issued_date),
            imageUrl: await this.deps.downloadUrl(row.prescription_image_url),
            imageUrlExpiresInSeconds: PRESIGNED_URL_MAX_EXPIRY_SECONDS,
          }
        : null;

    return {
      bookingId,
      access: {
        basis: decision.basis,
        accessUntil: decision.accessUntil
          ? decision.accessUntil.toISOString()
          : null,
      },
      patient: {
        fullName: row.full_name,
        dob: toDateOnly(row.dob),
        gender: row.gender,
        weightKg: toNumberOrNull(row.weight_kg),
        mobilityStatus: row.mobility_status,
        medicalHistory: row.medical_history,
        isInfectious: row.is_infectious,
        addressText: row.address_text,
        lat: toNumberOrNull(row.lat),
        lng: toNumberOrNull(row.lng),
      },
      prescription,
    };
  }
}

// ---- wiring ----------------------------------------------------------------

let singleton: PrivacyConsentService | null = null;

export function getPrivacyConsentService(): PrivacyConsentService {
  if (!singleton) {
    singleton = new PrivacyConsentService({
      withTx: (fn) => withTransaction(fn),
      downloadUrl: async (key) => (await storage.createDownloadUrl(key)).url,
      recordAccessExpiryHours: () =>
        getConfigNumber("RECORD_ACCESS_EXPIRY_HOURS"),
    });
  }
  return singleton;
}
