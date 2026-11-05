/**
 * Routes for nurse-onboarding (mounted at /api/v1). Contract: docs/api/nurse-onboarding.api.md
 * Only NURSE accounts; deliberately NOT requireNurseEligibility — a PENDING nurse must reach these.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { submitOnboardingSchema, uploadUrlsSchema, type SubmitOnboardingBody, type UploadUrlsBody } from './nurse-onboarding.schema';
import type { NurseOnboardingService } from './nurse-onboarding.service';

export function createNurseOnboardingRouter(service: NurseOnboardingService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/nurse/onboarding/upload-urls',
    ...nurseOnly,
    validateBody(uploadUrlsSchema),
    asyncHandler(async (req, res) => {
      const data = await service.requestUploadUrls(req.user!.id, req.body as UploadUrlsBody);
      res.json({ success: true, data: { files: data } });
    }),
  );

  // SRS §8 path
  router.post(
    '/auth/nurse-onboarding',
    ...nurseOnly,
    validateBody(submitOnboardingSchema),
    asyncHandler(async (req, res) => {
      const data = await service.submit(req.user!.id, req.body as SubmitOnboardingBody);
      res.status(201).json({ success: true, data });
    }),
  );

  router.get(
    '/nurse/onboarding',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getStatus(req.user!.id) });
    }),
  );

  return router;
}
