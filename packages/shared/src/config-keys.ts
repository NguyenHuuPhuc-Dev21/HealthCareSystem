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
} as const;

export type SystemConfigKey = keyof typeof SYSTEM_CONFIG_KEYS;

