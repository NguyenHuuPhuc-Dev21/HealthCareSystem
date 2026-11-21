import type { ExecutionStatus, MobilityStatus, PaymentMethod, PaymentStatus, ServiceUnit } from '@healthcare-system/shared';
import type { PricingQuote, PricingRates } from '../pricing-engine/pricing-engine.types';

/** booking_adjustments.status (adjustment_status_enum after migration 0013). */
export type AdjustmentStatus = 'REQUESTED' | 'ACCEPTED' | 'REJECTED' | 'PAID' | 'EXPIRED';

/** What the apps show (same names as the patient-web contract). */
export type ExtensionViewStatus = 'AWAITING_NURSE' | 'AWAITING_PAYMENT' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED';

/** The booking as shift-extend reads it, with its service and patient. */
export type ExtendBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: ExecutionStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  start_time: Date;
  end_time: Date;
  service_unit: ServiceUnit;
  service_base_price: string | number;
  weight_kg: string | number | null;
  mobility_status: MobilityStatus | string;
};

export type ExtensionRow = {
  id: string;
  booking_id: string;
  extra_hours: number;
  extra_amount: string | number;
  extra_base_amount: string | number | null;
  extra_surcharge_amount: string | number | null;
  extra_platform_fee: string | number | null;
  status: AdjustmentStatus;
  created_at: Date;
  responded_at: Date | null;
  decline_reason: string | null;
  payment_code: string | null;
  payment_expires_at: Date | null;
  paid_at: Date | null;
  applied_at: Date | null;
};

export type BusyRow = { id: string; start_time: Date; end_time: Date };

export interface BankTransferInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  transferContent: string;
}

export interface ExtensionView {
  id: string;
  hours: number;
  amount: number;
  paymentMethod: PaymentMethod;
  status: ExtensionViewStatus;
  createdAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  /** Bank transfer only: the transfer content to use (unique per extension). */
  paymentCode: string | null;
  paymentExpiresAt: string | null;
  /** Bank transfer, status AWAITING_PAYMENT only. */
  bankTransfer: BankTransferInfo | null;
  qrImageUrl: string | null;
  appliedAt: string | null;
}

export interface ExtendQuote extends PricingQuote {
  /** The hours asked for (also `hours` of the quote). */
  extraHours: number;
  from: string;
  to: string;
}

/** Result for the payment webhook (BE-3 gateway-webhooks calls confirmExtensionPayment). */
export type ExtensionPaymentOutcome =
  | 'EXTENSION_PAID'
  | 'DUPLICATE'
  | 'UNKNOWN_EXTENSION'
  | 'AMOUNT_MISMATCH'
  | 'LATE_PAYMENT_REFUNDED';

export interface ExtensionNotice {
  userId: string;
  bookingId: string;
  title: string;
  body: string;
}

export interface ReceivingAccountLike {
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export type { PricingRates };
