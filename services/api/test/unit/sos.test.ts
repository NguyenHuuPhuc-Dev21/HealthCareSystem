import { describe, expect, it } from 'vitest';
import { alertBody, latestLoggedVital, raiseError, resolvePosition, roleOf, toVitalReading, vnClock } from '../../src/modules/sos/sos.policy';
import type { SosBookingRow } from '../../src/modules/sos/sos.types';

/** sos (BE-3 · Phase 4 · FR-SHIFT-05): pure rules — who may raise, vitals, position, the alert text. */
describe('sos policy', () => {
  const b: SosBookingRow = {
    id: 'b',
    booking_code: 'HC-1',
    customer_id: 'family',
    nurse_id: 'nurse',
    execution_status: 'IN_PROGRESS',
    patient_name: 'Bà Lan',
    nurse_name: 'Mai',
    checkin_lat: '10.7700000',
    checkin_lng: '106.7000000',
    care_lat: 10.5,
    care_lng: 106.5,
    vital_signs_log: null,
  };

  it('the nurse or the family of a confirmed / running booking may raise it; nobody else, never after the shift', () => {
    expect(raiseError(b, 'nurse')).toBeNull();
    expect(raiseError(b, 'family')).toBeNull();
    expect(raiseError({ ...b, execution_status: 'CONFIRMED' }, 'nurse')).toBeNull();
    expect(raiseError(b, 'stranger')).toBe('NOT_A_PARTY');
    expect(raiseError({ ...b, execution_status: 'COMPLETED' }, 'nurse')).toBe('NOT_ACTIVE');
    expect(raiseError({ ...b, execution_status: 'DRAFT' }, 'family')).toBe('NOT_ACTIVE');
    expect(roleOf(b, 'nurse')).toBe('NURSE');
    expect(roleOf(b, 'family')).toBe('FAMILY');
  });

  it('vitals: nurse-app names (heartRate…) and family names (pulse…) give the same reading; nothing usable → null', () => {
    const fromNurse = toVitalReading({ heartRate: 130, spo2: 86, bloodPressureSystolic: 85, bloodPressureDiastolic: 50, temperature: 38.9 }, 'T');
    expect(fromNurse).toEqual({ id: 'sos-snapshot', recordedAt: 'T', pulse: 130, temperatureC: 38.9, systolic: 85, diastolic: 50, spo2: 86, note: null });
    expect(toVitalReading({ pulse: '130', spo2: 86, systolic: 85, diastolic: 50, temperatureC: 38.9 }, 'T')).toEqual(fromNurse);
    expect(toVitalReading({ foo: 1 }, 'T')).toBeNull();
    expect(toVitalReading(null, 'T')).toBeNull();
    expect(latestLoggedVital([{ recordedAt: '2026-11-26T01:00:00Z', heartRate: 80 }, { recordedAt: '2026-11-26T02:00:00Z', heartRate: 95 }])).toMatchObject({ heartRate: 95 });
    expect(latestLoggedVital([])).toBeNull();
  });

  it('position: the phone, else the check-in position, else the care address', () => {
    expect(resolvePosition({ lat: 10.1, lng: 106.1 }, b)).toEqual({ lat: 10.1, lng: 106.1 });
    expect(resolvePosition({}, b)).toEqual({ lat: 10.77, lng: 106.7 });
    expect(resolvePosition({}, { ...b, checkin_lat: null, checkin_lng: null })).toEqual({ lat: 10.5, lng: 106.5 });
    expect(resolvePosition({ lat: 200, lng: 1 }, { ...b, checkin_lat: null, checkin_lng: null, care_lat: null, care_lng: null })).toBeNull();
  });

  it('the alert text: who, when (Vietnam time), "call 115", a map link and the vitals', () => {
    const at = vnClock(Date.parse('2026-11-26T02:05:00Z'));
    expect(at).toBe('09:05');
    const text = alertBody('Điều dưỡng Mai', at, { lat: 10.77, lng: 106.7 }, { id: 'x', recordedAt: 'T', pulse: 130, temperatureC: 38.9, systolic: 85, diastolic: 50, spo2: 86 });
    expect(text).toContain('Điều dưỡng Mai bấm SOS lúc 09:05');
    expect(text).toContain('Gọi 115');
    expect(text).toContain('https://www.google.com/maps?q=10.770000,106.700000');
    expect(text).toContain('mạch 130 · SpO2 86% · HA 85/50 · 38.9°C');
    expect(alertBody('Người nhà', at, null, null)).not.toContain('maps');
  });
});
