/**
 * bookings — quote, create and read bookings for customers.
 * BE-2 · Phase 3 · FR-BOOK-01/02/03 · BR-03 · BR-14 · US-HP-09. Contract: docs/api/bookings.api.md
 *
 * POST /bookings, in order (nothing is written until every gate passes):
 *   1. service exists, is active, and is NOT prohibited (Group 3 → 403; the DB has a trigger as well)
 *   2. slot rules (future start; 4/8/12/24 h shifts; one short visit for task-based services)
 *   3. prescription gate layer 1 for invasive services (image uploaded by this customer, issued <= 7 days ago)
 *   4. one transaction: ownership + Decree-13 consent + location-based eKYC (patient-profiles guard)
 *      → price from pricing-engine (the client never sends amounts) → INSERT as DRAFT / UNPAID
 *      → BANK_TRANSFER: 15-minute payment hold · CASH: matching starts right away
 *   5. after commit: payment-timeout job (bank transfer) or Radar wave 1 (urgent cash booking)
 *
 * Bank-transfer bookings start matching when BE-3's gateway webhook marks them ESCROW_HELD and calls
 * matching-radar `activateMatching` + `startRadar`.
 */
import { randomBytes } from 'node:crypto';
import { ExecutionStatus, MatchingMode, PaymentMethod } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, forbidden, notFound } from '../../core/errors';
import { jobs } from '../../core/jobs';
import * as storage from '../../core/storage';
import { activateMatching, getMatchingRadarService } from '../matching-radar/matching-radar.service';
import { routeMatchingMode } from '../matching-radar/matching-radar.policy';
import { todayInVietnam } from '../nurse-onboarding/nurse-onboarding.service';
import { assertCanBookForProfile } from '../patient-profiles/patient-profiles.service';
import { toSnapshot } from '../pricing-engine/pricing-engine.policy';
import { loadRates, quotePrice } from '../pricing-engine/pricing-engine.service';
import type { PricingQuote, PricingRates } from '../pricing-engine/pricing-engine.types';
import { buildBookingCode, prescriptionProblem, slotProblem } from './bookings.policy';
import * as repo from './bookings.repo';
import type { CreateBookingBody, PrescriptionUploadBody, QuoteBody } from './bookings.schema';
import { PAYMENT_TIMEOUT_JOB, type BookingRow, type BookingView, type PaymentTimeoutPayload, type ServiceRow } from './bookings.types';

const MINUTE_MS = 60_000;
const LIST_LIMIT = 100;
const PRESCRIPTION_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** The part of core/storage the prescription check needs (tests pass a fake). */
export interface PrescriptionStorage {
  statObject(key: string): Promise<{ sizeBytes: number } | null>;
  readObjectHead(key: string): Promise<Buffer | null>;
}

export interface BookingsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  scheduler: { scheduleJob<T>(jobName: string, payload: T, runAt: Date, idempotencyKey: string): Promise<unknown> };
  /** Starts Radar wave 1 for a booking that just entered MATCHING in RADAR_DISPATCH mode. */
  startRadar(bookingId: string): Promise<void>;
  storage: PrescriptionStorage;
  createUploadUrl(key: string, contentType: string): Promise<{ url: string; expiresInSeconds: number }>;
  now?: () => number;
}

const num = (v: string | number | null): number => Number(v ?? 0);

const SLOT_MESSAGES = {
  START_IN_PAST: 'The start time must be in the future',
  END_BEFORE_START: 'The end time must be after the start time',
  INVALID_DURATION: 'Shifts last 4, 8, 12 or 24 hours; a single procedure lasts at most 4 hours',
} as const;

const PRESCRIPTION_MESSAGES = {
  PRESCRIPTION_REQUIRED: 'This service needs a photo of the doctor\'s medical order and its issue date',
  PRESCRIPTION_DATE_IN_FUTURE: 'The medical order issue date cannot be in the future',
  PRESCRIPTION_EXPIRED: 'The medical order must have been issued within the last 7 days',
} as const;

export class BookingsService {
  constructor(private readonly deps: BookingsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** Gates 1–2: the service can be booked and the slot is valid. */
  private async bookableService(body: QuoteBody): Promise<{ service: ServiceRow; start: Date; end: Date }> {
    const service = await repo.findServiceByCode(this.deps.read, body.serviceCode);
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'Service not found');
    if (service.is_prohibited) {
      throw forbidden('SERVICE_PROHIBITED', 'This service is prohibited for home care and can never be booked');
    }
    if (!service.is_active) throw badRequest('SERVICE_NOT_AVAILABLE', 'This service is not available at the moment');
    const start = new Date(body.startAt);
    const end = new Date(body.endAt);
    const problem = slotProblem(service.unit, start, end, this.nowMs());
    if (problem) throw badRequest(problem, SLOT_MESSAGES[problem]);
    return { service, start, end };
  }

  /** POST /bookings/quote — the price the customer will be charged; nothing is stored. */
  async quote(customerId: string, body: QuoteBody): Promise<PricingQuote> {
    const { service, start, end } = await this.bookableService(body);
    const profile = await repo.findOwnedProfileForQuote(this.deps.read, customerId, body.patientProfileId);
    if (!profile) throw forbidden('FORBIDDEN', 'You cannot book for this patient profile');
    return quotePrice(this.deps.read, {
      service: { unit: service.unit, basePrice: num(service.base_price) },
      patient: { weightKg: profile.weight_kg === null ? null : Number(profile.weight_kg), mobilityStatus: profile.mobility_status },
      start,
      end,
    });
  }

  /** POST /bookings/prescription/upload-url — presigned PUT (10 minutes) into private storage. */
  async prescriptionUploadUrl(customerId: string, body: PrescriptionUploadBody) {
    const objectKey = storage.buildObjectKey('prescription', customerId, body.contentType);
    const signed = await this.deps.createUploadUrl(objectKey, body.contentType);
    return { objectKey, uploadUrl: signed.url, contentType: body.contentType, expiresInSeconds: signed.expiresInSeconds };
  }

  /**
   * FR-BOOK-02 layer 1. Minimal version kept inside bookings until BE-1's `prescription-gate` module
   * lands (then this method delegates to it): required for invasive services, issued <= 7 days ago,
   * and the image really is this customer's upload.
   */
  private async checkPrescription(customerId: string, service: ServiceRow, body: CreateBookingBody): Promise<void> {
    const problem = prescriptionProblem(service.is_invasive, body.prescription, todayInVietnam(this.nowMs()));
    if (problem) throw badRequest(problem, PRESCRIPTION_MESSAGES[problem]);
    if (!service.is_invasive || !body.prescription) return;

    const key = body.prescription.imageKey;
    if (!storage.objectKeyBelongsTo(key, customerId) || !key.startsWith('prescription/')) {
      throw badRequest('INVALID_FILE_KEY', 'The medical order image is not an upload of this account');
    }
    const info = await this.deps.storage.statObject(key);
    if (!info) throw badRequest('FILE_NOT_UPLOADED', 'The medical order image was not uploaded');
    if (info.sizeBytes <= 0 || info.sizeBytes > storage.MAX_UPLOAD_BYTES) {
      throw badRequest('FILE_TOO_LARGE', 'The medical order image is empty or too large');
    }
    const head = await this.deps.storage.readObjectHead(key);
    const realType = head ? storage.detectContentType(head) : null;
    if (!realType || !PRESCRIPTION_TYPES.includes(realType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED', 'The medical order must be a JPEG, PNG or WebP image');
    }
  }

  /** POST /bookings */
  async create(customerId: string, body: CreateBookingBody): Promise<BookingView> {
    const now = this.nowMs();
    const { service, start, end } = await this.bookableService(body);
    await this.checkPrescription(customerId, service, body);
    if (body.invitedNurseId === customerId) throw badRequest('INVITED_NURSE_NOT_AVAILABLE', 'You cannot invite yourself');

    const [timeoutMin, urgentLeadHours] = await Promise.all([
      getConfigNumber('PAYMENT_TIMEOUT_MINUTES'),
      getConfigNumber('URGENT_BOOKING_LEAD_HOURS'),
    ]);
    const isCash = body.paymentMethod === PaymentMethod.CASH;
    const holdExpiresAt = isCash ? null : new Date(now + timeoutMin * MINUTE_MS);

    let created: { id: string; startRadar: boolean };
    try {
      created = await this.deps.withTx(async (db) => {
        // Admin-locked customer (admin-users, FR-ADMIN-01): no new bookings while SUSPENDED / BANNED.
        const accountStatus = await repo.lockCustomerStatus(db, customerId);
        if (accountStatus === 'SUSPENDED' || accountStatus === 'BANNED') {
          throw forbidden('ACCOUNT_SUSPENDED', 'Your account is locked and cannot create new bookings; please contact support');
        }
        // Ownership + Decree-13 consent + eKYC for home care (403 FORBIDDEN / CONSENT_REQUIRED / EKYC_REQUIRED).
        const profile = await assertCanBookForProfile(db, customerId, body.patientProfileId);
        if (body.invitedNurseId && !(await repo.isInvitableNurse(db, body.invitedNurseId))) {
          throw badRequest('INVITED_NURSE_NOT_AVAILABLE', 'The invited nurse cannot take bookings at the moment');
        }
        const quote = await quotePrice(db, {
          service: { unit: service.unit, basePrice: num(service.base_price) },
          patient: { weightKg: profile.weightKg, mobilityStatus: profile.mobilityStatus },
          start,
          end,
        });

        let id: string | null = null;
        for (let attempt = 0; attempt < 5 && !id; attempt++) {
          id = await repo.insertBooking(db, {
            code: buildBookingCode(todayInVietnam(now), randomBytes(6)),
            customerId,
            patientProfileId: body.patientProfileId,
            serviceId: service.id,
            // Provisional: decided again when matching really starts (activateMatching).
            matchingMode: body.invitedNurseId ? MatchingMode.JOB_BOARD : routeMatchingMode(start, now, urgentLeadHours),
            paymentMethod: body.paymentMethod,
            start,
            end,
            holdExpiresAt,
            prescriptionKey: service.is_invasive ? (body.prescription?.imageKey ?? null) : null,
            prescriptionIssuedDate: service.is_invasive ? (body.prescription?.issuedDate ?? null) : null,
            price: toSnapshot(quote),
          });
        }
        if (!id) throw new AppError(500, 'BOOKING_CODE_UNAVAILABLE', 'Could not allocate a booking code, please retry');
        if (body.invitedNurseId) await repo.insertDirectRequest(db, id, body.invitedNurseId);

        // Cash: nothing to prepay (FR-PAY-01), so the booking goes straight to matching.
        const startRadar = isCash ? (await activateMatching(db, id, now)).startRadar : false;
        return { id, startRadar };
      });
    } catch (err) {
      // DB trigger trg_bookings_no_prohibited_service (defence in depth).
      if ((err as { constraint?: string }).constraint === 'bookings_no_prohibited_service') {
        throw forbidden('SERVICE_PROHIBITED', 'This service is prohibited for home care and can never be booked');
      }
      throw err;
    }

    // After commit. A failure here must not lose the booking: it exists; log loudly so it can be re-driven.
    try {
      if (holdExpiresAt) {
        const payload: PaymentTimeoutPayload = { bookingId: created.id };
        await this.deps.scheduler.scheduleJob(PAYMENT_TIMEOUT_JOB, payload, holdExpiresAt, `payment-timeout:${created.id}`);
      }
      if (created.startRadar) await this.deps.startRadar(created.id);
    } catch (err) {
      console.error(`[bookings] follow-up job for booking ${created.id} could not be scheduled: ${(err as Error).message}`);
    }

    return this.get(customerId, created.id);
  }

  /** GET /bookings/:id — owner only; anything else is 403 (no existence leak). */
  async get(customerId: string, bookingId: string): Promise<BookingView> {
    const row = await repo.findOwnedBooking(this.deps.read, customerId, bookingId);
    if (!row) throw forbidden('FORBIDDEN', 'You cannot access this booking');
    return this.toView(row, await loadRates());
  }

  /** GET /bookings — the customer's bookings, newest first. */
  async list(customerId: string): Promise<BookingView[]> {
    const rows = await repo.listOwnedBookings(this.deps.read, customerId, LIST_LIMIT);
    const rates = rows.length ? await loadRates() : null;
    return Promise.all(rows.map((r) => this.toView(r, rates!)));
  }

  /**
   * The stored snapshot (base / surcharge / fee / total) is authoritative. The per-surcharge breakdown is
   * recomputed for display; if rates or holidays changed since creation it no longer adds up, and then only
   * the snapshot totals are shown (`surchargeAmount`), never a breakdown that disagrees with what was charged.
   */
  private async toView(r: BookingRow, rates: PricingRates): Promise<BookingView> {
    const start = new Date(r.start_time);
    const end = new Date(r.end_time);
    const snapshot = {
      baseAmount: num(r.base_amount),
      surchargeAmount: num(r.surcharge_amount),
      platformFee: num(r.platform_fee),
      totalAmount: num(r.total_amount),
    };
    const recomputed = await quotePrice(
      this.deps.read,
      {
        service: { unit: r.service_unit, basePrice: num(r.service_base_price) },
        patient: { weightKg: r.patient_weight_kg === null ? null : Number(r.patient_weight_kg), mobilityStatus: r.patient_mobility },
        start,
        end,
      },
      rates,
    );
    const matches = recomputed.baseAmount === snapshot.baseAmount && recomputed.totalAmount === snapshot.totalAmount;
    const pricing: PricingQuote & { surchargeAmount: number } = {
      ...(matches
        ? recomputed
        : { ...recomputed, nightSurcharge: 0, holidaySurcharge: 0, holidayName: null, heavyPatientSurcharge: 0 }),
      baseAmount: snapshot.baseAmount,
      platformFee: snapshot.platformFee,
      totalAmount: snapshot.totalAmount,
      surchargeAmount: snapshot.surchargeAmount,
    };

    const matching = r.execution_status === ExecutionStatus.DRAFT ? null : r.matching_mode;
    return {
      id: r.id,
      code: r.booking_code,
      serviceCode: r.service_code,
      serviceLabel: r.service_name,
      isInvasive: r.is_invasive,
      patientProfileId: r.patient_profile_id,
      patientName: r.patient_name,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      paymentMethod: r.payment_method,
      pricing,
      executionStatus: r.execution_status,
      paymentStatus: r.payment_status,
      disputeStatus: r.dispute_status,
      paymentExpiresAt:
        r.execution_status === ExecutionStatus.DRAFT && r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : null,
      bankTransfer: null,
      invitedNurse: r.invited_nurse_id
        ? {
            nurseId: r.invited_nurse_id,
            fullName: r.invited_nurse_name ?? '',
            respondBy: r.invited_respond_by ? new Date(r.invited_respond_by).toISOString() : null,
          }
        : null,
      matchingMode:
        matching === null ? null : r.invited_nurse_id && !r.nurse_id ? 'DIRECT_REQUEST' : matching === MatchingMode.RADAR_DISPATCH ? 'RADAR' : 'JOB_BOARD',
      prescriptionReview: null,
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
}

let singleton: BookingsService | null = null;

export function getBookingsService(): BookingsService {
  if (!singleton) {
    singleton = new BookingsService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      scheduler: jobs,
      startRadar: (bookingId) => getMatchingRadarService().startRadar(bookingId),
      storage: { statObject: storage.statObject, readObjectHead: storage.readObjectHead },
      createUploadUrl: async (key, contentType) => {
        const signed = await storage.createUploadUrl(key, contentType);
        return { url: signed.url, expiresInSeconds: signed.expiresInSeconds };
      },
    });
  }
  return singleton;
}
