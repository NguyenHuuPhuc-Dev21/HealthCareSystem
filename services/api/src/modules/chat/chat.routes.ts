/**
 * Routes for chat (mounted at /api/v1). Contract: docs/api/chat.api.md · BE-2 · Phase 6 · FR-CHAT-01.
 * Paths follow what nurse-web chat.api.ts already calls. No business logic here.
 */
import { Router } from 'express';
import { UserRole } from '@healthcare-system/shared';
import { asyncHandler, authGuard, roleGuard, validateBody } from '../../core/middleware';
import { callLogSchema, imageUploadUrlSchema, markReadSchema, sendMessageSchema, type CallLogBody, type SendMessageBody } from './chat.schema';
import type { ChatService } from './chat.service';

export function createChatRouter(service: ChatService): Router {
  const router = Router();
  const participant = [authGuard, roleGuard([UserRole.PATIENT, UserRole.NURSE])];
  const viewer = (req: { user?: { id: string; role: string } }) => ({ id: req.user!.id, role: req.user!.role });

  router.get(
    '/bookings/:id/conversation',
    ...participant,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.getConversation(viewer(req), String(req.params.id)) });
    }),
  );

  router.post(
    '/bookings/:id/messages',
    ...participant,
    validateBody(sendMessageSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as SendMessageBody;
      const data =
        'imageKey' in b
          ? await service.sendImage(viewer(req), String(req.params.id), b.imageKey)
          : await service.send(viewer(req), String(req.params.id), b.content);
      res.status(201).json({ success: true, data });
    }),
  );

  router.post(
    '/bookings/:id/messages/image-upload-url',
    ...participant,
    validateBody(imageUploadUrlSchema),
    asyncHandler(async (req, res) => {
      const { contentType } = req.body as { contentType: string };
      res.status(201).json({ success: true, data: await service.requestImageUploadUrl(viewer(req), String(req.params.id), contentType) });
    }),
  );

  router.get(
    '/bookings/:id/call-config',
    ...participant,
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.callConfig(viewer(req), String(req.params.id)) });
    }),
  );

  router.post(
    '/bookings/:id/calls',
    ...participant,
    validateBody(callLogSchema),
    asyncHandler(async (req, res) => {
      const b = req.body as CallLogBody;
      res.status(201).json({ success: true, data: await service.logCall(viewer(req), String(req.params.id), b) });
    }),
  );

  router.post(
    '/conversations/:id/read',
    ...participant,
    validateBody(markReadSchema),
    asyncHandler(async (req, res) => {
      const { lastMessageId } = req.body as { lastMessageId: string };
      res.json({ success: true, data: await service.markRead(viewer(req), String(req.params.id), lastMessageId) });
    }),
  );

  router.get(
    '/admin/bookings/:id/conversation',
    authGuard,
    roleGuard([UserRole.ADMIN]),
    asyncHandler(async (req, res) => {
      res.json({ success: true, data: await service.adminConversation(req.user!.id, String(req.params.id), req.ip) });
    }),
  );

  return router;
}
