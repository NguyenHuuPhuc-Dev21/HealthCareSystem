/**
 * Routes for shift-logs (mounted at /api/v1). Contract: docs/api/shift-execution.api.md §3–§5.
 * BE-2 · Phase 4 · FR-SHIFT-02. Paths follow what nurse-app, nurse-web and patient-web already call.
 * No business logic here.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { notFound } from '../../core/errors';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import {
  activityBodySchema,
  activityParamSchema,
  addVitalsSchema,
  assessmentSchema,
  bookingIdParamSchema,
  listShiftsQuerySchema,
  noteSchema,
  refuseSchema,
  respondSurchargeSchema,
  type AddVitalsBody,
  type AssessmentBody,
  type NoteBody,
} from './shift-logs.schema';
import type { ShiftLogsService } from './shift-logs.service';

function bookingId(params: unknown): string {
  const parsed = bookingIdParamSchema.safeParse({ id: (params as { id?: string }).id });
  if (!parsed.success) throw notFound('BOOKING_NOT_FOUND', 'Booking not found');
  return parsed.data.id;
}

export function createShiftLogsRouter(service: ShiftLogsService, opts: { simulator?: boolean } = {}): Router {
  const router = Router();
  const nurse = [authGuard, roleGuard([UserRole.NURSE])];
  const customer = [authGuard, roleGuard([UserRole.PATIENT])];

  router.get(
    '/nurse/shifts',
    ...nurse,
    asyncHandler(async (req, res) => {
      const q = listShiftsQuerySchema.safeParse(req.query);
      res.json({ success: true, data: await service.listMyShifts(req.user!.id, q.success ? q.data.status : undefined) });
    }),
  );

  router.get(
    '/bookings/:id/shift-state',
    ...nurse,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.shiftState(req.user!.id, bookingId(req.params)) });
    }),
  );

  router.post(
    '/bookings/:id/assessment',
    ...nurse,
    validateBody(assessmentSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as AssessmentBody;
      res.json({ success: true, data: await service.submitAssessment(req.user!.id, bookingId(req.params), b) });
    }),
  );

  router.post(
    '/bookings/:id/vitals',
    ...nurse,
    validateBody(addVitalsSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as AddVitalsBody;
      res.status(201).json({ success: true, data: await service.addVitals(req.user!.id, bookingId(req.params), b.vitals) });
    }),
  );

  const toggle = asyncHandler(async (req, res) => {
    const p = activityParamSchema.safeParse(req.params);
    if (!p.success) throw notFound('ACTIVITY_NOT_FOUND', 'Care activity not found');
    const completed = (req.body as { completed: boolean }).completed;
    res.json({ success: true, data: await service.setActivity(req.user!.id, p.data.id, p.data.activityId, completed) });
  });
  router.patch('/bookings/:id/activities/:activityId', ...nurse, validateBody(activityBodySchema), toggle);
  router.post('/bookings/:id/activities/:activityId', ...nurse, validateBody(activityBodySchema), toggle); // offline queue replays as POST

  router.post(
    '/bookings/:id/notes',
    ...nurse,
    validateBody(noteSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as NoteBody;
      res.status(201).json({ success: true, data: await service.addNote(req.user!.id, bookingId(req.params), { id: b.id, text: b.text }) });
    }),
  );

  router.post(
    '/bookings/:id/condition-mismatch/refuse',
    ...nurse,
    validateBody(refuseSchema),
    asyncHandler(async (req, res) => {
      const reason = (req.body as { reason?: string }).reason;
      res.json({ success: true, data: await service.refuse(req.user!.id, bookingId(req.params), reason) });
    }),
  );

  router.get(
    '/bookings/:id/tracking',
    ...customer,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.tracking(req.user!.id, bookingId(req.params)) });
    }),
  );

  router.post(
    '/bookings/:id/condition-surcharge/respond',
    ...customer,
    validateBody(respondSurchargeSchema),
    asyncHandler(async (req, res) => {
      const approved = (req.body as { approved: boolean }).approved;
      res.json({ success: true, data: await service.respondSurcharge(req.user!.id, bookingId(req.params), approved) });
    }),
  );

  // Dev / demo only — mounted when PAYMENT_SIMULATOR_ENABLED=true outside production (same switch as gateway-webhooks).
  if (opts.simulator ?? simulatorEnabled()) {
    router.post(
      '/bookings/:id/condition-surcharge/dev/simulate-payment',
      ...customer,
      asyncHandler(async (req, res) => {
        res.json({ success: true, data: await service.simulateSurchargePayment(req.user!.id, bookingId(req.params)) });
      }),
    );
  }

  return router;
}
