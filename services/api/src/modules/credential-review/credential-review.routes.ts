/**
 * Routes for credential-review (mounted at /api/v1). Contract: docs/api/credential-review.api.md
 * Admin routes require an ADMIN session — which only exists after TOTP 2FA (accounts-otp).
 */
import { Router } from 'express';
import type { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import {
  gphnRenewalSchema,
  nurseIdParamSchema,
  queueQuerySchema,
  verifySchema,
  type GphnRenewalBody,
  type VerifyBody,
} from './credential-review.schema';
import type { CredentialReviewService } from './credential-review.service';

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createCredentialReviewRouter(service: CredentialReviewService): Router {
  const router = Router();
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/admin/nurses/verification-queue',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const q = parseOrThrow(queueQuerySchema, req.query);
      res.json({ success: true, data: { items: await service.listQueue(q.limit, q.offset), limit: q.limit, offset: q.offset } });
    }),
  );

  router.get(
    '/admin/nurses/:id/dossier',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(nurseIdParamSchema, req.params);
      res.json({ success: true, data: await service.getDossier(id) });
    }),
  );

  // SRS §8
  router.patch(
    '/admin/nurses/:id/verify',
    ...adminOnly,
    validateBody(verifySchema),
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(nurseIdParamSchema, req.params);
      const data = await service.verify(req.user!.id, id, req.body as VerifyBody, req.ip ?? null);
      res.json({ success: true, data });
    }),
  );

  // SRS §8
  router.put(
    '/nurse/credentials/gphn',
    ...nurseOnly,
    validateBody(gphnRenewalSchema),
    asyncHandler(async (req, res) => {
      await service.submitGphnRenewal(req.user!.id, req.body as GphnRenewalBody);
      res.status(202).json({ success: true, data: { status: 'PENDING_REVIEW' } });
    }),
  );

  return router;
}
