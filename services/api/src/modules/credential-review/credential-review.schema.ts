import { z } from 'zod';
import { isoDate } from '../nurse-onboarding/nurse-onboarding.schema';

const uuid = z.string().uuid();

export const nurseIdParamSchema = z.object({ id: uuid }).strict();

export const queueQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const verifySchema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            credentialId: uuid,
            decision: z.enum(['APPROVED', 'REJECTED']),
            rejectionReason: z.string().trim().min(5).max(500).optional(),
          })
          .strict()
          .refine((d) => d.decision === 'APPROVED' || d.rejectionReason, {
            message: 'rejectionReason is required when a document is rejected',
            path: ['rejectionReason'],
          }),
      )
      .min(1)
      .max(20),
  })
  .strict();

export const gphnRenewalSchema = z
  .object({
    fileKey: z.string().min(10).max(200),
    number: z.string().trim().min(1).max(50),
    issuedDate: isoDate,
    expiryDate: isoDate,
    issuingAuthority: z.string().trim().min(1).max(255),
    scopeOfPractice: z.string().trim().min(1).max(255),
  })
  .strict()
  .refine((g) => g.expiryDate > g.issuedDate, { message: 'expiryDate must be after issuedDate', path: ['expiryDate'] });

export type VerifyBody = z.infer<typeof verifySchema>;
export type GphnRenewalBody = z.infer<typeof gphnRenewalSchema>;
