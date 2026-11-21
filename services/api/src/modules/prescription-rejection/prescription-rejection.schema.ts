/** Request validation for prescription-rejection (strict whitelists). */
import { z } from 'zod';

/** Evidence is a photo taken on site. */
export const EVIDENCE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const evidenceUploadUrlSchema = z.object({ contentType: z.enum(EVIDENCE_CONTENT_TYPES) }).strict();

export const rejectPrescriptionSchema = z
  .object({
    /** What is wrong with the order (forged, altered, expired, medication does not match …). */
    reason: z.string().trim().min(10).max(1000),
    /** objectKey returned by …/evidence-upload-url. */
    evidenceKey: z.string().min(10).max(200),
  })
  .strict();

export const bookingIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export type EvidenceUploadUrlBody = z.infer<typeof evidenceUploadUrlSchema>;
export type RejectPrescriptionBody = z.infer<typeof rejectPrescriptionSchema>;
