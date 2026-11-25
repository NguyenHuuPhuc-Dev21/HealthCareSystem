/**
 * check-in — types (BE-2 · Phase 4 · FR-SHIFT-01).
 */
import type { ObjectInfo } from '../../core/storage';

export type CheckInProblem =
  | 'NOT_ASSIGNED_NURSE'
  | 'ALREADY_CHECKED_IN'
  | 'BOOKING_NOT_CONFIRMED'
  | 'TOO_EARLY_TO_CHECK_IN'
  | 'SHIFT_ALREADY_ENDED';

export type SelfieProblem = 'SELFIE_NOT_ISSUED' | 'SELFIE_EXPIRED' | 'SELFIE_ALREADY_USED';

export type AttemptOutcome = 'ACCEPTED' | 'MOCK_LOCATION_DETECTED' | 'OUT_OF_RADIUS' | 'INVALID_SELFIE';

export interface SelfieUploadRow {
  object_key: string;
  booking_id: string;
  nurse_id: string;
  content_type: string;
  issued_at: Date;
  used_at: Date | null;
}

export interface CheckInInput {
  latitude: number;
  longitude: number;
  isMockLocation: boolean;
  selfieKey: string;
  accuracyMeters?: number;
}

/** Storage operations used here (injected; tests pass a fake). */
export interface SelfieStoragePort {
  buildObjectKey(category: 'checkin-selfie', ownerUserId: string, contentType: string): string;
  createUploadUrl(key: string, contentType: string): Promise<{ url: string; expiresInSeconds: number }>;
  statObject(key: string): Promise<ObjectInfo | null>;
  readObjectHead(key: string): Promise<Buffer | null>;
}

/** Live camera photos only: JPEG (all phone cameras), plus PNG/WebP for web capture. No PDF. */
export const SELFIE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
