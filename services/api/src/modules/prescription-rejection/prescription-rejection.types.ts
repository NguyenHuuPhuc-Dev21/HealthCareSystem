import type { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';
import type { ObjectInfo, PresignedUrlResult, StorageCategory } from '../../core/storage';

/** The booking as the rejection reads it (locked FOR UPDATE inside the transaction). */
export type RejectionBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: ExecutionStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  start_time: Date;
  end_time: Date;
  total_amount: string | number;
  is_invasive: boolean;
};

/** Why the rejection is refused (HTTP 409 unless noted). */
export type RejectionProblem =
  | 'NOT_ASSIGNED_NURSE' // 403
  | 'PRESCRIPTION_NOT_REQUIRED'
  | 'ALREADY_CANCELLED'
  | 'BOOKING_NOT_ACTIVE'
  | 'TOO_EARLY_TO_REJECT'
  | 'SHIFT_ALREADY_ENDED';

export interface RejectionFacts {
  nurseId: string | null;
  executionStatus: ExecutionStatus;
  isInvasive: boolean;
  startMs: number;
  endMs: number;
}

export interface RejectInput {
  reason: string;
  evidenceKey: string;
}

export interface RejectionResult {
  bookingId: string;
  executionStatus: 'CANCELLED';
  paymentStatus: PaymentStatus;
  /** 0 for a cash booking (nothing was held). */
  refundedAmount: number;
  /** Owed to the nurse from the operations fund; paid by wallets-ledger (BE-3). */
  travelSupportAmount: number;
  travelSupportStatus: 'PENDING';
}

export interface EvidenceUploadUrl {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  /** The client must send exactly this Content-Type header with the PUT. */
  contentType: string;
}

export interface RejectionNotice {
  userId: string;
  bookingId: string;
  title: string;
  body: string;
}

/** The parts of core/storage this module uses (injected so tests need no S3). */
export interface EvidenceStoragePort {
  buildObjectKey(category: StorageCategory, ownerUserId: string, contentType: string): string;
  createUploadUrl(objectKey: string, contentType: string): Promise<PresignedUrlResult>;
  statObject(objectKey: string): Promise<ObjectInfo | null>;
  readObjectHead(objectKey: string): Promise<Buffer | null>;
}
