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

export const DEFAULT_TRAVEL_SUPPORT_VND = 50_000;        // 50,000 VND travel support (SRS §5.1 ICU_TRAVEL_SUPPORT)
export const DEFAULT_NO_SHOW_PENALTY_VND = 50_000;       // 50,000 VND penalty (SRS §5.1 NO_SHOW_PENALTY)
export const DEFAULT_SURCHARGE_HEAVY_PATIENT_RATE = 0.15;// 15% surcharge for heavy-care patients (SRS §5.1)
export const DEFAULT_SURCHARGE_NIGHT_SHIFT_RATE = 0.20;  // 20% surcharge for night shift (SRS §5.1)
export const DEFAULT_TRAVEL_BUFFER_MINUTES = 60;         // 60-minute travel buffer between shifts (SRS §5.1)
export const DEFAULT_CANCELLATION_PENALTY_RATE = 0.20;   // 20% cancellation penalty within 12h (SRS §5.2)

export const TIMEZONE_DISPLAY = 'Asia/Ho_Chi_Minh';    // Canonical timezone
