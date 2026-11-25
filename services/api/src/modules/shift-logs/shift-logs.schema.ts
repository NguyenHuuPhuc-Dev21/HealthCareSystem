/**
 * shift-logs — request validation (whitelist, strict). Physiological bounds reject typing mistakes, not
 * abnormal patients: a reading inside them is stored as measured.
 */
import { z } from 'zod';
import { MobilityStatus } from '@healthcare-system/shared';

export const bookingIdParamSchema = z.object({ id: z.string().uuid() });

export const vitalsSchema = z
  .object({
    id: z.string().uuid().optional(),
    timestamp: z.string().datetime({ offset: true }).optional(),
    heartRate: z.number().int().min(20).max(250),
    bloodPressureSystolic: z.number().int().min(50).max(260),
    bloodPressureDiastolic: z.number().int().min(20).max(160),
    temperature: z.number().min(30).max(45),
    spo2: z.number().min(50).max(100),
    respiratoryRate: z.number().int().min(4).max(60).optional(),
    bloodGlucose: z.number().min(1).max(40).optional(), // mmol/L
    notes: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((v) => v.bloodPressureDiastolic < v.bloodPressureSystolic, {
    message: 'Diastolic pressure must be lower than systolic',
    path: ['bloodPressureDiastolic'],
  });

/** POST /bookings/:id/vitals — `{ vitals }` (shared AddVitalSignsRequest); bookingId in the body is ignored. */
export const addVitalsSchema = z
  .object({ bookingId: z.string().uuid().optional(), vitals: vitalsSchema })
  .strict();

export const assessmentSchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    actualMobility: z.nativeEnum(MobilityStatus),
    mentalStatus: z.string().trim().min(1).max(200),
    isConditionMatched: z.boolean(),
    mismatchReason: z.string().trim().min(5).max(1000).optional(),
    requestedAction: z.enum(['SURCHARGE', 'REFUSE']).optional(),
    initialVitals: vitalsSchema,
  })
  .strict()
  .refine((a) => a.isConditionMatched || (a.mismatchReason !== undefined && a.requestedAction !== undefined), {
    message: 'A condition discrepancy needs a reason and a requested action (SURCHARGE or REFUSE)',
    path: ['requestedAction'],
  });

export const activityParamSchema = z.object({ id: z.string().uuid(), activityId: z.string().min(1).max(64) });

export const activityBodySchema = z
  .object({ bookingId: z.string().uuid().optional(), activityId: z.string().optional(), completed: z.boolean() })
  .strict();

export const noteSchema = z
  .object({ bookingId: z.string().uuid().optional(), id: z.string().uuid().optional(), text: z.string().trim().min(1).max(1000) })
  .strict();

export const refuseSchema = z.object({ reason: z.string().trim().min(5).max(1000).optional() }).strict();

export const respondSurchargeSchema = z.object({ approved: z.boolean() }).strict();

export const listShiftsQuerySchema = z.object({ status: z.enum(['upcoming', 'in_progress', 'completed']).optional() });

export type AddVitalsBody = z.infer<typeof addVitalsSchema>;
export type AssessmentBody = z.infer<typeof assessmentSchema>;
export type NoteBody = z.infer<typeof noteSchema>;
