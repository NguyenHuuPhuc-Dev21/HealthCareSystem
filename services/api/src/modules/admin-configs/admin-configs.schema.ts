import { z } from 'zod';

/** PATCH /admin/configs/:key — the shape admin-web already sends. */
export const updateConfigSchema = z
  .object({
    config_value: z.union([z.string().max(500), z.number(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())]),
  })
  .strict();

export type UpdateConfigBody = z.infer<typeof updateConfigSchema>;

export const configKeyParamSchema = z.string().regex(/^[A-Z][A-Z0-9_]{1,99}$/);
