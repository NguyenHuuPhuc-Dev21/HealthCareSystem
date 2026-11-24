/**
 * Routes for notifications (mounted at /api/v1). Contract: docs/api/notifications.api.md
 * BE-3 · Phase 6 · FR-NOTIF-01. Paths follow nurse-web features/notifications/notifications.api.ts.
 * Every signed-in user (nurse, customer, admin) has an inbox.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, authGuard } from '../../core/middleware';
import { badRequest } from '../../core/errors';
import type { NotificationsService } from './notifications.service';
import { MAX_PAGE_SIZE } from './notifications.types';

const idParam = z.object({ id: z.string().uuid() });
const listQuery = z.object({
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
});

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) throw badRequest('VALIDATION_ERROR', 'Invalid request', r.error.flatten());
  return r.data;
}

export function createNotificationsRouter(service: NotificationsService): Router {
  const router = Router();

  router.get(
    '/notifications',
    authGuard,
    asyncHandler(async (req, res) => {
      const q = parse(listQuery, req.query);
      res.json({ success: true, data: await service.list(req.user!.id, { cursor: q.cursor, limit: q.limit, unreadOnly: q.unreadOnly === 'true' }) });
    }),
  );

  router.get(
    '/notifications/unread-count',
    authGuard,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.unreadCount(req.user!.id) });
    }),
  );

  router.post(
    '/notifications/read-all',
    authGuard,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.markAllRead(req.user!.id) });
    }),
  );

  for (const action of ['read', 'ack'] as const) {
    router.post(
      `/notifications/:id/${action}`,
      authGuard,
      asyncHandler(async (req, res) => {
        const { id } = parse(idParam, req.params);
        res.json({ success: true, data: await service.markRead(req.user!.id, id) });
      }),
    );
  }

  return router;
}
