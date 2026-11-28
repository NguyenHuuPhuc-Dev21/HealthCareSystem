/**
 * check-out — request validation (strict whitelist). `checkoutTime` from the device is accepted but ignored:
 * checkout_time is the SERVER time (anchor of the 24h settlement and 12h record clocks).
 */
import { z } from 'zod';
import { vitalsSchema } from '../shift-logs/shift-logs.schema';

export const checkOutSchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    checkoutTime: z.string().optional(),
    finalVitals: vitalsSchema,
    completedActivityIds: z.array(z.string().min(1).max(64)).max(50),
    handoverNote: z.string().trim().min(10, 'The handover note must say what the family should watch').max(2000),
  })
  .strict();

export type CheckOutBody = z.infer<typeof checkOutSchema>;
