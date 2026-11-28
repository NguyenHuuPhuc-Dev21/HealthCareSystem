import { z } from 'zod';
import { NurseTier, ServiceType, ServiceUnit } from '@healthcare-system/shared';

/** Integer VND (D-05). Upper bound only to catch typos (an extra 0 or three). */
const price = z.number().int().min(0).max(100_000_000);

const editable = {
  name: z.string().trim().min(1).max(150),
  service_type: z.nativeEnum(ServiceType),
  is_invasive: z.boolean(),
  is_prohibited: z.boolean(),
  required_tier: z.nativeEnum(NurseTier),
  base_price: price,
  unit: z.nativeEnum(ServiceUnit),
  is_active: z.boolean(),
};

export const createServiceSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9_]{3,50}$/, 'Upper-case letters, digits and _ (3–50)'),
    ...editable,
    is_invasive: editable.is_invasive.default(false),
    is_prohibited: editable.is_prohibited.default(false),
    required_tier: editable.required_tier.default(NurseTier.TIER_1_BASIC),
    is_active: editable.is_active.default(true),
  })
  .strict();

/** PATCH: any subset; `code`, `id` and timestamps are rejected (strict). */
export const updateServiceSchema = z
  .object(editable)
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });

export type CreateServiceBody = z.infer<typeof createServiceSchema>;
export type UpdateServiceBody = z.infer<typeof updateServiceSchema>;

export const serviceIdParamSchema = z.string().uuid();
