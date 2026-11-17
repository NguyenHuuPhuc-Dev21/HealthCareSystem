/**
 * pricing-engine — loads rates (system_configs) and holidays, then prices a visit.
 * BE-2 · Phase 3 · FR-BOOK-01. The ONLY place a booking price is computed (SEC-05: the client never sends amounts).
 */
import type { MobilityStatus, ServiceUnit } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import type { Queryable } from '../../core/database';
import { addDays, vnDate } from '../availability-engine/availability-engine.policy';
import { computeQuote, isHeavyPatient } from './pricing-engine.policy';
import type { Holiday, PricingQuote, PricingRates } from './pricing-engine.types';

export async function loadRates(): Promise<PricingRates> {
  const [night, holidayMajor, holidayMinor, heavyPatient, commission] = await Promise.all([
    getConfigNumber('SURCHARGE_NIGHT_SHIFT'),
    getConfigNumber('SURCHARGE_HOLIDAY_MAJOR'),
    getConfigNumber('SURCHARGE_HOLIDAY_MINOR'),
    getConfigNumber('SURCHARGE_HEAVY_PATIENT'),
    getConfigNumber('PLATFORM_COMMISSION_RATE'),
  ]);
  return { night, holidayMajor, holidayMinor, heavyPatient, commission };
}

export async function loadHolidays(db: Queryable, start: Date, end: Date): Promise<Holiday[]> {
  const { rows } = await db.query<{ date: string; name: string; type: Holiday['type'] }>(
    `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS date, name, holiday_type AS type
       FROM public_holidays
      WHERE holiday_date BETWEEN $1::date AND $2::date`,
    [addDays(vnDate(start.getTime()), -1), vnDate(end.getTime())],
  );
  return rows;
}

export interface QuoteParams {
  service: { unit: ServiceUnit; basePrice: number };
  patient: { weightKg: number | null; mobilityStatus: MobilityStatus | string };
  start: Date;
  end: Date;
}

/** Price one visit. `rates` can be injected (tests); otherwise read from system_configs. */
export async function quotePrice(db: Queryable, p: QuoteParams, rates?: PricingRates): Promise<PricingQuote> {
  return computeQuote({
    unit: p.service.unit,
    basePrice: p.service.basePrice,
    start: p.start,
    end: p.end,
    heavyPatient: isHeavyPatient(p.patient.weightKg, p.patient.mobilityStatus),
    holidays: await loadHolidays(db, p.start, p.end),
    rates: rates ?? (await loadRates()),
  });
}
