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
} as const;

export type SystemConfigKey = keyof typeof SYSTEM_CONFIG_KEYS;

