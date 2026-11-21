/**
 * Routes for prescription-gate (mounted at /api/v1). Contract: docs/api/prescription-gate.api.md
 * No business logic here — who may see a prescription is decided in the service.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { prescriptionUploadUrlSchema, type PrescriptionUploadUrlBody } from './prescription-gate.schema';
import type { PrescriptionGateService } from './prescription-gate.service';

export function createPrescriptionGateRouter(service: PrescriptionGateService): Router {
  const router = Router();

  // Layer 1 — the customer uploads the prescription before creating the booking.
  router.post(
    '/bookings/prescription/upload-url',
    authGuard,
    roleGuard([UserRole.PATIENT]),
    validateBody(prescriptionUploadUrlSchema),
    asyncHandler(async (req, res) => {
      const body = req.body as PrescriptionUploadUrlBody;
      res.json({ success: true, data: await service.requestUploadUrl(req.user!.id, body.contentType) });
    }),
  );

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
