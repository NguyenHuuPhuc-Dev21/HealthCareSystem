/**
 * Routes for privacy-consent (mounted at /api/v1). Contract: docs/api/privacy-consent.api.md
 * BE-3 · Phase 1 · FR-PRIV-01 · US-HP-18.
 */
import { Router } from "express";
import type { z } from "zod";
import { UserRole } from "@healthcare-system/shared";
import { badRequest } from "../../core/errors";
import { asyncHandler, authGuard, roleGuard } from "../../core/middleware";
import { bookingIdParamSchema } from "./privacy-consent.schema";
import type { PrivacyConsentService } from "./privacy-consent.service";

function parseOrThrow<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success)
    throw badRequest("VALIDATION_ERROR", "Invalid request", r.error.flatten());
  return r.data;
}

export function createPrivacyConsentRouter(
  service: PrivacyConsentService,
): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  // Contract §2 — every successful call writes VIEW_MEDICAL_RECORD to audit_logs.
  router.get(
    "/nurse/bookings/:bookingId/medical-record",
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      const { bookingId } = parseOrThrow(bookingIdParamSchema, req.params);
      const data = await service.getMedicalRecord(
        req.user!.id,
        bookingId,
        req.ip ?? null,
      );
      res.json({ success: true, data });
    }),
  );

  return router;
}
