/**
 * Routes for nurse-availabilities (mounted at /api/v1). Contract: docs/api/nurse-availabilities.api.md
 * BE-2 · Phase 2 · FR-SCHED-01. NURSE only, always on the caller's own schedule (req.user.id).
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { putAvailabilitiesSchema, type PutAvailabilitiesBody } from './nurse-availabilities.schema';
import type { NurseAvailabilitiesService } from './nurse-availabilities.service';

export function createNurseAvailabilitiesRouter(service: NurseAvailabilitiesService): Router {
  const router = Router();
  const nurseOnly = [authGuard, roleGuard([UserRole.NURSE])];

  router.get(
    '/nurse/availabilities',
    ...nurseOnly,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getSchedule(req.user!.id) });
    }),
  );

  router.put(
    '/nurse/availabilities',
    ...nurseOnly,
    validateBody(putAvailabilitiesSchema),
    asyncHandler(async (req, res) => {
      const data = await service.replaceSchedule(req.user!.id, req.body as PutAvailabilitiesBody);
      res.json({ success: true, data });
    }),
  );

  return router;
}
