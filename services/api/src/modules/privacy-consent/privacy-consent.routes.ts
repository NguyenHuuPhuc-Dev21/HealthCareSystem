/**
 * Routes for privacy-consent (mounted at /api/v1). Contract: docs/api/privacy-consent.api.md
 * BE-3 · Phase 1 · FR-PRIV-01 · NFR-PRIV-01 · US-HP-18 · US-HP-28 · US-HP-03.
 */
import { Router } from "express";
import type { z } from "zod";
import { UserRole } from "@healthcare-system/shared";
import { badRequest } from "../../core/errors";
import { asyncHandler, authGuard, roleGuard } from "../../core/middleware";
import {
  bookingIdParamSchema,
  createPrivacyRequestBodySchema,
  decidePrivacyRequestBodySchema,
  grantRecordAccessBodySchema,
  listPrivacyRequestsQuerySchema,
  requestIdParamSchema,
} from "./privacy-consent.schema";
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
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];
  const patientOnly = [authGuard, roleGuard([UserRole.PATIENT])];

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

  // Contract §3 — Admin re-grant, audit GRANT_RECORD_ACCESS.
  router.post(
    "/admin/bookings/:bookingId/record-access-grants",
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const { bookingId } = parseOrThrow(bookingIdParamSchema, req.params);
      const body = parseOrThrow(grantRecordAccessBodySchema, req.body);
      const data = await service.grantRecordAccess(
        req.user!.id,
        bookingId,
        {
          nurseId: body.nurseId,
          reason: body.reason,
          expiresAt: new Date(body.expiresAt),
        },
        req.ip ?? null,
      );
      res.status(201).json({ success: true, data });
    }),
  );

  // Contract §4 — the owner withdraws consent (wrong owner / bad id → 403 FORBIDDEN).
  router.post(
    "/patient-profiles/:profileId/consent/withdraw",
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const data = await service.withdrawConsent(
        req.user!.id,
        req.params.profileId,
      );
      res.json({ success: true, data });
    }),
  );

  // Contract §4 — data-subject requests (PATIENT creates, ADMIN decides).
  router.post(
    "/privacy-requests",
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const body = parseOrThrow(createPrivacyRequestBodySchema, req.body);
      const data = await service.createPrivacyRequest(
        req.user!.id,
        body.patientProfileId,
        body.requestType,
      );
      res.status(201).json({ success: true, data });
    }),
  );

  router.get(
    "/privacy-requests",
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const data = await service.listMyPrivacyRequests(req.user!.id);
      res.json({ success: true, data });
    }),
  );

  router.get(
    "/admin/privacy-requests",
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const q = parseOrThrow(listPrivacyRequestsQuerySchema, req.query);
      const data = await service.listPrivacyRequests({
        status: q.status ?? null,
        limit: q.limit,
        offset: q.offset,
      });
      res.json({ success: true, data });
    }),
  );

  router.patch(
    "/admin/privacy-requests/:requestId",
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const { requestId } = parseOrThrow(requestIdParamSchema, req.params);
      const body = parseOrThrow(decidePrivacyRequestBodySchema, req.body);
      const note = body.note && body.note !== "" ? body.note : null;
      const data = await service.decidePrivacyRequest(
        req.user!.id,
        requestId,
        body.decision,
        note,
        req.ip ?? null,
      );
      res.json({ success: true, data });
    }),
  );

  return router;
}
