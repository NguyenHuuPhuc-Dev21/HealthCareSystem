/**
 * Global Constants & Architectural Invariants
 */

export const MINIMUM_DEPOSIT_VND = 50_000;
export const DEPOSIT_RATIO = 0.3; // 30% advance deposit (BR-04)

export const DEPOSIT_PAYMENT_WINDOW_MINUTES = 15; // 15-minute hold window (BR-04)
export const SOS_ESCALATION_TIMEOUT_SECONDS = 300; // 5-minute escalation SLA (BR-23)
export const SIGNED_URL_MAX_EXPIRY_SECONDS = 900; // 15 minutes max lifetime (NFR-03.3)

export const MAX_ACTIVE_BOOKINGS_PER_PATIENT = 3; // (BR-13)
export const MAX_RESCHEDULE_COUNT_PER_BOOKING = 2; // (BR-13)
export const TIMEZONE_DISPLAY = 'Asia/Ho_Chi_Minh'; // (NFR-05.3)
