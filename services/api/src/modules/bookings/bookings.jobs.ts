/**
 * TEMPORARY (Phase 3): `booking-expiry.payment-timeout` is scheduled by bookings for every bank-transfer
 * booking (runAt = hold_expires_at), but its real handler belongs to BE-3's `booking-expiry` module
 * (DRAFT + UNPAID past the hold → EXPIRED). Until that module registers it, this placeholder keeps the
 * jobs out of the dead-letter queue. It changes nothing in the database.
 * BE-3: register the real handler under the same job name, then delete this file and its call in worker.ts.
 */
import { PAYMENT_TIMEOUT_JOB, type PaymentTimeoutPayload } from './bookings.types';

export function registerPaymentTimeoutPlaceholder(queue: {
  registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
}): void {
  queue.registerHandler<PaymentTimeoutPayload>(PAYMENT_TIMEOUT_JOB, async (payload) => {
    console.warn(
      `[bookings] payment-timeout placeholder: booking ${payload.bookingId} reached its payment hold; ` +
        'booking-expiry (BE-3) is not wired yet, so it was not expired',
    );
  });
}
