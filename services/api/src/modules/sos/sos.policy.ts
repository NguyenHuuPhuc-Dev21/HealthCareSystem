/**
 * sos — pure rules (BE-3 · Phase 4 · FR-SHIFT-05).
 */
import type { SosBookingRow, SosRaisedBy, VitalReading } from './sos.types';

/** Emergency is never refused for a technicality: from the confirmed booking (nurse on the way) through the shift. */
const RAISABLE = new Set(['CONFIRMED', 'IN_PROGRESS']);

export type RaiseError = 'NOT_A_PARTY' | 'NOT_ACTIVE';

export function raiseError(b: Pick<SosBookingRow, 'customer_id' | 'nurse_id' | 'execution_status'>, userId: string): RaiseError | null {
  if (userId !== b.customer_id && userId !== b.nurse_id) return 'NOT_A_PARTY';
  if (!RAISABLE.has(b.execution_status)) return 'NOT_ACTIVE';
  return null;
}

export function roleOf(b: Pick<SosBookingRow, 'nurse_id'>, userId: string): SosRaisedBy {
  return userId === b.nurse_id ? 'NURSE' : 'FAMILY';
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const pick = (o: Record<string, unknown>, ...keys: string[]): number | null => {
  for (const k of keys) {
    const v = num(o[k]);
    if (v !== null) return v;
  }
  return null;
};

/**
 * Vitals sent by the app (nurse-app currentVitals uses heartRate / bloodPressureSystolic…, the family view pulse /
 * systolic…) or the latest reading of shift_logs.vital_signs_log. Null when there is nothing usable.
 */
export function toVitalReading(o: Record<string, unknown> | null | undefined, fallbackAt: string): VitalReading | null {
  if (!o || typeof o !== 'object') return null;
  const r: VitalReading = {
    id: typeof o.id === 'string' ? o.id : 'sos-snapshot',
    recordedAt: typeof o.recordedAt === 'string' ? o.recordedAt : typeof o.measuredAt === 'string' ? o.measuredAt : typeof o.timestamp === 'string' ? o.timestamp : fallbackAt,
    pulse: pick(o, 'pulse', 'heartRate'),
    temperatureC: pick(o, 'temperatureC', 'temperature'),
    systolic: pick(o, 'systolic', 'bloodPressureSystolic'),
    diastolic: pick(o, 'diastolic', 'bloodPressureDiastolic'),
    spo2: pick(o, 'spo2', 'spO2'),
    note: typeof o.notes === 'string' ? o.notes : typeof o.note === 'string' ? o.note : null,
  };
  return r.pulse === null && r.temperatureC === null && r.systolic === null && r.spo2 === null ? null : r;
}

/** The newest reading of the shift log (entries carry recordedAt). */
export function latestLoggedVital(log: Array<Record<string, unknown>> | null): Record<string, unknown> | null {
  if (!log || log.length === 0) return null;
  return [...log].sort((a, b) => String(b.recordedAt ?? '').localeCompare(String(a.recordedAt ?? '')))[0];
}

const coord = (v: unknown): number | null => num(v);

/** Position: what the phone sent, else the check-in position, else the care address. */
export function resolvePosition(body: { lat?: number; lng?: number }, b: SosBookingRow): { lat: number; lng: number } | null {
  const valid = (lat: number | null, lng: number | null) => lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (valid(coord(body.lat), coord(body.lng))) return { lat: Number(body.lat), lng: Number(body.lng) };
  const ci = [coord(b.checkin_lat), coord(b.checkin_lng)] as const;
  if (valid(ci[0], ci[1])) return { lat: ci[0]!, lng: ci[1]! };
  const care = [coord(b.care_lat), coord(b.care_lng)] as const;
  if (valid(care[0], care[1])) return { lat: care[0]!, lng: care[1]! };
  return null;
}

/** One line for push / SMS: what, where, the vitals. No diagnosis, no medical record. */
export function alertBody(who: string, at: string, pos: { lat: number; lng: number } | null, v: VitalReading | null): string {
  const parts = [`${who} bấm SOS lúc ${at}. Gọi 115 ngay nếu chưa gọi.`];
  if (pos) parts.push(`Vị trí: https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`);
  if (v) {
    const bp = v.systolic !== null && v.diastolic !== null ? ` · HA ${v.systolic}/${v.diastolic}` : '';
    parts.push(`Sinh hiệu: mạch ${v.pulse ?? '—'} · SpO2 ${v.spo2 ?? '—'}%${bp} · ${v.temperatureC ?? '—'}°C`);
  }
  return parts.join(' ');
}

/** HH:mm in Vietnam time. */
export function vnClock(ms: number): string {
  return new Date(ms + 7 * 3_600_000).toISOString().slice(11, 16);
}
