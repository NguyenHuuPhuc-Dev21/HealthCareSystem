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

/**
 * Ngưỡng cảnh báo sinh tồn dùng chung cho cả nurse-web và nurse-app
 */
export const VITAL_ALERT_THRESHOLDS = {
  HEART_RATE_MIN: 60,
  HEART_RATE_MAX: 100,
  BP_SYSTOLIC_HIGH: 140,
  BP_DIASTOLIC_HIGH: 90,
  BP_SYSTOLIC_LOW: 90,
  BP_DIASTOLIC_LOW: 60,
  TEMPERATURE_HIGH: 38.0,
  TEMPERATURE_LOW: 35.5,
  SPO2_MIN: 95,
} as const;

export interface VitalSignsThresholdInput {
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperature: number;
  spo2: number;
}

export function getVitalSignsWarnings(input: VitalSignsThresholdInput): string[] {
  const { heartRate, bloodPressureSystolic, bloodPressureDiastolic, temperature, spo2 } = input;
  const warnings: string[] = [];

  if (spo2 > 0 && spo2 < VITAL_ALERT_THRESHOLDS.SPO2_MIN) {
    warnings.push(`SpO2 tụt thấp (${spo2}%)`);
  }
  if (
    heartRate > 0 &&
    (heartRate < VITAL_ALERT_THRESHOLDS.HEART_RATE_MIN ||
      heartRate > VITAL_ALERT_THRESHOLDS.HEART_RATE_MAX)
  ) {
    warnings.push(
      `Nhịp tim ${heartRate} bpm ngoài ngưỡng bình thường (${VITAL_ALERT_THRESHOLDS.HEART_RATE_MIN}–${VITAL_ALERT_THRESHOLDS.HEART_RATE_MAX})`
    );
  }
  if (
    bloodPressureSystolic >= VITAL_ALERT_THRESHOLDS.BP_SYSTOLIC_HIGH ||
    bloodPressureDiastolic >= VITAL_ALERT_THRESHOLDS.BP_DIASTOLIC_HIGH
  ) {
    warnings.push(`Huyết áp cao (${bloodPressureSystolic}/${bloodPressureDiastolic} mmHg)`);
  }
  if (
    (bloodPressureSystolic > 0 && bloodPressureSystolic < VITAL_ALERT_THRESHOLDS.BP_SYSTOLIC_LOW) ||
    (bloodPressureDiastolic > 0 && bloodPressureDiastolic < VITAL_ALERT_THRESHOLDS.BP_DIASTOLIC_LOW)
  ) {
    warnings.push(`Huyết áp thấp (${bloodPressureSystolic}/${bloodPressureDiastolic} mmHg)`);
  }
  if (temperature >= VITAL_ALERT_THRESHOLDS.TEMPERATURE_HIGH) {
    warnings.push(`Sốt cao (${temperature}°C)`);
  }
  if (temperature > 0 && temperature < VITAL_ALERT_THRESHOLDS.TEMPERATURE_LOW) {
    warnings.push(`Hạ thân nhiệt (${temperature}°C)`);
  }

  return warnings;
}
