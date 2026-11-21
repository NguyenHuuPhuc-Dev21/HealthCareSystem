import { describe, expect, it } from 'vitest';
import { HolidayType, MobilityStatus, ServiceUnit } from '@healthcare-system/shared';
import { computeQuote, isHeavyPatient, nightMinutes, toSnapshot } from '../../src/modules/pricing-engine/pricing-engine.policy';
import type { Holiday, PriceInput, PricingRates } from '../../src/modules/pricing-engine/pricing-engine.types';

/**
 * pricing-engine — FR-BOOK-01, BR-03 §2.2, RTM TC-PRICE-01.
 * Pure engine with the SRS rates; includes both SRS worked examples.
 */

const RATES: PricingRates = { night: 0.2, holidayMajor: 3, holidayMinor: 2, heavyPatient: 0.15, commission: 0.15 };
const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const TET: Holiday = { date: '2027-02-06', name: 'Tết Nguyên Đán (Mùng 1)', type: HolidayType.TET };
const NATIONAL_DAY: Holiday = { date: '2026-09-02', name: 'Ngày Quốc khánh', type: HolidayType.PUBLIC_HOLIDAY };

const price = (over: Partial<PriceInput>) =>
  computeQuote({
    unit: ServiceUnit.PER_HOUR,
    basePrice: 50_000,
    start: vn('2026-11-16', '08:00'),
    end: vn('2026-11-16', '12:00'),
    heavyPatient: false,
    holidays: [],
    rates: RATES,
    ...over,
  });

describe('SRS worked examples', () => {
  it('night shift 20:00–06:00 at 50,000/h → 500,000 + 8 night hours × 20% = 580,000', () => {
    const q = price({ start: vn('2026-11-16', '20:00'), end: vn('2026-11-17', '06:00') });
    expect(q).toMatchObject({ hours: 10, baseAmount: 500_000, nightHours: 8, nightSurcharge: 80_000, totalAmount: 580_000 });
  });

  it('a 500,000 shift on Tết → +300% → 2,000,000', () => {
    const q = price({
      unit: ServiceUnit.PER_SHIFT,
      basePrice: 500_000,
      start: vn('2027-02-06', '08:00'),
      end: vn('2027-02-06', '16:00'),
      holidays: [TET],
    });
    expect(q).toMatchObject({ baseAmount: 500_000, holidaySurcharge: 1_500_000, nightSurcharge: 0, totalAmount: 2_000_000 });
    expect(q.holidayName).toBe(TET.name);
  });
});

describe('night surcharge — only the 22:00–06:00 part', () => {
  it('counts night minutes at the boundaries', () => {
    expect(nightMinutes(vn('2026-11-16', '08:00'), vn('2026-11-16', '22:00'))).toBe(0); // ends exactly at 22:00
    expect(nightMinutes(vn('2026-11-16', '06:00'), vn('2026-11-16', '10:00'))).toBe(0); // starts exactly at 06:00
    expect(nightMinutes(vn('2026-11-16', '21:30'), vn('2026-11-16', '22:30'))).toBe(30);
    expect(nightMinutes(vn('2026-11-16', '05:00'), vn('2026-11-16', '07:00'))).toBe(60);
    expect(nightMinutes(vn('2026-11-16', '22:00'), vn('2026-11-17', '06:00'))).toBe(480);
    expect(nightMinutes(vn('2026-11-16', '08:00'), vn('2026-11-17', '08:00'))).toBe(480); // 24 h shift
  });

  it('uses Vietnam time, not UTC', () => {
    // 15:00Z = 22:00 in Vietnam
    expect(nightMinutes(new Date('2026-11-16T15:00:00Z'), new Date('2026-11-16T16:00:00Z'))).toBe(60);
  });

  it('a daytime shift has no night surcharge', () => {
    expect(price({})).toMatchObject({ baseAmount: 200_000, nightSurcharge: 0, totalAmount: 200_000 });
  });

  it('fixed-price services are surcharged on the night share of the visit', () => {
    // PER_SHIFT 400,000 for 20:00–24:00: half of it is night → 400,000 × 1/2 × 20% = 40,000
    const q = price({ unit: ServiceUnit.PER_SHIFT, basePrice: 400_000, start: vn('2026-11-16', '20:00'), end: vn('2026-11-17', '00:00') });
    expect(q).toMatchObject({ baseAmount: 400_000, nightSurcharge: 40_000, totalAmount: 440_000 });
  });
});

describe('holiday surcharge', () => {
  it('public holiday → +200%', () => {
    const q = price({ start: vn('2026-09-02', '08:00'), end: vn('2026-09-02', '12:00'), holidays: [NATIONAL_DAY] });
    expect(q).toMatchObject({ baseAmount: 200_000, holidaySurcharge: 400_000, totalAmount: 600_000 });
  });

  it('only the part of the visit on the holiday date is surcharged', () => {
    // 20:00 on 1 Sep → 04:00 on 2 Sep (8 h, 400,000): 4 h fall on the holiday → 200,000 × 200% = 400,000
    const q = price({ start: vn('2026-09-01', '20:00'), end: vn('2026-09-02', '04:00'), holidays: [NATIONAL_DAY] });
    expect(q.holidaySurcharge).toBe(400_000);
    expect(q.nightSurcharge).toBe(60_000); // 22:00–04:00 = 6 h × 50,000 × 20%
    expect(q.totalAmount).toBe(400_000 + 400_000 + 60_000);
  });

  it('a day that is not a holiday has none', () => {
    expect(price({ holidays: [NATIONAL_DAY, TET] }).holidaySurcharge).toBe(0);
    expect(price({ holidays: [NATIONAL_DAY] }).holidayName).toBeNull();
  });
});

describe('heavy patient + no compounding', () => {
  it('weight >= 80 kg or BEDRIDDEN', () => {
    expect(isHeavyPatient(80, MobilityStatus.NORMAL)).toBe(true);
    expect(isHeavyPatient(79.9, MobilityStatus.NORMAL)).toBe(false);
    expect(isHeavyPatient(null, MobilityStatus.BEDRIDDEN)).toBe(true);
    expect(isHeavyPatient(null, MobilityStatus.PARTIAL)).toBe(false);
  });

  it('+15% of the base', () => {
    expect(price({ heavyPatient: true })).toMatchObject({ heavyPatientSurcharge: 30_000, totalAmount: 230_000 });
  });

  it('every surcharge is taken on the BASE: night + Tết + heavy patient add up, never multiply', () => {
    // Tết night 20:00–06:00 next day (also Tết), 50,000/h, heavy patient
    const q = price({
      start: vn('2027-02-06', '20:00'),
      end: vn('2027-02-07', '06:00'),
      heavyPatient: true,
      holidays: [TET, { ...TET, date: '2027-02-07', name: 'Tết Nguyên Đán (Mùng 2)' }],
    });
    expect(q.baseAmount).toBe(500_000);
    expect(q.nightSurcharge).toBe(80_000); // 500,000 × 8/10 × 20%
    expect(q.holidaySurcharge).toBe(1_500_000); // 500,000 × 300%
    expect(q.heavyPatientSurcharge).toBe(75_000); // 500,000 × 15%
    expect(q.totalAmount).toBe(500_000 + 80_000 + 1_500_000 + 75_000);
    expect(q.holidayName).toBe('Tết Nguyên Đán (Mùng 1), Tết Nguyên Đán (Mùng 2)');
  });
});

describe('units, fee and snapshot', () => {
  it('PER_TIME and PER_SHIFT use the catalog price as the base; PER_HOUR multiplies by the hours', () => {
    expect(price({ unit: ServiceUnit.PER_TIME, basePrice: 180_000, end: vn('2026-11-16', '09:00') }).baseAmount).toBe(180_000);
    expect(price({ unit: ServiceUnit.PER_SHIFT, basePrice: 750_000, end: vn('2026-11-16', '16:00') }).baseAmount).toBe(750_000);
    expect(price({ unit: ServiceUnit.PER_HOUR, basePrice: 50_000, end: vn('2026-11-16', '16:00') }).baseAmount).toBe(400_000);
  });

  it('platform fee = 15% of the total and is NOT added to it', () => {
    const q = price({ start: vn('2026-11-16', '20:00'), end: vn('2026-11-17', '06:00') });
    expect(q.platformFee).toBe(87_000);
    expect(q.platformFeeRate).toBe(0.15);
    expect(q.totalAmount).toBe(580_000);
  });

  it('amounts are whole đồng', () => {
    const q = price({ unit: ServiceUnit.PER_TIME, basePrice: 333_333, start: vn('2026-11-16', '21:40'), end: vn('2026-11-16', '22:25'), heavyPatient: true });
    for (const v of [q.baseAmount, q.nightSurcharge, q.heavyPatientSurcharge, q.platformFee, q.totalAmount]) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('snapshot stored on the booking = base, summed surcharges, fee, total', () => {
    const q = price({ start: vn('2026-11-16', '20:00'), end: vn('2026-11-17', '06:00'), heavyPatient: true });
    expect(toSnapshot(q)).toEqual({ baseAmount: 500_000, surchargeAmount: 80_000 + 75_000, platformFee: Math.round(655_000 * 0.15), totalAmount: 655_000 });
  });

  it('rejects an empty or reversed slot', () => {
    expect(() => price({ end: vn('2026-11-16', '08:00') })).toThrow();
  });
});
