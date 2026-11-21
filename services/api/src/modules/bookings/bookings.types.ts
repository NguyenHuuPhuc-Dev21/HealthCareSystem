/**
 * DTOs for bookings (BE-2 · Phase 3 · FR-BOOK-01/02/03). Contract: docs/api/bookings.api.md
 * `BookingView` matches FE-1's `Booking` (apps/patient-web/src/features/booking/booking.types.ts).
 */
import type {
  DisputeStatus,
  ExecutionStatus,
  MatchingMode,
  NurseTier,
  PaymentMethod,
  PaymentStatus,
  ServiceUnit,
} from '@healthcare-system/shared';
import type { PricingQuote } from '../pricing-engine/pricing-engine.types';

/** Unpaid bank-transfer booking past its hold: handler owned by BE-3 `booking-expiry`. */
export const PAYMENT_TIMEOUT_JOB = 'booking-expiry.payment-timeout';
export interface PaymentTimeoutPayload {
  bookingId: string;
}

export type ServiceRow = {
  id: string;
  code: string;
  name: string;
  service_type: string;
  is_invasive: boolean;
  is_prohibited: boolean;
  required_tier: NurseTier;
  base_price: string | number;
  unit: ServiceUnit;
  is_active: boolean;
};

export type BookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  patient_profile_id: string;
  nurse_id: string | null;
  matching_mode: MatchingMode;
  payment_method: PaymentMethod;
  start_time: Date;
  end_time: Date;
  hold_expires_at: Date | null;
  prescription_image_url: string | null;
  base_amount: string | number;
  surcharge_amount: string | number;
  platform_fee: string | number;
  total_amount: string | number;
  execution_status: ExecutionStatus;
  payment_status: PaymentStatus;
  dispute_status: DisputeStatus;
  created_at: Date;
  service_code: string;
  service_name: string;
  service_unit: ServiceUnit;
  service_base_price: string | number;
  is_invasive: boolean;
  patient_name: string;
  patient_weight_kg: string | number | null;
  patient_mobility: string;
  invited_nurse_id: string | null;
  invited_nurse_name: string | null;
  invited_respond_by: Date | null;
};

export interface BookingView {
  id: string;
  code: string;
  serviceCode: string;
  serviceLabel: string;
  isInvasive: boolean;
  patientProfileId: string;
  patientName: string;
  startAt: string;
  endAt: string;
  paymentMethod: PaymentMethod;
  pricing: PricingQuote;
  executionStatus: ExecutionStatus;
  paymentStatus: PaymentStatus;
  disputeStatus: DisputeStatus;
  /** DRAFT + bank transfer: created + PAYMENT_TIMEOUT_MINUTES. */
  paymentExpiresAt: string | null;
  /** Filled by the payment gateway integration (BE-3); null until then. */
  bankTransfer: null;
  invitedNurse: { nurseId: string; fullName: string; respondBy: string | null } | null;
  /** 'RADAR' | 'JOB_BOARD' | 'DIRECT_REQUEST' once matching has started; null while DRAFT. */
  matchingMode: 'RADAR' | 'JOB_BOARD' | 'DIRECT_REQUEST' | null;
  /** No Admin review of prescriptions in SRS v2.0 (the nurse checks it, FR-BOOK-02 layers 2–3). */
  prescriptionReview: null;
  createdAt: string;
}
