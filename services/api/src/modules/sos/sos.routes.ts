/**
 * Routes for sos (mounted at /api/v1). Contract: docs/api/sos.api.md · BE-3 · Phase 4 · FR-SHIFT-05.
 * Paths follow nurse-app features/sos/sos.api.ts and patient-web features/booking-tracking/booking-tracking.api.ts.
 * Body field names of both apps are accepted (lat/lng or latitude/longitude; vitals or currentVitals).
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { badRequest } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import type { SosService } from './sos.service';
import { SOS_OUTCOMES, type SosOutcome } from './sos.types';

const idParam = z.object({ id: z.string().uuid() });
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const raiseBody = z
  .object({
    lat: lat.optional(),
    lng: lng.optional(),
    latitude: lat.optional(),
    longitude: lng.optional(),
    vitals: z.record(z.unknown()).nullable().optional(),
    currentVitals: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();
const listQuery = z.object({ status: z.enum(['OPEN', 'ACTIVE', 'ACKNOWLEDGED', 'CLOSED', 'ALL']).optional() });
const reportBody = z.object({ note: z.string().trim().min(5).max(2000), called115: z.boolean().optional(), hospital: z.string().trim().max(200).nullable().optional() });
const closeBody = z.object({ outcome: z.enum(SOS_OUTCOMES as [SosOutcome, ...SosOutcome[]]), note: z.string().trim().min(10).max(2000) });

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createSosRouter(service: SosService): Router {
  const router = Router();
  const parties = [authGuard, roleGuard([UserRole.NURSE, UserRole.PATIENT])];
  const anyone = [authGuard, roleGuard([UserRole.NURSE, UserRole.PATIENT, UserRole.ADMIN])];
  const admin = [authGuard, roleGuard([UserRole.ADMIN])];

  router.post(
    '/bookings/:id/sos',
    ...parties,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(raiseBody, req.body ?? {});
      const data = await service.raise(req.user!, id, {
        lat: b.lat ?? b.latitude,
        lng: b.lng ?? b.longitude,
        vitals: b.vitals ?? b.currentVitals ?? null,
      });
      res.status(data.created ? 201 : 200).json({ success: true, data });
    }),
  );

  router.get(
    '/bookings/:id/sos',
    ...anyone,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.forBooking(req.user!, id) });
    }),
  );

  router.get(
    '/sos-alerts',
    ...anyone,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.list(req.user!, parse(listQuery, req.query).status) });
    }),
  );

  router.post(
    '/sos-alerts/:id/acknowledge',
    ...anyone,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.acknowledge(req.user!, id) });
    }),
  );

  router.post(
    '/sos-alerts/:id/report',
    authGuard,
    roleGuard([UserRole.NURSE, UserRole.ADMIN]),
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.report(req.user!, id, parse(reportBody, req.body)) });
    }),
  );

  router.get(
    '/admin/sos-alerts',
    ...admin,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.list(req.user!, parse(listQuery, req.query).status) });
    }),
  );

  router.get(
    '/admin/sos-alerts/:id',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.adminDetail(id) });
    }),
  );

  router.post(
    '/admin/sos-alerts/:id/close',
    ...admin,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.close(req.user!.id, id, parse(closeBody, req.body), req.ip ?? undefined) });
    }),
  );

  return router;
}
