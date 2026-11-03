/**
 * Request validation for privacy-consent routes (whitelist, Zod).
 */
import { z } from "zod";

export const bookingIdParamSchema = z
  .object({ bookingId: z.string().uuid() })
  .strict();
