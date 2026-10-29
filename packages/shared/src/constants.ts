/**
 * Global Constants & Architectural Invariants
 * Baseline: SRS Version 2.0 (Updated, 28/10/2026)
 */

export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.15; // 15% (SRS §5.1)
export const DEFAULT_MIN_NURSE_DEPOSIT_VND = 300_000;  // 300,000 VND (SRS §5.1, FR-PAY-03)

export const DEFAULT_PAYMENT_TIMEOUT_MINUTES = 15;     // 15-minute hold window (SRS §5.1)
export const DEFAULT_SETTLEMENT_COOLING_HOURS = 24;    // 24 hours post check-out (SRS §5.1)
export const DEFAULT_RECORD_ACCESS_EXPIRY_HOURS = 12;  // 12 hours post check-out (Decree 13 / FR-PRIV-01)

export const PRESIGNED_URL_MAX_EXPIRY_SECONDS = 600;   // 10 minutes max lifetime (SRS §6 NFR-SEC-01)
export const CHECKIN_MAX_RADIUS_METERS = 200;          // 200m Haversine distance (SRS §6 NFR-SEC-01)

export const TIMEZONE_DISPLAY = 'Asia/Ho_Chi_Minh';    // Canonical timezone
