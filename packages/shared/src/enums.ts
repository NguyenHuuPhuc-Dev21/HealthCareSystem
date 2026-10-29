/**
 * Authoritative Enums for HealthCareSystem — On-Demand Nursing Marketplace
 * Reconciled against PostgreSQL 16 schema (docs/database/schema.sql)
 * Total: 41 ENUM Types
 */

// ============================================================================
// 1. IDENTITY & CREDENTIALS
// ============================================================================
export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum UserRole {
  PATIENT = 'PATIENT',
  NURSE = 'NURSE',
  ADMIN = 'ADMIN',
}

export enum KycStatus {
  UNVERIFIED = 'UNVERIFIED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export enum NurseTier {
  TIER_1_BASIC = 'TIER_1_BASIC',
  TIER_2_SPECIALIST = 'TIER_2_SPECIALIST',
}

export enum ProfileStatus {
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BANNED = 'BANNED',
}

export enum DocType {
  CCCD = 'CCCD',
  DEGREE = 'DEGREE',
  GPHN = 'GPHN',
  RETIREMENT_DECISION = 'RETIREMENT_DECISION',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum AvailabilityType {
  RECURRING_AVAILABLE = 'RECURRING_AVAILABLE',
  TIME_OFF_EXCEPTION = 'TIME_OFF_EXCEPTION',
}

// ============================================================================
// 2. PATIENTS & PRIVACY
// ============================================================================
export enum MobilityStatus {
  NORMAL = 'NORMAL',
  PARTIAL = 'PARTIAL',
  BEDRIDDEN = 'BEDRIDDEN',
}

export enum LocationType {
  HOSPITAL = 'HOSPITAL',
  HOME = 'HOME',
}

export enum PrivacyRequestType {
  DELETE = 'DELETE',
  ANONYMIZE = 'ANONYMIZE',
}

export enum PrivacyRequestStatus {
  PENDING = 'PENDING',
  DONE = 'DONE',
  REJECTED = 'REJECTED',
}

// ============================================================================
// 3. CATALOG & PRICING INPUTS
// ============================================================================
export enum ServiceType {
  TASK_BASED = 'TASK_BASED',
  SHIFT_BASED = 'SHIFT_BASED',
  CONTRACT = 'CONTRACT',
}

export enum ServiceUnit {
  PER_TIME = 'PER_TIME',
  PER_HOUR = 'PER_HOUR',
  PER_SHIFT = 'PER_SHIFT',
}

export enum HolidayType {
  TET = 'TET',
  PUBLIC_HOLIDAY = 'PUBLIC_HOLIDAY',
}

// ============================================================================
// 4. BOOKINGS & SHIFT EXECUTION (THREE INDEPENDENT AXES)
// ============================================================================
export enum MatchingMode {
  RADAR_DISPATCH = 'RADAR_DISPATCH',
  JOB_BOARD = 'JOB_BOARD',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
}

export enum ExecutionStatus {
  DRAFT = 'DRAFT',
  MATCHING = 'MATCHING',
  CONFIRMED = 'CONFIRMED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  ESCROW_HELD = 'ESCROW_HELD',
  SETTLED = 'SETTLED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_SETTLED = 'PARTIALLY_SETTLED', // Phase 2 only
}

export enum BookingDisputeStatus {
  NONE = 'NONE',
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_CUSTOMER = 'RESOLVED_CUSTOMER',
  RESOLVED_NURSE = 'RESOLVED_NURSE',
  RESOLVED_PARTIAL = 'RESOLVED_PARTIAL',   // Phase 2 only
}

export enum OfferType {
  RADAR = 'RADAR',
  DIRECT_REQUEST = 'DIRECT_REQUEST',
  JOB_BOARD = 'JOB_BOARD',
}

export enum OfferStatus {
  SENT = 'SENT',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
  LOST_RACE = 'LOST_RACE',
}

export enum AdjustmentType {
  EXTENSION = 'EXTENSION',
  CONDITION_SURCHARGE = 'CONDITION_SURCHARGE',
}

export enum AdjustmentStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  PAID = 'PAID',
}

// ============================================================================
// 5. MONEY & WALLET LEDGER
// ============================================================================
export enum WalletStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
}

export enum BalanceType {
  AVAILABLE = 'AVAILABLE',
  ESCROW_LOCKED = 'ESCROW_LOCKED',
  DEPOSIT = 'DEPOSIT',
}

export enum TxType {
  TOPUP = 'TOPUP',
  ESCROW_HOLD = 'ESCROW_HOLD',
  ESCROW_RELEASE = 'ESCROW_RELEASE',
  COMMISSION_PAYMENT = 'COMMISSION_PAYMENT',
  PENALTY_DEDUCT = 'PENALTY_DEDUCT',
  URGENT_BONUS = 'URGENT_BONUS',
  REFUND = 'REFUND',
  PARTIAL_SETTLE = 'PARTIAL_SETTLE',       // Phase 2 only
  WITHDRAW = 'WITHDRAW',
}

export enum TxStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum WithdrawalStatus {
  WITHDRAW_REQUESTED = 'WITHDRAW_REQUESTED',
  WITHDRAWN = 'WITHDRAWN',
  REJECTED = 'REJECTED',
}

export enum VoucherStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
}

// ============================================================================
// 6. AFTER THE SHIFT
// ============================================================================
export enum DisputeStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED_CUSTOMER = 'RESOLVED_CUSTOMER',
  RESOLVED_NURSE = 'RESOLVED_NURSE',
  RESOLVED_PARTIAL = 'RESOLVED_PARTIAL',   // Phase 2 only
}

export enum ReviewerRole {
  PATIENT = 'PATIENT',
  NURSE = 'NURSE',
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VOICE_CALL_LOG = 'VOICE_CALL_LOG',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
}

export enum NotificationChannel {
  PUSH_FCM = 'PUSH_FCM',
  IN_APP = 'IN_APP',
  SMS_FALLBACK = 'SMS_FALLBACK',
}

export enum NotificationPriority {
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

// ============================================================================
// 7. PLATFORM, AUDIT & CONFIG
// ============================================================================
export enum ConfigDataType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

export enum AuditAction {
  VIEW_MEDICAL_RECORD = 'VIEW_MEDICAL_RECORD',
  APPROVE_GPHN = 'APPROVE_GPHN',
  RESOLVE_DISPUTE = 'RESOLVE_DISPUTE',
  UPDATE_CONFIG = 'UPDATE_CONFIG',
  DELETE_PATIENT_DATA = 'DELETE_PATIENT_DATA',
  GRANT_RECORD_ACCESS = 'GRANT_RECORD_ACCESS',
}

// ============================================================================
// 8. CONTRACTS (PHASE 2)
// ============================================================================
export enum ContractStatus {
  OPEN = 'OPEN',
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  TERMINATED = 'TERMINATED',
  COMPLETED = 'COMPLETED',
}

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  TRIAL = 'TRIAL',
  SELECTED = 'SELECTED',
  REJECTED = 'REJECTED',
}
