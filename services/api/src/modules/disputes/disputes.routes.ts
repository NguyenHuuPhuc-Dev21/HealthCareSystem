/**
 * Routes for disputes (mounted at /api/v1). Contract: docs/api/disputes.api.md
 * BE-3 · Phase 6 · FR-DISP-01/02. Paths follow FE-2 nurse-web / patient-web / admin-web disputes.api.ts.
 * Bodies accept both the camelCase (nurse-web) and the snake_case / `reason` (patient-web) field names.
 */
import { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { DisputesService } from './disputes.service';
import { MAX_EVIDENCE_FILES } from './disputes.types';

const idParam = z.object({ id: z.string().uuid() });
const keys = z.array(z.string().trim().min(1).max(300)).max(MAX_EVIDENCE_FILES);
const text = z.string().trim().min(10).max(2000);

const openBody = z
  .object({
    category: z.string().trim().max(50).optional(),
    description: text.optional(),
    reason: text.optional(), // patient-web
    evidenceUrls: keys.optional(),
    evidence_urls: keys.optional(),
  })
  .refine((b) => b.description ?? b.reason, { message: 'description is required' });

const rebuttalBody = z
  .object({ rebuttal: text.optional(), content: text.optional(), evidence_urls: keys.optional(), evidenceUrls: keys.optional() })
  .refine((b) => b.rebuttal ?? b.content, { message: 'rebuttal is required' });

const uploadBody = z.object({ file_names: z.array(z.string().trim().min(1).max(200)).min(1).max(MAX_EVIDENCE_FILES) });

const resolveBody = z.object({
  resolution: z.enum(['RESOLVED_CUSTOMER', 'RESOLVED_NURSE']),
  notes: z.string().trim().min(10).max(2000),
  depositDeduction: z.number().int().min(0).optional(),
});

const adminQuery = z.object({ status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED_CUSTOMER', 'RESOLVED_NURSE']).optional() });

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createDisputesRouter(service: DisputesService): Router {
  const router = Router();
  const parties = [authGuard, roleGuard([UserRole.NURSE, UserRole.PATIENT])];

  router.post(
    '/bookings/:id/disputes',
    ...parties,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(openBody, req.body);
      const data = await service.open(req.user!.id, id, {
        category: b.category,
        description: (b.description ?? b.reason)!,
        evidenceKeys: b.evidenceUrls ?? b.evidence_urls ?? [],
      });
      res.status(201).json({ success: true, data });
    }),
  );

  router.post(
    '/disputes/:id/evidence-upload-urls',
    ...parties,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const { file_names } = parse(uploadBody, req.body);
      res.json({ success: true, data: await service.evidenceUploadUrls(req.user!.id, id, file_names) });
    }),
  );

  router.post(
    '/disputes/:id/rebuttal',
    ...parties,
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(rebuttalBody, req.body);
      res.json({ success: true, data: await service.rebut(req.user!.id, id, (b.rebuttal ?? b.content)!, b.evidence_urls ?? b.evidenceUrls ?? []) });
    }),
  );

  router.get(
    '/nurse/disputes',
    authGuard,
    roleGuard([UserRole.NURSE]),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listForNurse(req.user!.id) });
    }),
  );

  router.get(
    '/patient/disputes',
    authGuard,
    roleGuard([UserRole.PATIENT]),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.listForCustomer(req.user!.id) });
    }),
  );

  router.get(
    '/disputes/:id',
    authGuard,
    roleGuard([UserRole.NURSE, UserRole.PATIENT, UserRole.ADMIN]),
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      res.json({ success: true, data: await service.get(req.user!.id, req.user!.role === UserRole.ADMIN, id) });
    }),
  );

  router.get(
    '/admin/disputes',
    authGuard,
    roleGuard([UserRole.ADMIN]),
    asyncHandler(async (req, res) => {
      const q = parse(adminQuery, req.query);
      res.json({ success: true, data: await service.listForAdmin(q.status ?? null) });
    }),
  );

  router.patch(
    '/admin/disputes/:id/resolve',
    authGuard,
    roleGuard([UserRole.ADMIN]),
    asyncHandler(async (req, res) => {
      const { id } = parse(idParam, req.params);
      const b = parse(resolveBody, req.body);
      res.json({ success: true, data: await service.resolve(req.user!.id, id, b, req.ip) });
    }),
  );

  return router;
}
