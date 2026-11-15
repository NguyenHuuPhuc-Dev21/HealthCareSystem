/**
 * Routes for patient-profiles (mounted at /api/v1). Contract: docs/api/patient-profiles.api.md
 * BE-2 · Phase 1 · FR-AUTH-03 · US-HP-06.
 * PATIENT routes act on req.user.id only; ADMIN routes need a 2FA admin session (accounts-otp).
 */
import { Router } from 'express';
import type { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import {
  createProfileSchema,
  customerIdParamSchema,
  ekycUploadUrlsSchema,
  profileIdParamSchema,
  queueQuerySchema,
  reviewEkycSchema,
  submitEkycSchema,
  updateProfileSchema,
  type CreateProfileBody,
  type EkycUploadUrlsBody,
  type ReviewEkycBody,
  type SubmitEkycBody,
  type UpdateProfileBody,
} from './patient-profiles.schema';
import type { PatientProfilesService } from './patient-profiles.service';

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createPatientProfilesRouter(service: PatientProfilesService): Router {
  const router = Router();
  const patientOnly = [authGuard, roleGuard([UserRole.PATIENT])];
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];

  // ---- Customer eKYC (FR-AUTH-03 §2) ----

  router.post(
    '/patient/ekyc/upload-urls',
    ...patientOnly,
    validateBody(ekycUploadUrlsSchema),
    asyncHandler(async (req, res) => {
      const files = await service.requestEkycUploadUrls(req.user!.id, req.body as EkycUploadUrlsBody);
      res.json({ success: true, data: { files } });
    }),
  );

  router.post(
    '/patient/ekyc',
    ...patientOnly,
    validateBody(submitEkycSchema),
    asyncHandler(async (req, res) => {
      const data = await service.submitEkyc(req.user!.id, req.body as SubmitEkycBody);
      res.status(201).json({ success: true, data });
    }),
  );

  router.get(
    '/patient/ekyc',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getEkycStatus(req.user!.id) });
    }),
  );

  router.get(
    '/admin/customers/ekyc-queue',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const q = parseOrThrow(queueQuerySchema, req.query);
      const items = await service.listEkycQueue(q.limit, q.offset);
      res.json({ success: true, data: { items, limit: q.limit, offset: q.offset } });
    }),
  );

  router.get(
    '/admin/customers/:id/ekyc',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(customerIdParamSchema, req.params);
      res.json({ success: true, data: await service.getEkycDossier(id) });
    }),
  );

  router.patch(
    '/admin/customers/:id/ekyc',
    ...adminOnly,
    validateBody(reviewEkycSchema),
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(customerIdParamSchema, req.params);
      const data = await service.reviewEkyc(req.user!.id, id, req.body as ReviewEkycBody, req.ip ?? null);
      res.json({ success: true, data });
    }),
  );

  // ---- Patient profiles (US-HP-06) ----
  // Consent withdrawal and erasure live in privacy-consent (BE-3):
  //   POST /patient-profiles/:profileId/consent/withdraw · POST /privacy-requests

  router.post(
    '/patient-profiles',
    ...patientOnly,
    validateBody(createProfileSchema),
    asyncHandler(async (req, res) => {
      const data = await service.createProfile(req.user!.id, req.body as CreateProfileBody, {
        ip: req.ip ?? null,
        deviceId: req.get('x-device-id') ?? null,
      });
      res.status(201).json({ success: true, data });
    }),
  );

  router.get(
    '/patient-profiles',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: { items: await service.listProfiles(req.user!.id) } });
    }),
  );

  router.get(
    '/patient-profiles/:profileId',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const { profileId } = parseOrThrow(profileIdParamSchema, req.params);
      res.json({ success: true, data: await service.getProfile(req.user!.id, profileId) });
    }),
  );

  router.patch(
    '/patient-profiles/:profileId',
    ...patientOnly,
    validateBody(updateProfileSchema),
    asyncHandler(async (req, res) => {
      const { profileId } = parseOrThrow(profileIdParamSchema, req.params);
      const data = await service.updateProfile(req.user!.id, profileId, req.body as UpdateProfileBody);
      res.json({ success: true, data });
    }),
  );

  return router;
}
