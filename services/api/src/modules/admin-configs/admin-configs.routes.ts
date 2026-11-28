/**
 * Routes for admin-configs (mounted at /api/v1). Contract: docs/api/admin-configs.api.md
 * Paths and body follow what admin-web already calls (features/configs/configs.api.ts).
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { configKeyParamSchema, updateConfigSchema, type UpdateConfigBody } from './admin-configs.schema';
import type { AdminConfigsService } from './admin-configs.service';

export function createAdminConfigsRouter(service: AdminConfigsService): Router {
  const router = Router();
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];

  router.get(
    '/admin/configs',
    ...adminOnly,
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await service.list() });
    }),
  );

  router.patch(
    '/admin/configs/:key',
    ...adminOnly,
    validateBody(updateConfigSchema),
    asyncHandler(async (req, res) => {
      const key = configKeyParamSchema.safeParse(req.params.key);
      if (!key.success) throw notFound('CONFIG_NOT_FOUND', 'No such configuration key');
      const body = req.body as UpdateConfigBody;
      res.json({ success: true, data: await service.update(req.user!.id, key.data, body.config_value, req.ip ?? null) });
    }),
  );

  return router;
}
