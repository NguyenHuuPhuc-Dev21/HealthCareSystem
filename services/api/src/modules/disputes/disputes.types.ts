/**
 * Types for disputes (BE-3 · Phase 6 · FR-DISP-01/02 · ADR-0004 D3).
 * Public shapes (DisputeDto, DisputeCategory, PresignedUploadUrlDto) from packages/shared dispute.contracts (FE-2).
 */
export const MAX_EVIDENCE_FILES = 5; // FR-DISP-01: at most 5 files per party
export const PENALTY_APPEAL = 'PENALTY_APPEAL'; // disputes.reason_code of a deposit-penalty appeal (deposits module)
export const DISPUTE_CATEGORIES = [
  'PREMATURE_ABANDONMENT',
  'CLINICAL_PROTOCOL_VIOLATION',
  'UNPROFESSIONAL_CONDUCT',
  'FALSE_CLINICAL_DECLARATION',
] as const;

export type Resolution = 'RESOLVED_CUSTOMER' | 'RESOLVED_NURSE';

export type DisputeBookingRow = {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  payment_method: string;
  payment_status: string;
  execution_status: string;
  dispute_status: string;
  settled_at: Date | null;
  checkout_time: Date | null;
};

export type DisputeRow = {
  id: string;
  booking_id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  raised_by_id: string;
  raised_by_role: string;
  reason_code: string | null;
  description: string | null;
  evidence_urls: string[] | null;
  status: string;
  refund_amount: string | number | null;
  release_amount: string | number | null;
  resolution_note: string | null;
  resolved_at: Date | null;
  rebuttal_text: string | null;
  rebuttal_evidence_urls: string[] | null;
  rebuttal_by_role: string | null;
  rebuttal_at: Date | null;
  rebuttal_due_at: Date | null;
  trust_score_delta: number | null;
  deposit_deducted: string | number | null;
  created_at: Date;
  updated_at: Date;
  /** Set for a penalty appeal (deposit_penalty_appeals → the PENALTY_DEDUCT row and its details). */
  appealed_transaction_id: string | null;
  penalty_amount: string | number | null;
  penalty_reason: string | null;
  sla_rule_ref: string | null;
};

export interface OpenDisputeBody {
  category?: string;
  description: string;
  evidenceKeys: string[];
}

export interface ResolveBody {
  resolution: Resolution;
  notes: string;
  /** RESOLVED_CUSTOMER on a booking dispute: damages taken from the nurse deposit (DISPUTE_UPHELD), optional. */
  depositDeduction?: number;
}

export interface ResolveResult {
  updated: true;
  outcome: Resolution;
  refunded: number;
  released: boolean;
  trustScoreDelta: number;
  depositDeducted: number;
  penaltyReversed: boolean;
}
