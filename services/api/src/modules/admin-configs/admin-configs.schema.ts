import { z } from 'zod';

/** PATCH /admin/configs/:key — the body admin-web sends (features/configs/configs.api.ts). */
export const updateConfigSchema = z
  .object({
    value: z.string().max(500),
    /** Why it changed (e.g. "PO decision 26/11") — stored in the audit record only. */
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export type UpdateConfigBody = z.infer<typeof updateConfigSchema>;

export const configKeyParamSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/);
