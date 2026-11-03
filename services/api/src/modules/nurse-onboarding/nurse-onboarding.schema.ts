/** Request validation for nurse-onboarding (strict whitelists). */
import { z } from 'zod';

const UPLOAD_PURPOSES = ['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT', 'DEGREE', 'GPHN', 'RETIREMENT_DECISION'] as const;
const CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/** YYYY-MM-DD that is a real calendar date. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Not a valid calendar date');

const objectKey = z.string().min(10).max(200);
const text = (max: number) => z.string().trim().min(1).max(max);

export const uploadUrlsSchema = z
  .object({
    files: z
      .array(z.object({ purpose: z.enum(UPLOAD_PURPOSES), contentType: z.enum(CONTENT_TYPES) }).strict())
      .min(1)
      .max(6),
  })
  .strict();

export const submitOnboardingSchema = z
  .object({
    cccdNumber: z.string().regex(/^\d{12}$/, 'CCCD number must be 12 digits'),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    yearsOfExp: z.number().int().min(0).max(70),
    identity: z
      .object({ cccdFrontKey: objectKey, cccdBackKey: objectKey, portraitKey: objectKey })
      .strict(),
    degree: z.object({ fileKey: objectKey, issuedDate: isoDate.optional() }).strict(),
    gphn: z
      .object({
        fileKey: objectKey,
        number: text(50),
        issuedDate: isoDate,
        expiryDate: isoDate,
        issuingAuthority: text(255),
        scopeOfPractice: text(255),
      })
      .strict()
      .refine((g) => g.expiryDate > g.issuedDate, { message: 'expiryDate must be after issuedDate', path: ['expiryDate'] })
      .optional(),
    retirementDecision: z.object({ fileKey: objectKey, issuedDate: isoDate.optional() }).strict().optional(),
  })
  .strict();

export type UploadUrlsBody = z.infer<typeof uploadUrlsSchema>;
export type SubmitOnboardingBody = z.infer<typeof submitOnboardingSchema>;
