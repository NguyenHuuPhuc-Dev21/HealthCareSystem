/** Request validation for prescription-gate (strict whitelist). */
import { z } from 'zod';

/** A prescription is a photo or a scan. */
export const PRESCRIPTION_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

export const prescriptionUploadUrlSchema = z.object({ contentType: z.enum(PRESCRIPTION_CONTENT_TYPES) }).strict();

export type PrescriptionUploadUrlBody = z.infer<typeof prescriptionUploadUrlSchema>;
