/**
 * Routes for admin-users (mounted at /api/v1). Contract: docs/api/admin-users.api.md · BE-2 · Phase 7 · FR-ADMIN-01.
 * Paths follow apps/admin-web features/users/users.api.ts. ADMIN sessions exist only after TOTP 2FA (accounts-otp).
 */
import { Router } from 'express';
import type { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { listQuerySchema, setStatusSchema, userIdParamSchema, type SetStatusBody } from './admin-users.schema';
import type { AdminUsersService } from './admin-users.service';

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createAdminUsersRouter(service: AdminUsersService): Router {
  const router = Router();
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];

  router.get(
    '/admin/users',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.list(parseOrThrow(listQuerySchema, req.query)) });
    }),
  );

  router.get(
    '/admin/users/:id',
    ...adminOnly,
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(userIdParamSchema, req.params);
      res.json({ success: true, data: await service.detail(id) });
    }),
  );

  router.patch(
    '/admin/users/:id/status',
    ...adminOnly,
    validateBody(setStatusSchema),
    asyncHandler(async (req, res) => {
      const { id } = parseOrThrow(userIdParamSchema, req.params);
      res.json({ success: true, data: await service.setStatus(req.user!.id, id, req.body as SetStatusBody, req.ip ?? null) });
    }),
  );

  return router;
}
