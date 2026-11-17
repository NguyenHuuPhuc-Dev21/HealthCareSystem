/**
 * Routes for nurse-search (mounted at /api/v1). Contract: docs/api/nurse-search.api.md
 * BE-3 · Phase 2 · FR-SEARCH-01. PATIENT only.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import { nurseIdParamSchema, searchQuerySchema } from './nurse-search.schema';
import type { NurseSearchService } from './nurse-search.service';

export function createNurseSearchRouter(service: NurseSearchService): Router {
  const router = Router();
  const patientOnly = [authGuard, roleGuard([UserRole.PATIENT])];

  // Must stay ABOVE /nurses/:nurseId, otherwise "search" would be read as an id.
  router.get(
    '/nurses/search',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) throw badRequest('VALIDATION_ERROR', 'Search query is invalid', parsed.error.flatten());
      res.json({ success: true, data: await service.search(parsed.data) });
    }),
  );

  router.get(
    '/nurses/:nurseId',
    ...patientOnly,
    asyncHandler(async (req, res) => {
      const parsed = nurseIdParamSchema.safeParse(req.params);
      if (!parsed.success) throw badRequest('VALIDATION_ERROR', 'nurseId must be a UUID', parsed.error.flatten());
      res.json({ success: true, data: await service.getProfile(parsed.data.nurseId) });
    }),
  );

  return router;
}
