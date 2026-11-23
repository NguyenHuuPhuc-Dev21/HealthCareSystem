/**
 * Routes for reviews-trustscore (mounted at /api/v1). Contract: docs/api/reviews-trustscore.api.md
 * No business logic here. Paths follow what patient-web and nurse-web already call.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { submitReviewSchema, type SubmitReviewBody } from './reviews-trustscore.schema';
import type { ReviewsService } from './reviews-trustscore.service';

export function createReviewsRouter(service: ReviewsService): Router {
  const router = Router();
  const nurse = [authGuard, roleGuard([UserRole.NURSE])];

  router.post(
    '/bookings/:id/reviews',
    authGuard,
    roleGuard([UserRole.PATIENT, UserRole.NURSE]),
    validateBody(submitReviewSchema),
    asyncHandler(async (req, res) => {
      const data = await service.submit(req.user!, String(req.params.id), req.body as SubmitReviewBody);
      res.status(201).json({ success: true, data });
    }),
  );

  router.get(
    '/nurse/reviews/pending',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.pendingForNurse(req.user!.id) });
    }),
  );

  router.get(
    '/nurse/reviews/sent',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.sentBy(req.user!.id) });
    }),
  );

  router.get(
    '/nurse/reviews/received',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.receivedBy(req.user!.id) });
    }),
  );

  router.get(
    '/nurse/trust-score',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.trustScore(req.user!.id) });
    }),
  );

  return router;
}
