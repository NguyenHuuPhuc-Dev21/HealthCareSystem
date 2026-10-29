/**
 * Authoritative Entity Interfaces & DTOs
 * Baseline: 25 PostgreSQL 16 Tables (docs/database/schema.sql)
 */

import {
  Gender,
  UserRole,
  KycStatus,
  UserStatus,
  NurseTier,
  ProfileStatus,
  DocType,
  VerificationStatus,
  MobilityStatus,
  LocationType,
  PrivacyRequestType,
  PrivacyRequestStatus,
  ServiceType,
  ServiceUnit,
  HolidayType,
  MatchingMode,
  PaymentMethod,
  ExecutionStatus,
  PaymentStatus,
  BookingDisputeStatus,
  OfferType,
  OfferStatus,
  AdjustmentType,
  AdjustmentStatus,
  WalletStatus,
  BalanceType,
  TxType,
  TxStatus,
  WithdrawalStatus,
  VoucherStatus,
  DisputeStatus,
  ReviewerRole,
  MessageType,
  NotificationChannel,
  NotificationPriority,
  DeliveryStatus,
  AvailabilityType,
  ConfigDataType,
  AuditAction,
  ContractStatus,
  ApplicationStatus,
} from './enums';

// ============================================================================
// 1. IDENTITY & CREDENTIALS
// ============================================================================
export interface User {
  id: string;
  phone: string;
  email?: string | null;
  password_hash?: string | null;
  full_name: string;
  avatar_url?: string | null;
  gender?: Gender | null;
  role: UserRole;
  kyc_status: KycStatus;
  cccd_number?: string | null;
  kyc_documents?: Record<string, unknown> | null;
  status: UserStatus;
  created_at: string;
}

export interface NurseProfile {
  user_id: string;
  tier: NurseTier;
  gphn_number?: string | null;
  gphn_expiry_date?: string | null;
  scope_of_practice?: string | null;
  years_of_exp: number;
  is_retired_medical_staff: boolean;
  current_lat?: number | null;
  current_lng?: number | null;
  is_online: boolean;
  trust_score: number;
  rating_avg: number;
  profile_status: ProfileStatus;
  suspended_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NurseCredential {
  id: string;
  nurse_id: string;
  doc_type: DocType;
  file_url: string;
  issued_date?: string | null;
  expiry_date?: string | null;
  verification_status: VerificationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
}

export interface NurseAvailability {
  id: string;
  nurse_id: string;
  day_of_week?: number | null; // 0 = Sunday ... 6 = Saturday
  specific_date?: string | null;
  start_time: string;
  end_time: string;
  availability_type: AvailabilityType;
  created_at: string;
}

// ============================================================================
// 2. PATIENTS & PRIVACY
// ============================================================================
export interface PatientProfile {
  id: string;
  customer_id: string;
  full_name: string;
  dob?: string | null;
  gender?: Gender | null;
  weight_kg?: number | null;
  mobility_status: MobilityStatus;
  medical_history?: string | null;
  is_infectious: boolean;
  address_text?: string | null;
  location_type: LocationType;
  lat?: number | null;
  lng?: number | null;
  data_consent_accepted: boolean;
  consent_timestamp?: string | null;
  consent_ip?: string | null;
  consent_device_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
}

export interface PrivacyRequest {
  id: string;
  customer_id: string;
  patient_profile_id: string;
  request_type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  processed_by?: string | null;
  processed_at?: string | null;
  created_at: string;
}

// ============================================================================
// 3. CATALOG & PRICING INPUTS
// ============================================================================
export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  service_type: ServiceType;
  is_invasive: boolean;
  is_prohibited: boolean;
  required_tier: NurseTier;
  base_price: number; // Integer VND
  unit: ServiceUnit;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicHoliday {
  holiday_date: string;
  name: string;
  holiday_type: HolidayType;
  surcharge_rate: number;
}

// ============================================================================
// 4. CONTRACTS [Phase 2]
// ============================================================================
export interface Contract {
  id: string;
  customer_id: string;
  patient_profile_id: string;
  service_id: string;
  selected_nurse_id?: string | null;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  created_at: string;
}

export interface ContractApplication {
  id: string;
  contract_id: string;
  nurse_id: string;
  trial_booking_id?: string | null;
  status: ApplicationStatus;
  created_at: string;
}

// ============================================================================
// 5. BOOKINGS & SHIFT EXECUTION
// ============================================================================
export interface Booking {
  id: string;
  booking_code: string;
  customer_id: string;
  patient_profile_id: string;
  nurse_id?: string | null;
  service_id: string;
  contract_id?: string | null;
  matching_mode: MatchingMode;
  payment_method: PaymentMethod;
  start_time: string;
  end_time: string;
  hold_expires_at?: string | null;
  prescription_image_url?: string | null;
  prescription_issued_date?: string | null;
  prescription_verified_by_nurse: boolean;
  base_amount: number;
  surcharge_amount: number;
  urgent_bonus_amount: number;
  platform_fee: number;
  total_amount: number;
  execution_status: ExecutionStatus;
  payment_status: PaymentStatus;
  dispute_status: BookingDisputeStatus;
  commission_due_at?: string | null;
  settled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BookingOffer {
  id: string;
  booking_id: string;
  nurse_id: string;
  offer_type: OfferType;
  radius_km?: number | null;
  round_no: number;
  status: OfferStatus;
  sent_at: string;
  expires_at?: string | null;
  responded_at?: string | null;
}

export interface ShiftLog {
  id: string;
  booking_id: string;
  checkin_time?: string | null;
  checkin_lat?: number | null;
  checkin_lng?: number | null;
  is_mock_location_detected: boolean;
  checkin_selfie_url?: string | null;
  condition_mismatch_reported: boolean;
  checkout_time?: string | null;
  vital_signs_log?: Record<string, unknown> | null;
  care_activities_log?: Record<string, unknown> | null;
  handover_note?: string | null;
  emergency_incident_log?: Record<string, unknown> | null;
}

export interface BookingAdjustment {
  id: string;
  booking_id: string;
  requested_by: string;
  adjustment_type: AdjustmentType;
  extra_hours?: number | null;
  extra_amount: number;
  status: AdjustmentStatus;
  created_at: string;
  responded_at?: string | null;
}

// ============================================================================
// 6. MONEY & WALLET LEDGER
// ============================================================================
export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  escrow_locked_balance: number;
  deposit_balance: number; // May go negative (booked penalty debt)
  wallet_status: WalletStatus;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  booking_id?: string | null;
  idempotency_key: string;
  tx_type: TxType;
  balance_type: BalanceType;
  amount: number;
  balance_before: number;
  balance_after: number;
  status: TxStatus;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  wallet_id: string;
  transaction_id: string;
  amount: number;
  bank_name: string;
  bank_account_no: string;
  account_holder: string;
  status: WithdrawalStatus;
  reviewed_by?: string | null;
  reject_reason?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  user_id: string;
  source_booking_id: string;
  used_booking_id?: string | null;
  amount: number;
  status: VoucherStatus;
  expires_at?: string | null;
  created_at: string;
}

// ============================================================================
// 7. AFTER THE SHIFT
// ============================================================================
export interface Dispute {
  id: string;
  booking_id: string;
  raised_by_id: string;
  reason_code?: string | null;
  description?: string | null;
  evidence_urls?: string[] | null;
  status: DisputeStatus;
  refund_amount?: number | null;
  release_amount?: number | null;
  resolved_by?: string | null;
  resolution_note?: string | null;
  created_at: string;
  resolved_at?: string | null;
}

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: ReviewerRole;
  rating: number; // 1-5
  comment?: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  booking_id: string;
  sender_id: string;
  receiver_id: string;
  message_type: MessageType;
  content?: string | null;
  call_duration_sec?: number | null;
  is_flagged: boolean;
  is_read: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  booking_id?: string | null;
  title: string;
  body?: string | null;
  channel: NotificationChannel;
  priority: NotificationPriority;
  delivery_status: DeliveryStatus;
  acked_at?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface RecordAccessGrant {
  id: string;
  booking_id: string;
  nurse_id: string;
  granted_by: string;
  reason?: string | null;
  expires_at: string;
  created_at: string;
}

// ============================================================================
// 8. PLATFORM, AUDIT & CONFIG
// ============================================================================
export interface SystemConfig {
  config_key: string;
  config_value: string;
  data_type: ConfigDataType;
  description?: string | null;
  updated_by?: string | null;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action_type: AuditAction;
  target_table?: string | null;
  target_id?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  ip_address?: string | null;
  created_at: string;
}

// ============================================================================
// API Response Envelope Types
// ============================================================================
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}
