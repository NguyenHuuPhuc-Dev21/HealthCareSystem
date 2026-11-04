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

/** Body of POST /privacy-requests (contract §4). */
export const createPrivacyRequestBodySchema = z
  .object({
    patientProfileId: z.string().uuid(),
    requestType: z.enum(["DELETE", "ANONYMIZE"]),
  })
  .strict();

/** Query of GET /admin/privacy-requests. */
export const listPrivacyRequestsQuerySchema = z
  .object({
    status: z.enum(["PENDING", "DONE", "REJECTED"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const requestIdParamSchema = z
  .object({ requestId: z.string().uuid() })
  .strict();

/** Body of PATCH /admin/privacy-requests/:requestId (contract §4). */
export const decidePrivacyRequestBodySchema = z
  .object({
    decision: z.enum(["DONE", "REJECTED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
