/** Request validation for patient-profiles (strict whitelists). BE-2 · Phase 1. */
import { z } from 'zod';
import { isoDate } from '../nurse-onboarding/nurse-onboarding.schema';

const uuid = z.string().uuid();
const objectKey = z.string().min(10).max(200);
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

// ---- Customer eKYC ------------------------------------------------------------

export const ekycUploadUrlsSchema = z
  .object({
    files: z
      .array(
        z.object({ purpose: z.enum(['CCCD_FRONT', 'CCCD_BACK', 'PORTRAIT']), contentType: z.enum(IMAGE_TYPES) }).strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export const submitEkycSchema = z
  .object({
    cccdNumber: z.string().regex(/^\d{12}$/, 'CCCD number must be 12 digits'),
    identity: z.object({ cccdFrontKey: objectKey, cccdBackKey: objectKey, portraitKey: objectKey }).strict(),
  })
  .strict();

export const reviewEkycSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().trim().min(5).max(500).optional(),
  })
  .strict()
  .refine((b) => b.decision === 'APPROVED' || b.rejectionReason, {
    message: 'rejectionReason is required when eKYC is rejected',
    path: ['rejectionReason'],
  });

export const customerIdParamSchema = z.object({ id: uuid }).strict();

export const queueQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

// ---- Patient profiles -----------------------------------------------------------

const profileShape = {
  fullName: z.string().trim().min(1).max(150),
  dob: isoDate.nullable().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).nullable().optional(),
  weightKg: z.number().positive().max(400).nullable().optional(), // stored NUMERIC(5,1): rounded to 0.1 kg
  mobilityStatus: z.enum(['NORMAL', 'PARTIAL', 'BEDRIDDEN']).default('NORMAL'),
  medicalHistory: z.string().trim().max(5000).nullable().optional(),
  isInfectious: z.boolean().default(false),
  addressText: z.string().trim().min(1).max(500),
  locationType: z.enum(['HOME', 'HOSPITAL']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

/**
 * `dataConsentAccepted` is checked by privacy-consent's captureConsent (BE-3), which answers
 * 400 CONSENT_REQUIRED unless it is exactly `true` — so the schema lets any value through.
 */
export const createProfileSchema = z.object({ ...profileShape, dataConsentAccepted: z.unknown() }).strict();

/** PATCH: any subset of the profile fields; consent is NOT editable here (privacy-consent owns it). */
export const updateProfileSchema = z
  .object({
    fullName: profileShape.fullName.optional(),
    dob: profileShape.dob,
    gender: profileShape.gender,
    weightKg: profileShape.weightKg,
    mobilityStatus: z.enum(['NORMAL', 'PARTIAL', 'BEDRIDDEN']).optional(),
    medicalHistory: profileShape.medicalHistory,
    isInfectious: z.boolean().optional(),
    addressText: profileShape.addressText.optional(),
    locationType: profileShape.locationType.optional(),
    lat: profileShape.lat.optional(),
    lng: profileShape.lng.optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Send at least one field to change' })
  .refine((b) => (b.lat === undefined) === (b.lng === undefined), {
    message: 'lat and lng must be changed together',
    path: ['lat'],
  });

export const profileIdParamSchema = z.object({ profileId: uuid }).strict();

export type EkycUploadUrlsBody = z.infer<typeof ekycUploadUrlsSchema>;
export type SubmitEkycBody = z.infer<typeof submitEkycSchema>;
export type ReviewEkycBody = z.infer<typeof reviewEkycSchema>;
export type CreateProfileBody = z.infer<typeof createProfileSchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
