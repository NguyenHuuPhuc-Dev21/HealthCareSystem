/**
 * Types for gateway-webhooks (BE-3 · Phase 3 · FR-PAY-01 · SEC-5.3/5.4). Contract: docs/api/gateway-webhooks.api.md
 */
import type { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';

/** What one verified webhook led to (stored in payment_webhook_events.outcome). */
export type WebhookOutcome =
  | 'HELD' // escrow held, matching started
  | 'DUPLICATE' // same gateway reference already booked → nothing done again
  | 'LATE_PAYMENT_REFUNDED' // booking had expired / hold had passed → money held and refunded 100%
  | 'EXTRA_PAYMENT_REFUNDED' // booking already paid with another reference → second payment refunded
  | 'AMOUNT_MISMATCH' // amount differs from the booking total → nothing moved, Admin follows up
  | 'NOT_TRANSFER_BOOKING' // a cash booking received a transfer → nothing moved, Admin follows up
  | 'UNKNOWN_BOOKING' // no booking with this code
  | 'NOT_SUCCESS' // gateway reported a failed / cancelled payment
  | 'EXTENSION_PAID' // shift extension paid → held in escrow and in effect (shift-extend, BE-1)
  | 'UNKNOWN_EXTENSION' // `<code>-GH<n>` that matches no extension
  | 'SURCHARGE_PAID' // condition-mismatch surcharge paid → held in escrow and in effect (shift-logs, BE-2)
  | 'UNKNOWN_SURCHARGE' // `<code>-PT<n>` that matches no surcharge
  | 'TOPUP_CREDITED' // nurse deposit top-up ("KQ…") credited in full (deposits, ADR-0004)
  | 'TOPUP_EXCESS_RETURNED' // shortfall credited, the rest returned by the custody partner
  | 'TOPUP_RETURNED' // deposit already full / link already paid: everything returned
  | 'UNKNOWN_TOPUP' // "KQ…" that matches no top-up
  | 'COMMISSION_PAID' // cash-booking commission ("HH…") self-paid by the nurse (cash-commission, FR-PAY-02)
  | 'COMMISSION_RETURNED' // commission already paid: the second transfer goes back
  | 'UNKNOWN_COMMISSION'; // "HH…" that matches no commission

/** What shift-extend's confirmExtensionPayment answers, plus the booking it belongs to (for the event row). */
export interface ExtensionPaymentResult {
  outcome: 'EXTENSION_PAID' | 'DUPLICATE' | 'UNKNOWN_EXTENSION' | 'AMOUNT_MISMATCH' | 'LATE_PAYMENT_REFUNDED';
  bookingId: string | null;
}

/** Booking as the webhook reads it (locked FOR UPDATE). */
export type PaymentBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  execution_status: ExecutionStatus;
  hold_expires_at: Date | null;
  total_amount: string | number;
};

export interface WebhookResult {
  received: true;
  outcome: WebhookOutcome;
  bookingId: string | null;
}

/** GET /bookings/:id/payment-link — matches FE-1 `PaymentLink` + the transfer details. */
export interface PaymentLinkDto {
  bookingId: string;
  bookingCode: string;
  amount: number;
  /** Hosted checkout page of the gateway; null in the VietQR-only sandbox. */
  checkoutUrl: string | null;
  /** VietQR image (amount + transfer content pre-filled); null until the receiving account is configured. */
  qrImageUrl: string | null;
  /** End of the 15-minute payment hold. */
  expiresAt: string;
  bankTransfer: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    /** Must be kept as is: the gateway matches the payment to the booking by it. */
    transferContent: string;
  } | null;
}

export interface ReceivingAccount {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}
