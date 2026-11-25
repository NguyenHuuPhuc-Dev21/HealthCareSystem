/**
 * chat — request validation (strict whitelist).
 */
import { z } from 'zod';

const textMessage = z
  .object({
    content: z.string().trim().min(1).max(2000),
    type: z.literal('TEXT').optional(),
  })
  .strict();

/** imageKey: objectKey from POST /bookings/:id/messages/image-upload-url (calls go to /calls). */
const imageMessage = z
  .object({
    type: z.literal('IMAGE'),
    imageKey: z.string().min(1).max(200),
  })
  .strict();

export const sendMessageSchema = z.union([textMessage, imageMessage]);

export const imageUploadUrlSchema = z.object({ contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']) }).strict();

/** Client → server over /ws/chat. */
export const callSignalSchema = z
  .object({
    type: z.literal('CALL_SIGNAL'),
    callId: z.string().uuid(),
    kind: z.enum(['RING', 'ACCEPT', 'DECLINE', 'BUSY', 'OFFER', 'ANSWER', 'ICE_CANDIDATE', 'HANGUP']),
    payload: z.unknown().optional(),
  })
  .strict();

export const callLogSchema = z
  .object({
    durationSec: z.number().int().min(0).max(24 * 3600),
    outcome: z.enum(['COMPLETED', 'MISSED', 'DECLINED']),
  })
  .strict();

export const markReadSchema = z.object({ lastMessageId: z.string().uuid() }).strict();

export type SendMessageBody = z.infer<typeof sendMessageSchema>;
export type CallLogBody = z.infer<typeof callLogSchema>;
export type CallSignalBody = z.infer<typeof callSignalSchema>;
