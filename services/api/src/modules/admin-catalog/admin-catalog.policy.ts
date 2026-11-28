/** admin-catalog policy (FR-ADMIN-01). PURE. */
import { NurseTier } from '@healthcare-system/shared';
import type { EditableFields } from './admin-catalog.types';

export type CatalogProblem = 'INVASIVE_REQUIRES_TIER_2';

/** Checked on the row as it would be after the change. Invasive procedures are Tier 2 only (hard tier gate). */
export function catalogProblem(s: Pick<EditableFields, 'is_invasive' | 'required_tier'>): CatalogProblem | null {
  if (s.is_invasive && s.required_tier !== NurseTier.TIER_2_SPECIALIST) return 'INVASIVE_REQUIRES_TIER_2';
  return null;
}

/** Only the fields whose value really changes (for the UPDATE and the audit). */
export function changedFields(current: EditableFields, patch: Partial<EditableFields>): Partial<EditableFields> {
  const out: Partial<EditableFields> = {};
  for (const k of Object.keys(patch) as (keyof EditableFields)[]) {
    if (patch[k] !== undefined && patch[k] !== current[k]) (out as Record<string, unknown>)[k] = patch[k];
  }
  return out;
}
