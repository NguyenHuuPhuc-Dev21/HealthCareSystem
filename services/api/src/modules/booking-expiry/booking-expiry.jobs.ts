/**
 * booking-expiry jobs on the shared queue (BE-3 · Phase 3). Replaces BE-2's payment-timeout placeholder.
 *   booking-expiry.payment-timeout   { bookingId } at hold_expires_at (scheduled by bookings, key payment-timeout:<id>)
 *   booking-expiry.sweep             every minute — safety net for missed timeouts + unmatched bookings at their deadline
 * Both are idempotent: an already expired / paid / matched booking is left alone, and the refund is booked
 * under one idempotency key per booking.
 */
import { PAYMENT_TIMEOUT_JOB, type PaymentTimeoutPayload } from '../bookings/bookings.types';
import { getBookingExpiryService, type BookingExpiryService } from './booking-expiry.service';
import { EXPIRY_SWEEP_EVERY_MS, EXPIRY_SWEEP_JOB } from './booking-expiry.types';

export async function registerBookingExpiryJobs(
  queue: {
    registerHandler<T>(jobName: string, handler: (payload: T) => Promise<void>): void;
    scheduleRecurring(schedulerId: string, repeat: { every: number }, jobName: string): Promise<void>;
  },
  service: BookingExpiryService = getBookingExpiryService(),
): Promise<void> {
  queue.registerHandler<PaymentTimeoutPayload>(PAYMENT_TIMEOUT_JOB, async (payload) => {
    const r = await service.handlePaymentTimeout(payload);
    if (r.expired) console.log(`[booking-expiry] booking ${payload.bookingId} expired: unpaid after the payment hold`);
  });

  queue.registerHandler(EXPIRY_SWEEP_JOB, async () => {
    const r = await service.runSweep();
    if (r.paymentTimeouts + r.unmatched + r.failed > 0) {
      console.log(
        `[booking-expiry] sweep: ${r.paymentTimeouts} unpaid, ${r.unmatched} unmatched expired, ${r.refunded} refunded, ${r.failed} failed`,
      );
    }
    if (r.failed > 0) throw new Error(`${r.failed} booking(s) could not be expired`); // retry → DLQ alert
  });
  await queue.scheduleRecurring(EXPIRY_SWEEP_JOB, { every: EXPIRY_SWEEP_EVERY_MS }, EXPIRY_SWEEP_JOB);
}
