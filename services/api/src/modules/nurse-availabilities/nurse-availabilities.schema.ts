/** Request validation for nurse-availabilities (strict whitelist). BE-2 · Phase 2 · FR-SCHED-01. */
import { z } from 'zod';
import { isoDate } from '../nurse-onboarding/nurse-onboarding.schema';

/** 'HH:MM', 00:00 … 23:59 (Vietnam local). */
export const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (00:00–23:59)');

/** Client ids (e.g. "w-1731…") are accepted and ignored; the server assigns UUIDs on save. */
const clientId = z.string().max(100).optional();

const nonZero = <T extends { startTime: string; endTime: string }>(w: T) => w.startTime !== w.endTime;
const nonZeroMsg = { message: 'startTime and endTime must differ (endTime earlier than startTime = past midnight)' };

export const recurringWindowSchema = z
  .object({ id: clientId, dayOfWeek: z.number().int().min(0).max(6), startTime: clock, endTime: clock })
  .strict()
  .refine(nonZero, nonZeroMsg);

export const dateWindowSchema = z
  .object({ id: clientId, specificDate: isoDate, startTime: clock, endTime: clock })
  .strict()
  .refine(nonZero, nonZeroMsg);

/** Limits keep one PUT small; a real schedule uses a fraction of them. */
export const MAX_RECURRING = 70;
export const MAX_DATE_ROWS = 400;

/** PUT /nurse/availabilities — the WHOLE schedule; it replaces what is stored. */
export const putAvailabilitiesSchema = z
  .object({
    recurringWindows: z.array(recurringWindowSchema).max(MAX_RECURRING),
    timeOffExceptions: z.array(dateWindowSchema).max(MAX_DATE_ROWS).default([]),
    dateAvailabilities: z.array(dateWindowSchema).max(MAX_DATE_ROWS).default([]),
  })
  .strict();

export type PutAvailabilitiesBody = z.infer<typeof putAvailabilitiesSchema>;
