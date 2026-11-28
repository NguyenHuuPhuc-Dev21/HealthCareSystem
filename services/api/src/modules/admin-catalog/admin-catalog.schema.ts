import { z } from 'zod';
import { NurseTier, ServiceType, ServiceUnit } from '@healthcare-system/shared';
import type { EditableFields } from './admin-catalog.types';

/** Integer VND (D-05). Upper bound only to catch typos (an extra 0 or three). */
const price = z.number().int().min(0).max(100_000_000);

/** Same rule as admin-web CODE_PATTERN: starts with a letter, upper-case letters / digits / _, 3–50. */
export const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,49}$/;

const editable = {
  name: z.string().trim().min(1).max(150),
  serviceType: z.nativeEnum(ServiceType),
  isInvasive: z.boolean(),
  isProhibited: z.boolean(),
  requiredTier: z.nativeEnum(NurseTier),
  basePrice: price,
  unit: z.nativeEnum(ServiceUnit),
  isActive: z.boolean(),
};

export const createServiceSchema = z
  .object({
    code: z.string().trim().regex(CODE_PATTERN, 'Upper-case letters, digits and _; 3–50; starts with a letter'),
    ...editable,
    isInvasive: editable.isInvasive.default(false),
    isProhibited: editable.isProhibited.default(false),
    requiredTier: editable.requiredTier.default(NurseTier.TIER_1_BASIC),
    isActive: editable.isActive.default(true),
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

/** camelCase body → table columns (only the fields present). */
export function toColumns(b: UpdateServiceBody): Partial<EditableFields> {
  const out: Partial<EditableFields> = {};
  if (b.name !== undefined) out.name = b.name;
  if (b.serviceType !== undefined) out.service_type = b.serviceType;
  if (b.isInvasive !== undefined) out.is_invasive = b.isInvasive;
  if (b.isProhibited !== undefined) out.is_prohibited = b.isProhibited;
  if (b.requiredTier !== undefined) out.required_tier = b.requiredTier;
  if (b.basePrice !== undefined) out.base_price = b.basePrice;
  if (b.unit !== undefined) out.unit = b.unit;
  if (b.isActive !== undefined) out.is_active = b.isActive;
  return out;
}
