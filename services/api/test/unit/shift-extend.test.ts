import { describe, expect, it } from 'vitest';
import { ExecutionStatus, ServiceUnit } from '@healthcare-system/shared';
import {
  extensionPaymentCode,
  hourlyRate,
  isExtensionPaymentCode,
  nextShiftConflict,
  requestProblem,
  viewStatus,
} from '../../src/modules/shift-extend/shift-extend.policy';
import { extendSchema, respondSchema } from '../../src/modules/shift-extend/shift-extend.schema';

/**
 * shift-extend — FR-SHIFT-03, BR-15 §2.3. Pure rules here; the whole flow (pricing, nurse answer, payment,
 * escrow, exclusion constraint) runs on real PostgreSQL in test/integration/shift-extend.test.ts.
 */
const MIN = 60_000;
const END = Date.parse('2027-01-01T06:00:00Z');

describe('requestProblem', () => {
  const ask = (over: { status?: ExecutionStatus; hours?: number; now?: number } = {}) =>
    requestProblem(over.status ?? ExecutionStatus.IN_PROGRESS, over.hours ?? 1, over.now ?? END - 60 * MIN, END, 30, 4);

  it('allows whole hours on a running shift up to the deadline', () => {
    expect(ask()).toBeNull();
    expect(ask({ now: END - 30 * MIN })).toBeNull(); // exactly 30 minutes before the end: still allowed
    expect(ask({ hours: 4 })).toBeNull();
  });

  it('closes 30 minutes before the scheduled end (SRS: "at least 30 minutes before")', () => {
    expect(ask({ now: END - 30 * MIN + 1 })).toBe('EXTENSION_WINDOW_CLOSED');
    expect(ask({ now: END + MIN })).toBe('EXTENSION_WINDOW_CLOSED');
  });

  it('only for a shift in progress', () => {
    for (const s of [ExecutionStatus.CONFIRMED, ExecutionStatus.COMPLETED, ExecutionStatus.CANCELLED, ExecutionStatus.MATCHING]) {
      expect(ask({ status: s })).toBe('BOOKING_NOT_IN_PROGRESS');
    }
  });

  it('refuses 0, fractions and more than the configured maximum', () => {
    expect(ask({ hours: 0 })).toBe('INVALID_EXTENSION_HOURS');
    expect(ask({ hours: 1.5 })).toBe('INVALID_EXTENSION_HOURS');
    expect(ask({ hours: 5 })).toBe('INVALID_EXTENSION_HOURS');
    expect(requestProblem(ExecutionStatus.IN_PROGRESS, 5, END - 60 * MIN, END, 30, 6)).toBeNull();
  });
});

describe('hourlyRate', () => {
  it('PER_HOUR uses the catalogue price; PER_SHIFT / PER_TIME spread the visit over its booked hours', () => {
    expect(hourlyRate(ServiceUnit.PER_HOUR, 90_000, 3)).toBe(90_000);
    expect(hourlyRate(ServiceUnit.PER_SHIFT, 400_000, 4)).toBe(100_000);
    expect(hourlyRate(ServiceUnit.PER_SHIFT, 750_000, 8)).toBe(93_750);
    expect(hourlyRate(ServiceUnit.PER_TIME, 200_000, 3)).toBe(66_667);
  });

  it('refuses a non-positive booked length', () => {
    expect(() => hourlyRate(ServiceUnit.PER_SHIFT, 400_000, 0)).toThrow(RangeError);
  });
});

describe('nextShiftConflict', () => {
  const at = (h: number) => new Date(END + h * 60 * MIN);
  const busy = (startH: number, endH: number) => [{ id: 'x', start_time: at(startH), end_time: at(endH) }];
  const from = END;
  const to = END + 60 * MIN; // 1 extra hour

  it('is free when the next shift starts after the extension plus the travel buffer', () => {
    expect(nextShiftConflict(busy(2, 4), from, to, 60)).toBe(false); // starts exactly at end + 1h + 60 min
    expect(nextShiftConflict([], from, to, 60)).toBe(false);
  });

  it('conflicts inside the travel buffer or on overlap', () => {
    expect(nextShiftConflict(busy(1.5, 4), from, to, 60)).toBe(true);
    expect(nextShiftConflict(busy(0.5, 3), from, to, 60)).toBe(true);
  });

  it('ignores a shift that ended before the extension starts', () => {
    expect(nextShiftConflict(busy(-5, 0), from, to, 60)).toBe(false);
  });
});

describe('viewStatus and payment codes', () => {
  it('maps the stored status to what the apps show', () => {
    expect(viewStatus('REQUESTED', null)).toBe('AWAITING_NURSE');
    expect(viewStatus('ACCEPTED', null)).toBe('AWAITING_PAYMENT');
    expect(viewStatus('ACCEPTED', new Date())).toBe('CONFIRMED');
    expect(viewStatus('PAID', new Date())).toBe('CONFIRMED');
    expect(viewStatus('REJECTED', null)).toBe('DECLINED');
    expect(viewStatus('EXPIRED', null)).toBe('EXPIRED');
  });

  it('builds and recognises extension payment codes', () => {
    expect(extensionPaymentCode('HC-261121-ABC123', 2)).toBe('HC-261121-ABC123-GH2');
    expect(isExtensionPaymentCode('HC-261121-ABC123-GH2')).toBe(true);
    expect(isExtensionPaymentCode('HC-261121-ABC123')).toBe(false);
  });
});

describe('schemas', () => {
  it('extend: whole hours only, no extra fields', () => {
    expect(extendSchema.safeParse({ hours: 2 }).success).toBe(true);
    expect(extendSchema.safeParse({ hours: 1.5 }).success).toBe(false);
    expect(extendSchema.safeParse({ hours: 1, amount: 1 }).success).toBe(false); // the client never sends amounts
  });

  it('respond: accepts the nurse app body (with bookingId)', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(respondSchema.safeParse({ bookingId: id, extensionId: id, approved: true }).success).toBe(true);
    expect(respondSchema.safeParse({ extensionId: 'x', approved: true }).success).toBe(false);
  });
});
