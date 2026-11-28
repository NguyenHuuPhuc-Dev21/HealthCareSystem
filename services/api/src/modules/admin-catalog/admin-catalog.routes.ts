/**
 * Routes for admin-catalog (mounted at /api/v1). Contract: docs/api/admin-catalog.api.md
 * Paths, bodies and replies follow admin-web (features/catalog/catalog.api.ts, camelCase).
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import {
  createServiceSchema,
  serviceIdParamSchema,
  updateServiceSchema,
  type CreateServiceBody,
  type UpdateServiceBody,
} from './admin-catalog.schema';
import type { AdminCatalogService } from './admin-catalog.service';

export function createAdminCatalogRouter(service: AdminCatalogService): Router {
  const router = Router();
  const adminOnly = [authGuard, roleGuard([UserRole.ADMIN])];

  router.get(
    '/admin/services/categories',
    ...adminOnly,
    asyncHandler(async (_req, res) => {
      res.json({ success: true, data: await service.list() });
    }),
  );

  router.post(
    '/admin/services/categories',
    ...adminOnly,
    validateBody(createServiceSchema),
    asyncHandler(async (req, res) => {
      const data = await service.create(req.user!.id, req.body as CreateServiceBody, req.ip ?? null);
      res.status(201).json({ success: true, data });
    }),
  );

  router.patch(
    '/admin/services/categories/:id',
    ...adminOnly,
    validateBody(updateServiceSchema),
    asyncHandler(async (req, res) => {
      const id = serviceIdParamSchema.safeParse(req.params.id);
      if (!id.success) throw notFound('SERVICE_NOT_FOUND', 'Service not found');
      res.json({ success: true, data: await service.update(req.user!.id, id.data, req.body as UpdateServiceBody, req.ip ?? null) });
    }),
  );

  return router;
}
