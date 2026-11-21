/** Query validation for nurse-search (strict whitelist). BE-3 · Phase 2 · FR-SEARCH-01. */
import { z } from 'zod';
import { Gender, NurseTier, PaymentMethod } from '@healthcare-system/shared';

export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

/** ISO date-time WITH an offset or Z (e.g. 2026-11-20T08:00:00+07:00), so the instant is never ambiguous. */
const instant = z
  .string()
  .datetime({ offset: true, message: 'Must be an ISO date-time with timezone, e.g. 2026-11-20T08:00:00+07:00' })
  .transform((s) => new Date(s));

/** GET /nurses/search — every value arrives as a string (query string), hence the coercions. */
export const searchQuerySchema = z
  .object({
    serviceCode: z.string().trim().min(1).max(50),
    start: instant,
    end: instant,
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().optional(),
    tier: z.nativeEnum(NurseTier).optional(),
    gender: z.nativeEnum(Gender).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    sort: z.enum(['distance', 'rating', 'experience']).default('distance'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict()
  .refine((q) => q.end.getTime() > q.start.getTime(), { message: 'end must be after start', path: ['end'] });

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const nurseIdParamSchema = z.object({ nurseId: z.string().uuid() });
