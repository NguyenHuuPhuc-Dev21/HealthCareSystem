/**
 * Routes for prescription-gate (mounted at /api/v1). Contract: docs/api/prescription-gate.api.md
 * Layer 2 only. No business logic here — who may see a prescription is decided in the service.
 */
import { Router } from 'express';
import { asyncHandler, authGuard } from '../../core/middleware';
import type { PrescriptionGateService } from './prescription-gate.service';

export function createPrescriptionGateRouter(service: PrescriptionGateService): Router {
  const router = Router();

  // Layer 1 has no route here: the upload link is POST /bookings/prescription/upload-url (bookings, BE-2).

  // Layer 2 — customer, Admin, assigned nurse, or a Tier 2 nurse holding a live offer.
  router.get(
    '/bookings/:id/prescription',
    authGuard,
    asyncHandler(async (req, res) => {
      const viewer = { id: req.user!.id, role: req.user!.role, ...(req.ip ? { ip: req.ip } : {}) };
      res.json({ success: true, data: await service.getViewUrl(viewer, String(req.params.id)) });
    }),
  );

  return router;
}
