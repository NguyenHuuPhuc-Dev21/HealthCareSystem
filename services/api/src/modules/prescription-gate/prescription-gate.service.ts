/**
 * prescription-gate — the medical-order control for invasive services (BE-1 / Dev A, Phase 3).
 * Traceability: FR-BOOK-02 Layers 1–2 · SRS §4.2 Group 2 · BR-15 · US-HP-18 · NFR-SEC-01
 *
 *  Layer 1 (customer books): an invasive service needs a prescription photo that this customer
 *    uploaded, plus its issue date, no older than PRESCRIPTION_MAX_AGE_DAYS (system_configs).
 *    `bookings` (BE-2) calls `assertPrescriptionGate` inside POST /bookings.
 *  Layer 2 (nurse checks before accepting): the prescription is private; a short-lived download
 *    link is given only to the booking's customer, an Admin, the assigned nurse (inside BE-3's
 *    medical-record window) or a Tier 2 nurse holding a live offer for the booking.
 *    Every view by someone other than the customer is audited (VIEW_MEDICAL_RECORD).
 *
 * Layer 3 (on-site refusal of an invalid order) is `prescription-rejection`, Phase 4.
 */
import { AuditAction, UserRole, type SystemConfigKey } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getConfigNumber } from '../../core/config';
import { getPool, type Queryable } from '../../core/database';
import { AppError, badRequest, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { todayInVietnam } from '../nurse-onboarding/nurse-onboarding.service';
import { assertRecordAccess } from '../privacy-consent/privacy-consent.service';
import { candidateDenial, checkPrescription } from './prescription-gate.policy';
import { findBookingPrescription, findCandidateFacts } from './prescription-gate.repo';
import { PRESCRIPTION_CONTENT_TYPES } from './prescription-gate.schema';
import type {
  AcceptedPrescription,
  PrescriptionGateInput,
  PrescriptionProblem,
  PrescriptionStoragePort,
  PrescriptionUploadUrl,
  PrescriptionViewBasis,
  PrescriptionViewUrl,
  PrescriptionViewer,
} from './prescription-gate.types';

const CATEGORY = 'prescription' as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCEPTED_TYPES: readonly string[] = PRESCRIPTION_CONTENT_TYPES;

const PROBLEM_MESSAGES: Record<PrescriptionProblem, string> = {
  PRESCRIPTION_REQUIRED: "This service needs a photo of the doctor's prescription and its issue date",
  INVALID_PRESCRIPTION_DATE: 'The prescription issue date must be a real date (YYYY-MM-DD)',
  PRESCRIPTION_DATE_IN_FUTURE: 'The prescription issue date cannot be in the future',
  PRESCRIPTION_TOO_OLD: 'The prescription is too old. Ask the doctor for a new one.',
};

export interface PrescriptionGateDeps {
  storage: PrescriptionStoragePort;
  /** Pool (or a transaction client) for the read queries and the audit row. */
  db: Queryable;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  /** BE-3's medical-record window for the ASSIGNED nurse; throws 403 RECORD_ACCESS_DENIED. */
  assertAssignedNurseAccess: (bookingId: string, nurseId: string) => Promise<void>;
  maxUploadBytes: number;
  now?: () => number;
}

export class PrescriptionGateService {
  constructor(private readonly deps: PrescriptionGateDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** POST /bookings/prescription/upload-url — presigned PUT; the client never chooses the key. */
  async requestUploadUrl(customerId: string, contentType: string): Promise<PrescriptionUploadUrl> {
    if (!ACCEPTED_TYPES.includes(contentType)) {
      throw badRequest('CONTENT_TYPE_NOT_ALLOWED', `A prescription accepts ${ACCEPTED_TYPES.join(', ')}`);
    }
    const objectKey = this.deps.storage.buildObjectKey(CATEGORY, customerId, contentType);
    const url = await this.deps.storage.createUploadUrl(objectKey, contentType);
    return { objectKey, uploadUrl: url.url, expiresInSeconds: url.expiresInSeconds, contentType };
  }

  /**
   * Layer 1. Throws a 400 with a specific code when the booking must be refused.
   * @returns what to store on the booking, or null for a non-invasive service (store nothing).
   */
  async assertPrescriptionGate(input: PrescriptionGateInput): Promise<AcceptedPrescription | null> {
    if (!input.isInvasive) return null;

    const maxAgeDays = await this.deps.getNumber('PRESCRIPTION_MAX_AGE_DAYS');
    const today = todayInVietnam(this.nowMs());
    const problem = checkPrescription(
      { isInvasive: true, imageKey: input.prescriptionImageKey, issuedDate: input.prescriptionIssuedDate },
      today,
      maxAgeDays,
    );
    if (problem) {
      throw badRequest(problem, PROBLEM_MESSAGES[problem], problem === 'PRESCRIPTION_TOO_OLD' ? { maxAgeDays } : undefined);
    }

    const key = input.prescriptionImageKey!;
    await this.verifyUploadedFile(input.customerId, key);
    return { prescriptionImageKey: key, prescriptionIssuedDate: input.prescriptionIssuedDate! };
  }

  /** Owner, category, exists, size, real content (magic bytes) — same checks as nurse documents. */
  private async verifyUploadedFile(customerId: string, key: string): Promise<void> {
    const details = { purpose: 'PRESCRIPTION', key };
    if (!storage.objectKeyBelongsTo(key, customerId) || !key.startsWith(`${CATEGORY}/`)) {
      throw badRequest('INVALID_FILE_KEY', 'File key is not a prescription upload of this account', details);
    }
    const info = await this.deps.storage.statObject(key);
    if (!info) throw badRequest('FILE_NOT_UPLOADED', 'The prescription file was not uploaded', details);
    if (info.sizeBytes <= 0 || info.sizeBytes > this.deps.maxUploadBytes) {
      throw badRequest('FILE_TOO_LARGE', 'The prescription file must be between 1 byte and the size limit', details);
    }
    const head = await this.deps.storage.readObjectHead(key);
    const realType = head ? storage.detectContentType(head) : null;
    if (!realType || !ACCEPTED_TYPES.includes(realType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED', 'The prescription file content is not an accepted type', details);
    }
  }

  /**
   * Layer 2. GET /bookings/:id/prescription — a download link valid for at most 10 minutes.
   *  404 BOOKING_NOT_FOUND            unknown booking, or a customer asking about someone else's
   *  403 RECORD_ACCESS_DENIED         assigned nurse outside the medical-record window (BE-3)
   *  403 PRESCRIPTION_ACCESS_DENIED   other nurse; details.reason = NOT_OFFERED | BOOKING_NOT_OPEN | TIER_2_REQUIRED
   *  404 PRESCRIPTION_NOT_FOUND       the booking has no prescription (non-invasive service)
   */
  async getViewUrl(viewer: PrescriptionViewer, bookingId: string): Promise<PrescriptionViewUrl> {
    const missing = () => notFound('BOOKING_NOT_FOUND', 'Booking not found');
    if (!UUID_RE.test(bookingId)) throw missing();
    const booking = await findBookingPrescription(this.deps.db, bookingId);
    if (!booking) throw missing();

    let basis: PrescriptionViewBasis;
    if (viewer.role === UserRole.ADMIN) {
      basis = 'ADMIN';
    } else if (viewer.role === UserRole.PATIENT) {
      // Same answer as an unknown id: a customer learns nothing about other people's bookings.
      if (booking.customer_id !== viewer.id) throw missing();
      basis = 'OWNER';
    } else if (booking.nurse_id === viewer.id) {
      await this.deps.assertAssignedNurseAccess(bookingId, viewer.id);
      basis = 'ASSIGNED_NURSE';
    } else {
      const now = this.nowMs();
      const facts = await findCandidateFacts(this.deps.db, bookingId, viewer.id, new Date(now), todayInVietnam(now));
      const reason = candidateDenial(booking.execution_status, facts);
      if (reason) {
        throw new AppError(403, 'PRESCRIPTION_ACCESS_DENIED', 'You cannot view the prescription of this booking', { reason });
      }
      basis = 'CANDIDATE_NURSE';
    }

    if (!booking.prescription_image_url) {
      throw notFound('PRESCRIPTION_NOT_FOUND', 'This booking has no prescription');
    }

    if (basis !== 'OWNER') {
      await writeAuditLog(this.deps.db, {
        actorId: viewer.id,
        action: AuditAction.VIEW_MEDICAL_RECORD,
        targetTable: 'bookings',
        targetId: bookingId,
        newValue: { document: 'PRESCRIPTION', basis },
        ...(viewer.ip ? { ipAddress: viewer.ip } : {}),
      });
    }

    const url = await this.deps.storage.createDownloadUrl(booking.prescription_image_url);
    return { url: url.url, expiresInSeconds: url.expiresInSeconds, basis, issuedDate: booking.prescription_issued_date };
  }
}

// ---------------------------------------------------------------------------
// Wiring with real dependencies
// ---------------------------------------------------------------------------

let singleton: PrescriptionGateService | null = null;

export function getPrescriptionGateService(): PrescriptionGateService {
  if (!singleton) {
    const pool = getPool();
    singleton = new PrescriptionGateService({
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: (key, type) => storage.createUploadUrl(key, type),
        createDownloadUrl: (key) => storage.createDownloadUrl(key),
        statObject: storage.statObject,
        readObjectHead: (key) => storage.readObjectHead(key),
      },
      db: pool,
      getNumber: getConfigNumber,
      assertAssignedNurseAccess: async (bookingId, nurseId) => {
        await assertRecordAccess(pool, { bookingId, nurseId });
      },
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
    });
  }
  return singleton;
}

/**
 * For `bookings` (BE-2), inside POST /api/v1/bookings:
 *
 *   const rx = await assertPrescriptionGate({ customerId, isInvasive: service.is_invasive,
 *     prescriptionImageKey: body.prescriptionImageKey, prescriptionIssuedDate: body.prescriptionIssuedDate });
 *   // INSERT … prescription_image_url = rx?.prescriptionImageKey ?? null,
 *   //          prescription_issued_date = rx?.prescriptionIssuedDate ?? null
 */
export function assertPrescriptionGate(input: PrescriptionGateInput): Promise<AcceptedPrescription | null> {
  return getPrescriptionGateService().assertPrescriptionGate(input);
}
