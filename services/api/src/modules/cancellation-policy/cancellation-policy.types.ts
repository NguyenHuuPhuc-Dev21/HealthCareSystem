import type { ExecutionStatus, PaymentMethod, PaymentStatus } from '@healthcare-system/shared';

/** SRS §5.2 rows 1–9 (same names as the patient-web contract). */
export type SlaScenario =
  | 'CUSTOMER_CANCEL_EARLY' // 1
  | 'CUSTOMER_CANCEL_NEAR' // 2
  | 'CUSTOMER_CANCEL_LATE' // 3
  | 'CUSTOMER_STOP_AFTER_CHECKIN' // 4
  | 'FORCE_MAJEURE_ICU' // 5
  | 'NURSE_CANCEL_EARLY' // 6
  | 'NURSE_CANCEL_URGENT' // 7
  | 'NURSE_NO_SHOW' // 8
  | 'UNMATCHED_EXPIRED'; // 9

export type SlaActor = 'CUSTOMER' | 'NURSE' | 'SYSTEM';

/** Every number of the matrix, from system_configs. Rates are shares (0.2 = 20%). */
export interface SlaRules {
  customerFreeHours: number; // CUSTOMER_CANCEL_FREE_HOURS (12)
  customerLateHours: number; // CUSTOMER_CANCEL_LATE_HOURS (2)
  nearFeeRate: number; // CUSTOMER_CANCEL_NEAR_FEE_RATE (0.20)
  nearNurseRate: number; // CUSTOMER_CANCEL_NEAR_NURSE_RATE (0.15)
  lateFeeRate: number; // CUSTOMER_CANCEL_LATE_FEE_RATE (0.50)
  lateNurseRate: number; // CUSTOMER_CANCEL_LATE_NURSE_RATE (0.40)
  nurseFreeHours: number; // NURSE_CANCEL_FREE_HOURS (12)
  nurseLateFineRate: number; // NURSE_LATE_CANCEL_FINE_RATE (0.20)
  noShowGraceMinutes: number; // NO_SHOW_GRACE_MINUTES (30)
  noShowPenalty: number; // NO_SHOW_PENALTY (50,000)
  travelSupport: number; // ICU_TRAVEL_SUPPORT (50,000)
  trustPenaltyEarly: number; // TRUST_PENALTY_NURSE_CANCEL_EARLY (5)
  trustPenaltyLate: number; // TRUST_PENALTY_NURSE_CANCEL_LATE (20)
  minBillableHours: number; // MIN_BILLABLE_HOURS (1)
}

/**
 * What one §5.2 scenario does. All amounts are integer VND.
 * For a bank transfer: refundAmount + nurseCompensation + platformShare = amountPaid when a fee applies.
 */
export interface SlaOutcome {
  scenario: SlaScenario;
  rowNo: number;
  actor: SlaActor;
  /** Hours from the event to the scheduled start (negative once started); null when not time-based. */
  hoursBeforeStart: number | null;
  paymentMethod: PaymentMethod;
  /** Held in escrow for this booking (0 for cash or unpaid). */
  amountPaid: number;
  feePercent: number;
  refundPercent: number;
  /** The fee the customer owes. For cash it is only recorded (feeCollected = false). */
  feeAmount: number;
  feeCollected: boolean;
  refundAmount: number;
  /** Paid to the nurse out of the escrow (rows 2–4). */
  nurseCompensation: number;
  /** Kept by the platform out of the escrow (rows 2–3). */
  platformShare: number;
  /** Taken from the nurse deposit (rows 7–8). */
  nurseFine: number;
  /** Added to the booking to attract a replacement (row 7) — the whole fine. */
  urgentBonus: number;
  /** Apology voucher for the customer (row 8) — the whole no-show fine. */
  voucherAmount: number;
  /** From the operations fund to a nurse who already travelled (row 5). */
  travelSupport: number;
  /** ≤ 0 */
  trustScoreDelta: number;
  /** Execution status the booking moves to. */
  nextStatus: ExecutionStatus;
  banNurse: boolean;
}

/** Booking facts the engine needs (no DB types). */
export interface SlaBooking {
  startMs: number;
  endMs: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  /** A nurse is assigned (CONFIRMED / IN_PROGRESS). */
  nurseAssigned: boolean;
}

/** Booking as the module reads it. */
export type CancelBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: ExecutionStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  start_time: Date;
  end_time: Date;
  total_amount: string | number;
  service_name: string;
};

/** GET /bookings/:id/cancel-preview (patient-web CancelPreview). */
export interface CancelPreview {
  bookingId: string;
  scenario: SlaScenario;
  hoursBeforeStart: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  feePercent: number;
  refundPercent: number;
  refundAmount: number;
  nurseCompensation: number;
  platformShare: number;
  /** For a cash booking: the fee that is recorded but not collected. */
  feeAmount: number;
  feeCollected: boolean;
}

/** Scenarios that come from refunds outside this module (expiry, invalid prescription, late payments). */
export type RefundScenario = SlaScenario | 'INVALID_PRESCRIPTION' | 'OTHER';

/** GET /refunds item (patient-web RefundRecord). */
export interface RefundRecord {
  refundId: string;
  bookingId: string;
  bookingCode: string;
  serviceLabel: string;
  scenario: RefundScenario;
  amountPaid: number;
  refundAmount: number;
  refundPercent: number;
  nurseCompensation: number;
  platformShare: number;
  voucherAmount: number;
  status: 'PROCESSING' | 'REFUNDED';
  createdAt: string;
  refundedAt: string | null;
}

export interface CancelNotice {
  userId: string;
  bookingId: string;
  title: string;
  body: string;
}
