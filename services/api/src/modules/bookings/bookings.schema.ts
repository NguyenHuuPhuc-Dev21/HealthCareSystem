/** Request validation for bookings (strict whitelists; the client never sends amounts). BE-2 · Phase 3. */
import { z } from 'zod';
import { isoDate } from '../nurse-onboarding/nurse-onboarding.schema';

const isoInstant = z
  .string()
  .max(40)
  .refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v)), 'Must be an ISO-8601 date-time');

const slotShape = {
  serviceCode: z.string().trim().min(1).max(50),
  patientProfileId: z.string().uuid(),
  startAt: isoInstant,
  endAt: isoInstant,
};

export const quoteSchema = z.object(slotShape).strict();

export const createBookingSchema = z
  .object({
    ...slotShape,
    paymentMethod: z.enum(['BANK_TRANSFER', 'CASH']),
    prescription: z.object({ imageKey: z.string().min(10).max(200), issuedDate: isoDate }).strict().optional(),
    invitedNurseId: z.string().uuid().optional(),
  })
  .strict();

export const prescriptionUploadSchema = z
  .object({ contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) })
  .strict();

export const bookingIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export type QuoteBody = z.infer<typeof quoteSchema>;
export type CreateBookingBody = z.infer<typeof createBookingSchema>;
export type PrescriptionUploadBody = z.infer<typeof prescriptionUploadSchema>;
