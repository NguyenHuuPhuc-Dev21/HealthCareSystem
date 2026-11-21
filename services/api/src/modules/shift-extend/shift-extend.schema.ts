/** Request validation for shift-extend (strict whitelists). */
import { z } from 'zod';

/** Whole hours; the upper bound is MAX_EXTENSION_HOURS (system_configs), checked by the service. */
const hours = z.number().int().min(1).max(24);

export const extendSchema = z.object({ hours }).strict();

export const respondSchema = z
  .object({
    extensionId: z.string().uuid(),
    approved: z.boolean(),
    declineReason: z.string().trim().min(1).max(500).optional(),
    /** Sent by the nurse app (redundant with the URL); must match it when present. */
    bookingId: z.string().uuid().optional(),
  })
  .strict();

export const bookingIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export type ExtendBody = z.infer<typeof extendSchema>;
export type RespondBody = z.infer<typeof respondSchema>;
