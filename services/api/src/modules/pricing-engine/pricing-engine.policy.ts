/**
 * pricing-engine — PURE price calculation (no DB, no clock). BE-2 · Phase 3.
 * FR-BOOK-01 · BR-03 §2.2 · RTM TC-PRICE-01.
 *
 *   total = base + night surcharge + holiday surcharge + heavy-patient surcharge
 *
 *  - Every surcharge is a percentage of the BASE amount; surcharges add up, they never compound.
 *  - Night surcharge applies only to the part of the visit between 22:00 and 06:00 (Vietnam time):
 *      base × (night minutes / total minutes) × rate.
 *    SRS example: 20:00–06:00 at 50,000/h → base 500,000; 8 night hours → +80,000 → 580,000.
 *  - Holiday surcharge applies to the part of the visit that falls on a holiday date (Vietnam date),
 *    Tết at the MAJOR rate, other public holidays at the MINOR rate.
 *    SRS example: a 500,000 shift entirely on Tết → +300% = 1,500,000 → 2,000,000.
 *  - Heavy patient (weight >= 80 kg or BEDRIDDEN): base × rate.
 *  - Amounts are integer VND; each surcharge is rounded to the nearest đồng.
 *  - Platform fee = total × commission rate; it is part of the total, not added to it.
 */
import {
  HEAVY_PATIENT_WEIGHT_KG,
  HolidayType,
  MobilityStatus,
  NIGHT_SHIFT_END_HOUR,
  NIGHT_SHIFT_START_HOUR,
  ServiceUnit,
} from '@healthcare-system/shared';
import { MINUTE_MS, addDays, vnDate, vnMidnight } from '../availability-engine/availability-engine.policy';
import type { PriceInput, PriceSnapshot, PricingQuote } from './pricing-engine.types';

const HOUR_MS = 60 * MINUTE_MS;

/** Milliseconds of [start, end) that overlap [a, b). */
function overlapMs(start: number, end: number, a: number, b: number): number {
  return Math.max(0, Math.min(end, b) - Math.max(start, a));
}

/** Vietnam dates touched by [start, end). */
function vnDatesOf(start: number, end: number): string[] {
  const out: string[] = [];
  for (let d = vnDate(start); d <= vnDate(end - 1); d = addDays(d, 1)) out.push(d);
  return out;
}

/** Minutes of the visit inside the night window (22:00–06:00 Vietnam time). */
export function nightMinutes(start: Date, end: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  let ms = 0;
  for (const date of vnDatesOf(s, e)) {
    const midnight = vnMidnight(date);
    ms += overlapMs(s, e, midnight, midnight + NIGHT_SHIFT_END_HOUR * HOUR_MS);
    ms += overlapMs(s, e, midnight + NIGHT_SHIFT_START_HOUR * HOUR_MS, midnight + 24 * HOUR_MS);
  }
  return ms / MINUTE_MS;
}

export function isHeavyPatient(weightKg: number | null, mobilityStatus: MobilityStatus | string): boolean {
  return (weightKg !== null && weightKg >= HEAVY_PATIENT_WEIGHT_KG) || mobilityStatus === MobilityStatus.BEDRIDDEN;
}

export function computeQuote(input: PriceInput): PricingQuote {
  const s = input.start.getTime();
  const e = input.end.getTime();
  if (!(e > s)) throw new RangeError('end must be after start');
  const totalMinutes = (e - s) / MINUTE_MS;

  const baseAmount =
    input.unit === ServiceUnit.PER_HOUR ? Math.round((input.basePrice * totalMinutes) / 60) : input.basePrice;

  const night = nightMinutes(input.start, input.end);
  const nightSurcharge = Math.round(baseAmount * (night / totalMinutes) * input.rates.night);

  let holidayRaw = 0;
  const holidayNames: string[] = [];
  for (const date of vnDatesOf(s, e)) {
    const h = input.holidays.find((x) => x.date === date);
    if (!h) continue;
    const midnight = vnMidnight(date);
    const share = overlapMs(s, e, midnight, midnight + 24 * HOUR_MS) / (e - s);
    const rate = h.type === HolidayType.TET ? input.rates.holidayMajor : input.rates.holidayMinor;
    holidayRaw += baseAmount * share * rate;
    if (!holidayNames.includes(h.name)) holidayNames.push(h.name);
  }
  const holidaySurcharge = Math.round(holidayRaw);

  const heavyPatientSurcharge = input.heavyPatient ? Math.round(baseAmount * input.rates.heavyPatient) : 0;

  const totalAmount = baseAmount + nightSurcharge + holidaySurcharge + heavyPatientSurcharge;
  return {
    hours: totalMinutes / 60,
    baseAmount,
    nightSurcharge,
    nightHours: night / 60,
    holidaySurcharge,
    holidayName: holidayNames.length ? holidayNames.join(', ') : null,
    heavyPatientSurcharge,
    platformFee: Math.round(totalAmount * input.rates.commission),
    platformFeeRate: input.rates.commission,
    totalAmount,
  };
}

export function toSnapshot(q: PricingQuote): PriceSnapshot {
  return {
    baseAmount: q.baseAmount,
    surchargeAmount: q.nightSurcharge + q.holidaySurcharge + q.heavyPatientSurcharge,
    platformFee: q.platformFee,
    totalAmount: q.totalAmount,
  };
}
