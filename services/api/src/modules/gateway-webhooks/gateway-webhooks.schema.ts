/** Validation of the gateway webhook body (PayOS-style envelope). BE-3 · Phase 3 · SEC-5.3. */
import { z } from 'zod';

/**
 * `data` is what the gateway signs. Only the fields we use are required; any extra field the gateway
 * sends is kept (passthrough) because it is part of the signed string.
 */
export const webhookDataSchema = z
  .object({
    orderCode: z.string().trim().min(1).max(30), // our booking_code (also the transfer content)
    amount: z.number().int().positive(),
    reference: z.string().trim().min(1).max(100), // gateway transaction id → idempotency key
    description: z.string().max(255).optional(),
    transactionDateTime: z.string().max(40).optional(),
  })
  .passthrough();

export const escrowWebhookSchema = z.object({
  code: z.string().max(10),
  desc: z.string().max(255).optional(),
  success: z.boolean(),
  data: webhookDataSchema,
  signature: z.string().regex(/^[0-9a-f]{64}$/i, 'signature must be a hex HMAC-SHA256'),
});

export type EscrowWebhookBody = z.infer<typeof escrowWebhookSchema>;
export type WebhookData = z.infer<typeof webhookDataSchema>;

export const bookingIdParamSchema = z.object({ id: z.string().uuid() });
