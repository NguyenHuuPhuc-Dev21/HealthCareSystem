/**
 * prescription-rejection — the nurse refuses a shift on site because the medical order is invalid
 * (BE-1 / Dev A, Phase 4). Traceability: FR-BOOK-02 Layer 3 · BR-15 §2.2 · BR-07 · RISK-01.
 *
 * In ONE transaction, under the booking row lock:
 *   1. booking CONFIRMED / IN_PROGRESS → CANCELLED (cancelled_by = nurse, reason INVALID_PRESCRIPTION);
 *   2. the evidence photo, the reason and the travel support owed are stored in prescription_rejections;
 *   3. a prepaid bank-transfer booking (ESCROW_HELD) is refunded 100% through BE-3's escrow ledger.
 * The nurse is never penalised: no deposit deduction, no TrustScore change (nothing here touches them).
 * The travel support (ICU_TRAVEL_SUPPORT) is recorded as owed; wallets-ledger (BE-3, Phase 5) pays it.
 */
import { PaymentStatus, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, notFound } from '../../core/errors';
import * as storage from '../../core/storage';
import { refundEscrow } from '../gateway-webhooks/gateway-webhooks.ledger';
import { refundDue, rejectionOpensAt, rejectionProblem } from './prescription-rejection.policy';
import * as repo from './prescription-rejection.repo';
import { EVIDENCE_CONTENT_TYPES } from './prescription-rejection.schema';
import type {
  EvidenceStoragePort,
  EvidenceUploadUrl,
  RejectInput,
  RejectionBookingRow,
  RejectionNotice,
  RejectionProblem,
  RejectionResult,
} from './prescription-rejection.types';

const CATEGORY = 'prescription-rejection' as const;
const ACCEPTED_TYPES: readonly string[] = EVIDENCE_CONTENT_TYPES;

/** Idempotency key of the refund — one per booking, so a retry can never refund twice. */
export const refundKey = (bookingId: string) => `escrow-refund:invalid-prescription:${bookingId}`;

const PROBLEMS: Record<RejectionProblem, { status: number; message: string }> = {
  NOT_ASSIGNED_NURSE: { status: 403, message: 'Only the nurse assigned to this booking can reject it' },
  PRESCRIPTION_NOT_REQUIRED: { status: 409, message: 'This service has no medical order to reject' },
  ALREADY_CANCELLED: { status: 409, message: 'This booking is already cancelled' },
  BOOKING_NOT_ACTIVE: { status: 409, message: 'Only a confirmed or running shift can be rejected' },
  TOO_EARLY_TO_REJECT: { status: 409, message: 'You can reject the shift only when you are about to start it on site' },
  SHIFT_ALREADY_ENDED: { status: 409, message: 'The shift has already ended' },
};

export interface PrescriptionRejectionDeps {
  storage: EvidenceStoragePort;
  /** Pool, for the read-only checks outside the transaction. */
  db: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  maxUploadBytes: number;
  /** Optional until core/notifications exposes a shared service (same as booking-expiry, matching-radar). */
  notify?: (notice: RejectionNotice) => Promise<void>;
  now?: () => number;
}

export class PrescriptionRejectionService {
  constructor(private readonly deps: PrescriptionRejectionDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  /** Throws the matching AppError when the nurse may not reject this booking right now. */
  private assertAllowed(b: RejectionBookingRow | null, nurseId: string, windowMinutes: number): RejectionBookingRow {
    if (!b) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
    const startMs = new Date(b.start_time).getTime();
    const problem = rejectionProblem(
      {
        nurseId: b.nurse_id,
        executionStatus: b.execution_status,
        isInvasive: b.is_invasive,
        startMs,
        endMs: new Date(b.end_time).getTime(),
      },
      nurseId,
      this.nowMs(),
      windowMinutes,
    );
    if (problem) {
      const { status, message } = PROBLEMS[problem];
      const details = problem === 'TOO_EARLY_TO_REJECT' ? { opensAt: rejectionOpensAt(startMs, windowMinutes).toISOString() } : undefined;
      throw new AppError(status, problem, message, details);
    }
    return b;
  }

  /** POST /bookings/:id/reject-invalid-prescription/evidence-upload-url — presigned PUT for the evidence photo. */
  async requestEvidenceUploadUrl(nurseId: string, bookingId: string, contentType: string): Promise<EvidenceUploadUrl> {
    const windowMinutes = await this.deps.getNumber('PRESCRIPTION_REJECTION_WINDOW_MINUTES');
    this.assertAllowed(await repo.findBooking(this.deps.db, bookingId), nurseId, windowMinutes);
    if (!ACCEPTED_TYPES.includes(contentType)) {
      throw badRequest('CONTENT_TYPE_NOT_ALLOWED', `Evidence accepts ${ACCEPTED_TYPES.join(', ')}`);
    }
    const objectKey = this.deps.storage.buildObjectKey(CATEGORY, nurseId, contentType);
    const url = await this.deps.storage.createUploadUrl(objectKey, contentType);
    return { objectKey, uploadUrl: url.url, expiresInSeconds: url.expiresInSeconds, contentType };
  }

  /** POST /bookings/:id/reject-invalid-prescription */
  async reject(nurseId: string, bookingId: string, input: RejectInput): Promise<RejectionResult> {
    const [windowMinutes, travelSupport] = await Promise.all([
      this.deps.getNumber('PRESCRIPTION_REJECTION_WINDOW_MINUTES'),
      this.deps.getNumber('ICU_TRAVEL_SUPPORT'),
    ]);
    // Cheap checks first (clear errors), then the file, then everything again under the lock.
    this.assertAllowed(await repo.findBooking(this.deps.db, bookingId), nurseId, windowMinutes);
    await this.verifyEvidence(nurseId, input.evidenceKey);

    const now = new Date(this.nowMs());
    const out = await this.deps.withTx(async (db) => {
      const b = this.assertAllowed(await repo.lockBooking(db, bookingId), nurseId, windowMinutes);
      if (!(await repo.cancelForInvalidPrescription(db, b.id, nurseId, now))) {
        throw new AppError(409, 'BOOKING_NOT_ACTIVE', PROBLEMS.BOOKING_NOT_ACTIVE.message);
      }

      let refundedAmount = 0;
      let paymentStatus = b.payment_status;
      if (refundDue(b.payment_status)) {
        const amount = Number(b.total_amount);
        await refundEscrow(db, {
          customerId: b.customer_id,
          bookingId: b.id,
          amount,
          idempotencyKey: refundKey(b.id),
          externalRef: null, // simulated escrow (same as booking-expiry)
        });
        await repo.setRefunded(db, b.id);
        refundedAmount = amount;
        paymentStatus = PaymentStatus.REFUNDED;
      }

      await repo.insertRejection(db, {
        bookingId: b.id,
        nurseId,
        reason: input.reason,
        evidenceKey: input.evidenceKey,
        refundedAmount,
        travelSupportAmount: travelSupport,
      });
      return { booking: b, refundedAmount, paymentStatus };
    });

    await this.notifyCustomer(out.booking, out.refundedAmount);
    return {
      bookingId: out.booking.id,
      executionStatus: 'CANCELLED',
      paymentStatus: out.paymentStatus,
      refundedAmount: out.refundedAmount,
      travelSupportAmount: travelSupport,
      travelSupportStatus: 'PENDING',
    };
  }

  /** Owner, category, exists, size, real image (magic bytes) — the same checks as every other upload. */
  private async verifyEvidence(nurseId: string, key: string): Promise<void> {
    const details = { purpose: 'PRESCRIPTION_REJECTION_EVIDENCE', key };
    if (!storage.objectKeyBelongsTo(key, nurseId) || !key.startsWith(`${CATEGORY}/`)) {
      throw badRequest('INVALID_FILE_KEY', 'File key is not an evidence upload of this account', details);
    }
    const info = await this.deps.storage.statObject(key);
    if (!info) throw badRequest('FILE_NOT_UPLOADED', 'The evidence photo was not uploaded', details);
    if (info.sizeBytes <= 0 || info.sizeBytes > this.deps.maxUploadBytes) {
      throw badRequest('FILE_TOO_LARGE', 'The evidence photo must be between 1 byte and the size limit', details);
    }
    const head = await this.deps.storage.readObjectHead(key);
    const realType = head ? storage.detectContentType(head) : null;
    if (!realType || !ACCEPTED_TYPES.includes(realType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED', 'The evidence must be a JPEG, PNG or WebP photo', details);
    }
  }

  private async notifyCustomer(b: RejectionBookingRow, refundedAmount: number): Promise<void> {
    if (!this.deps.notify) return;
    const refund = refundedAmount > 0 ? ' Số tiền đã thanh toán được hoàn lại 100%.' : '';
    try {
      await this.deps.notify({
        userId: b.customer_id,
        bookingId: b.id,
        title: `Ca ${b.booking_code} đã bị hủy`,
        body: `Điều dưỡng không thể thực hiện ca vì y lệnh của bác sĩ không hợp lệ (giả, bị sửa, hết hạn hoặc thuốc không khớp).${refund} Vui lòng xin y lệnh mới trước khi đặt lại.`,
      });
    } catch (err) {
      console.warn(`[prescription-rejection] notification for ${b.id} failed: ${(err as Error).message}`);
    }
  }
}

let singleton: PrescriptionRejectionService | null = null;

export function getPrescriptionRejectionService(): PrescriptionRejectionService {
  if (!singleton) {
    singleton = new PrescriptionRejectionService({
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: (key, type) => storage.createUploadUrl(key, type),
        statObject: storage.statObject,
        readObjectHead: (key) => storage.readObjectHead(key),
      },
      db: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      getNumber: getConfigNumber,
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
    });
  }
  return singleton;
}
