/**
 * Authoritative System Configuration Keys (SRS §5.1 Table 2)
 * All monetary and operational numbers must be resolved dynamically at runtime using these keys.
 */

export const SYSTEM_CONFIG_KEYS = {
  // Financial & Commissions
  PLATFORM_COMMISSION_RATE: 'PLATFORM_COMMISSION_RATE',       // 0.15 (15%)
  MIN_NURSE_DEPOSIT: 'MIN_NURSE_DEPOSIT',                     // 300000 (300,000 VND)
  
  // Surcharges (Applied Additively on Base Price)
  SURCHARGE_NIGHT_SHIFT: 'SURCHARGE_NIGHT_SHIFT',             // 0.20 (+20% for 22:00–06:00)
  SURCHARGE_HOLIDAY_MAJOR: 'SURCHARGE_HOLIDAY_MAJOR',         // 3.00 (+300% Lunar New Year / Tết)
  SURCHARGE_HOLIDAY_MINOR: 'SURCHARGE_HOLIDAY_MINOR',         // 2.00 (+200% National Holidays)
  SURCHARGE_HEAVY_PATIENT: 'SURCHARGE_HEAVY_PATIENT',         // 0.15 (+15% for ICU/bedridden care)
  
  // Operational Timeouts & Windows
  PAYMENT_TIMEOUT_MINUTES: 'PAYMENT_TIMEOUT_MINUTES',         // 15 (minutes)
  SETTLEMENT_COOLING_HOURS: 'SETTLEMENT_COOLING_HOURS',       // 24 (hours)
  RECORD_ACCESS_EXPIRY_HOURS: 'RECORD_ACCESS_EXPIRY_HOURS',   // 12 (hours post check-out)
  
  // Geolocation & Travel
  CHECKIN_MAX_RADIUS_METERS: 'CHECKIN_MAX_RADIUS_METERS',     // 200 (meters)
  RADAR_INITIAL_RADIUS_KM: 'RADAR_INITIAL_RADIUS_KM',         // 5 (km)
  RADAR_EXPANDED_RADIUS_KM: 'RADAR_EXPANDED_RADIUS_KM',       // 10 (km)
  RADAR_EXPANSION_DELAY_MIN: 'RADAR_EXPANSION_DELAY_MIN',     // 5 (minutes)
  TRAVEL_BUFFER_MINUTES: 'TRAVEL_BUFFER_MINUTES',             // 60 (minutes between shifts)
  
  // SLA Penalties & Compensations
  ICU_TRAVEL_SUPPORT: 'ICU_TRAVEL_SUPPORT',                   // 50000 (50,000 VND)
  NO_SHOW_PENALTY: 'NO_SHOW_PENALTY',                         // 50000 (50,000 VND)

  // Authentication (accounts-otp — migration 0003; proposed values, OD-09 pending PO)
  OTP_LENGTH: 'OTP_LENGTH',                                   // 6 digits
  OTP_TTL_SECONDS: 'OTP_TTL_SECONDS',                         // 300 (5 minutes)
  OTP_MAX_VERIFY_ATTEMPTS: 'OTP_MAX_VERIFY_ATTEMPTS',         // 5
  OTP_RESEND_COOLDOWN_SECONDS: 'OTP_RESEND_COOLDOWN_SECONDS', // 60
  OTP_MAX_SENDS_PER_PHONE_PER_HOUR: 'OTP_MAX_SENDS_PER_PHONE_PER_HOUR', // 5
  OTP_MAX_SENDS_PER_IP_PER_HOUR: 'OTP_MAX_SENDS_PER_IP_PER_HOUR',       // 20
  ACCESS_TOKEN_TTL_MINUTES: 'ACCESS_TOKEN_TTL_MINUTES',       // 15
  REFRESH_TOKEN_TTL_DAYS: 'REFRESH_TOKEN_TTL_DAYS',           // 30
  ADMIN_SESSION_IDLE_MINUTES: 'ADMIN_SESSION_IDLE_MINUTES',   // 30

  // Privacy & medical records (privacy-consent — migration 0006)
  RECORD_ACCESS_GRANT_MAX_HOURS: 'RECORD_ACCESS_GRANT_MAX_HOURS',     // 24 (proposed, pending PO)
  MEDICAL_RECORD_RETENTION_MONTHS: 'MEDICAL_RECORD_RETENTION_MONTHS', // 24 (NFR-PRIV-02)

  // Nurse deposit: grace period, refund, appeal (migration 0008, ADR-0004; proposed values, OD-15/OD-16 pending PO)
  DEPOSIT_GRACE_MAX_SHIFTS: 'DEPOSIT_GRACE_MAX_SHIFTS',               // 3 transfer-paid shifts
  DEPOSIT_GRACE_DAYS: 'DEPOSIT_GRACE_DAYS',                           // 30 days from first ACTIVE
  DEPOSIT_WITHHOLD_RATE: 'DEPOSIT_WITHHOLD_RATE',                     // 0.30 of each net payout
  DEPOSIT_REFUND_HOLD_DAYS: 'DEPOSIT_REFUND_HOLD_DAYS',               // 7 days after last check-out (SRS §2.3)
  DEPOSIT_REFUND_SLA_WORKING_DAYS: 'DEPOSIT_REFUND_SLA_WORKING_DAYS', // 5 working days
  PENALTY_APPEAL_DAYS: 'PENALTY_APPEAL_DAYS',                         // 3 days

  // Booking & matching (BE-2 Phase 3 — migration 0009)
  URGENT_BOOKING_LEAD_HOURS: 'URGENT_BOOKING_LEAD_HOURS',     // 6 (start within <= 6h → Radar Dispatch, FR-BOOK-03)
  RADAR_WINDOW_MINUTES: 'RADAR_WINDOW_MINUTES',               // 15 (Radar offers end 15 min after dispatch starts)

  // Booking expiry & Job Board direct request (BE-3 Phase 3 — migration 0010)
  UNMATCHED_EXPIRY_LEAD_MINUTES: 'UNMATCHED_EXPIRY_LEAD_MINUTES',     // 30 (unclaimed 30 min before start → EXPIRED + 100% refund)
  URGENT_UNMATCHED_EXPIRY_MINUTES: 'URGENT_UNMATCHED_EXPIRY_MINUTES', // 30 (urgent booking unclaimed 30 min after matching starts → EXPIRED)
  DIRECT_REQUEST_WINDOW_MINUTES: 'DIRECT_REQUEST_WINDOW_MINUTES',     // 15 (invited nurse's exclusive window, BR-08 §2.2)

  // Booking (prescription-gate — migration 0011)
  PRESCRIPTION_MAX_AGE_DAYS: 'PRESCRIPTION_MAX_AGE_DAYS',             // 7 (FR-BOOK-02)

  // On-site rejection of an invalid medical order (prescription-rejection — migration 0012; proposed, pending PO)
  PRESCRIPTION_REJECTION_WINDOW_MINUTES: 'PRESCRIPTION_REJECTION_WINDOW_MINUTES', // 60 (FR-BOOK-02 Layer 3)

  // Shift extension (shift-extend — migration 0013; proposed, pending PO)
  EXTENSION_REQUEST_DEADLINE_MINUTES: 'EXTENSION_REQUEST_DEADLINE_MINUTES', // 30 (request until scheduled end − 30 min, FR-SHIFT-03)
  MAX_EXTENSION_HOURS: 'MAX_EXTENSION_HOURS',                               // 4 (per request, 1-hour steps)

  // Cancellation / timeout / compensation matrix (cancellation-policy — migration 0014; SRS §5.2 values)
  CUSTOMER_CANCEL_FREE_HOURS: 'CUSTOMER_CANCEL_FREE_HOURS',           // 12 (> 12h: 100% refund, row 1)
  CUSTOMER_CANCEL_LATE_HOURS: 'CUSTOMER_CANCEL_LATE_HOURS',           // 2 (< 2h: last-minute fee, row 3)
  CUSTOMER_CANCEL_NEAR_FEE_RATE: 'CUSTOMER_CANCEL_NEAR_FEE_RATE',     // 0.20 (row 2)
  CUSTOMER_CANCEL_NEAR_NURSE_RATE: 'CUSTOMER_CANCEL_NEAR_NURSE_RATE', // 0.15 (row 2; platform keeps the rest of the fee)
  CUSTOMER_CANCEL_LATE_FEE_RATE: 'CUSTOMER_CANCEL_LATE_FEE_RATE',     // 0.50 (row 3)
  CUSTOMER_CANCEL_LATE_NURSE_RATE: 'CUSTOMER_CANCEL_LATE_NURSE_RATE', // 0.40 (row 3)
  NURSE_CANCEL_FREE_HOURS: 'NURSE_CANCEL_FREE_HOURS',                 // 12 (row 6 vs 7)
  NURSE_LATE_CANCEL_FINE_RATE: 'NURSE_LATE_CANCEL_FINE_RATE',         // 0.20 (row 7, → Urgent Bonus)
  NO_SHOW_GRACE_MINUTES: 'NO_SHOW_GRACE_MINUTES',                     // 30 (row 8)
  TRUST_PENALTY_NURSE_CANCEL_EARLY: 'TRUST_PENALTY_NURSE_CANCEL_EARLY', // 5 (row 6)
  TRUST_PENALTY_NURSE_CANCEL_LATE: 'TRUST_PENALTY_NURSE_CANCEL_LATE', // 20 (row 7)
  MIN_BILLABLE_HOURS: 'MIN_BILLABLE_HOURS',                           // 1 (row 4)

  // Reviews & TrustScore (reviews-trustscore — migration 0015)
  REVIEW_BLIND_DAYS: 'REVIEW_BLIND_DAYS',                                   // 7 (hidden until both sides reviewed or 7 days, FR-RATE-01)
  REVIEW_WINDOW_DAYS: 'REVIEW_WINDOW_DAYS',                                 // 7 (proposed, pending PO: reviews close 7 days after the shift)
  TRUST_PENALTY_DISPUTE_UPHELD: 'TRUST_PENALTY_DISPUTE_UPHELD',             // 25 (dispute upheld against the nurse)
  TRUST_RECOVERY_GOOD_RATING: 'TRUST_RECOVERY_GOOD_RATING',                 // 2 (per shift rated ≥ TRUST_RECOVERY_MIN_STARS)
  TRUST_RECOVERY_MIN_STARS: 'TRUST_RECOVERY_MIN_STARS',                     // 4
  TRUST_SUSPEND_BELOW: 'TRUST_SUSPEND_BELOW',                               // 60 (ACTIVE nurse below 60 → SUSPENDED)
} as const;

export type SystemConfigKey = keyof typeof SYSTEM_CONFIG_KEYS;

