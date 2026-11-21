import type { ExecutionStatus, UserRole } from '@healthcare-system/shared';
import type { StorageCategory, ObjectInfo, PresignedUrlResult } from '../../core/storage';

/** What `bookings` passes in when a booking is being created (FR-BOOK-02 Layer 1). */
export interface PrescriptionGateInput {
  /** The customer creating the booking — the prescription file must be their own upload. */
  customerId: string;
  /** `service_categories.is_invasive` of the selected service. */
  isInvasive: boolean;
  /** Object key returned by POST /bookings/prescription/upload-url. */
  prescriptionImageKey?: string | null;
  /** Date written on the prescription, YYYY-MM-DD. */
  prescriptionIssuedDate?: string | null;
}

/** Values to store in bookings.prescription_image_url / prescription_issued_date. */
export interface AcceptedPrescription {
  prescriptionImageKey: string;
  prescriptionIssuedDate: string;
}

export type PrescriptionProblem =
  | 'PRESCRIPTION_REQUIRED'
  | 'INVALID_PRESCRIPTION_DATE'
  | 'PRESCRIPTION_DATE_IN_FUTURE'
  | 'PRESCRIPTION_TOO_OLD';

/** Why a viewer may see the prescription. */
export type PrescriptionViewBasis = 'OWNER' | 'ADMIN' | 'ASSIGNED_NURSE' | 'CANDIDATE_NURSE';

export type CandidateDenial = 'NOT_OFFERED' | 'BOOKING_NOT_OPEN' | 'TIER_2_REQUIRED';

export interface PrescriptionViewer {
  id: string;
  role: UserRole;
  ip?: string;
}

export interface PrescriptionUploadUrl {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
  /** The client must send exactly this Content-Type header with the PUT. */
  contentType: string;
}

export interface PrescriptionViewUrl {
  url: string;
  expiresInSeconds: number;
  basis: PrescriptionViewBasis;
  /** YYYY-MM-DD as written on the prescription, for the nurse to compare with the image. */
  issuedDate: string | null;
}

/** bookings columns the gate reads. */
export interface BookingPrescriptionRow {
  customer_id: string;
  nurse_id: string | null;
  execution_status: ExecutionStatus;
  prescription_image_url: string | null;
  prescription_issued_date: string | null;
}

export interface CandidateFacts {
  hasOpenOffer: boolean;
  tier2Valid: boolean;
}

/** The parts of core/storage this module uses (injected so tests need no S3). */
export interface PrescriptionStoragePort {
  buildObjectKey(category: StorageCategory, ownerUserId: string, contentType: string): string;
  createUploadUrl(objectKey: string, contentType: string): Promise<PresignedUrlResult>;
  createDownloadUrl(objectKey: string): Promise<PresignedUrlResult>;
  statObject(objectKey: string): Promise<ObjectInfo | null>;
  readObjectHead(objectKey: string): Promise<Buffer | null>;
}
