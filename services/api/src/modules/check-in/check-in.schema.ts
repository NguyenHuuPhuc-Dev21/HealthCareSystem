/**
 * check-in — request validation (strict whitelist). The device clock is accepted but never used.
 */
import { z } from 'zod';
import { SELFIE_CONTENT_TYPES } from './check-in.types';

export const selfieUploadSchema = z.object({ contentType: z.enum(SELFIE_CONTENT_TYPES) }).strict();

export const checkInSchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isMockLocation: z.boolean(),
    selfieKey: z.string().min(1).max(200),
    accuracyMeters: z.number().min(0).max(10_000).optional(),
    timestamp: z.string().optional(), // device time: ignored, the server stamps its own
  })
  .strict();

export type CheckInBody = z.infer<typeof checkInSchema>;
