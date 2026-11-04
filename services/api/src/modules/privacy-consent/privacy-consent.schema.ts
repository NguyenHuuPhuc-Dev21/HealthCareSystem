/**
 * Request validation for privacy-consent routes (whitelist, Zod).
 */
import { z } from "zod";

export const bookingIdParamSchema = z
  .object({ bookingId: z.string().uuid() })
  .strict();

/** Body of POST /admin/bookings/:bookingId/record-access-grants (contract §3). */
export const grantRecordAccessBodySchema = z
  .object({
    nurseId: z.string().uuid(),
    reason: z.string().trim().min(10).max(500),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();
