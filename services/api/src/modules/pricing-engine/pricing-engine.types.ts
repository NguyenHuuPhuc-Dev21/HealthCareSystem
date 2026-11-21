/**
 * Types for pricing-engine (BE-2 · Phase 3 · FR-BOOK-01). Quote shape = FE-1 `PricingQuote`.
 */
import type { HolidayType, ServiceUnit } from '@healthcare-system/shared';

export interface PricingRates {
  night: number; // SURCHARGE_NIGHT_SHIFT (0.20)
  holidayMajor: number; // SURCHARGE_HOLIDAY_MAJOR (3.00, Tết)
  holidayMinor: number; // SURCHARGE_HOLIDAY_MINOR (2.00)
  heavyPatient: number; // SURCHARGE_HEAVY_PATIENT (0.15)
  commission: number; // PLATFORM_COMMISSION_RATE (0.15)
}

export interface Holiday {
  date: string; // YYYY-MM-DD (Vietnam date)
  name: string;
  type: HolidayType;
}

export interface PriceInput {
  unit: ServiceUnit;
  basePrice: number; // integer VND from service_categories
  start: Date;
  end: Date;
  heavyPatient: boolean;
  holidays: Holiday[];
  rates: PricingRates;
}

/** All amounts are integer VND. Surcharges are each computed on the base amount (never compounded). */
export interface PricingQuote {
  hours: number;
  baseAmount: number;
  nightSurcharge: number;
  nightHours: number;
  holidaySurcharge: number;
  holidayName: string | null;
  heavyPatientSurcharge: number;
  /** Platform commission: INSIDE totalAmount (taken from the nurse's earnings at settlement), not added on top. */
  platformFee: number;
  platformFeeRate: number;
  totalAmount: number;
}

/** What is persisted on the booking row (immutable price snapshot). */
export interface PriceSnapshot {
  baseAmount: number;
  surchargeAmount: number; // night + holiday + heavy patient
  platformFee: number;
  totalAmount: number;
}
