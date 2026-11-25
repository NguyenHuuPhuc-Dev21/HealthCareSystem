/**
 * admin-users — request validation (strict whitelist).
 */
import { z } from 'zod';

export const listQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    role: z.enum(['PATIENT', 'NURSE']).optional(),
    status: z.enum(['PENDING', 'PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100_000).default(0),
  })
  .strict();

export const userIdParamSchema = z.object({ id: z.string().uuid() }).strict();

export const setStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']),
    reason: z.string().trim().min(5).max(500),
    waiveTrustScore: z.boolean().optional(),
  })
  .strict();

export type ListQuery = z.infer<typeof listQuerySchema>;
export type SetStatusBody = z.infer<typeof setStatusSchema>;
