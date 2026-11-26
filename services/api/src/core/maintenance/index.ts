/**
 * Maintenance embargo (BE-2 · Phase 8 · NFR-AVAIL-01 / CT-23).
 *
 * SRS: "ưu tiên không bảo trì hệ thống vào khung giờ chuyển giao ca đêm 19:00 - 21:00" — nurses check out of day
 * shifts and into night shifts, families follow the handover. No migration, no deploy / restart, no planned downtime
 * inside that window (Vietnam time, no DST).
 *
 * The window comes from system_configs (MAINTENANCE_EMBARGO_START / _END, migration 0028) so ops can widen it without
 * a release; before 0028 is applied (fresh database) the SRS default 19:00–21:00 is used.
 */
import { TIMEZONE_DISPLAY } from '@healthcare-system/shared';
import type { Queryable } from '../database';

export interface EmbargoWindow {
  /** Minutes after local midnight. start < end (the window never crosses midnight). */
  startMin: number;
  endMin: number;
}

/** SRS NFR-AVAIL-01 default. */
export const DEFAULT_EMBARGO: EmbargoWindow = { startMin: 19 * 60, endMin: 21 * 60 };

export class MaintenanceEmbargoError extends Error {
  readonly code = 'MAINTENANCE_EMBARGO';
  constructor(message: string) {
    super(message);
    this.name = 'MaintenanceEmbargoError';
  }
}

/** 'HH:MM' → minutes after midnight; throws on anything else. */
export function parseHhmm(value: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) throw new Error(`Invalid time "${value}" (expected HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function windowFrom(start: string, end: string): EmbargoWindow {
  const w = { startMin: parseHhmm(start), endMin: parseHhmm(end) };
  if (w.endMin <= w.startMin) throw new Error(`Embargo window ${start}–${end} must end after it starts, same day`);
  return w;
}

export function formatWindow(w: EmbargoWindow): string {
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${f(w.startMin)}–${f(w.endMin)}`;
}

const localClock = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE_DISPLAY, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Minutes after local (Vietnam) midnight for an instant. */
export function localMinutes(atMs: number): number {
  const parts = localClock.formatToParts(new Date(atMs));
  const h = Number(parts.find((p) => p.type === 'hour')!.value);
  const m = Number(parts.find((p) => p.type === 'minute')!.value);
  return h * 60 + m;
}

/** Inside [start, end) local time. */
export function isInsideEmbargo(atMs: number, w: EmbargoWindow = DEFAULT_EMBARGO): boolean {
  const m = localMinutes(atMs);
  return m >= w.startMin && m < w.endMin;
}

/** Minutes left until the window closes (0 when outside). */
export function minutesUntilEmbargoEnds(atMs: number, w: EmbargoWindow = DEFAULT_EMBARGO): number {
  return isInsideEmbargo(atMs, w) ? w.endMin - localMinutes(atMs) : 0;
}

/**
 * Would a job scheduled with this cron pattern (minute hour * * *, Vietnam time) run inside the window?
 * Only fixed-hour patterns are checked: "every N" / hourly sweeps are normal operation, not maintenance.
 */
export function cronHitsEmbargo(pattern: string, w: EmbargoWindow = DEFAULT_EMBARGO): boolean {
  const [minute, hour] = pattern.trim().split(/\s+/);
  if (!/^\d+$/.test(minute ?? '') || !/^\d+(,\d+)*$/.test(hour ?? '')) return false;
  return hour.split(',').some((h) => {
    const at = Number(h) * 60 + Number(minute);
    return at >= w.startMin && at < w.endMin;
  });
}

/** Reads the window from system_configs when migration 0028 is there; otherwise the SRS default. */
export async function loadEmbargoWindow(db: Queryable): Promise<EmbargoWindow> {
  const exists = await db.query<{ ok: boolean }>(`SELECT to_regclass('public.system_configs') IS NOT NULL AS ok`);
  if (!exists.rows[0]?.ok) return DEFAULT_EMBARGO;
  const { rows } = await db.query<{ config_key: string; config_value: string }>(
    `SELECT config_key, config_value FROM system_configs WHERE config_key IN ('MAINTENANCE_EMBARGO_START', 'MAINTENANCE_EMBARGO_END')`,
  );
  const get = (k: string) => rows.find((r: { config_key: string; config_value: string }) => r.config_key === k)?.config_value;
  const start = get('MAINTENANCE_EMBARGO_START');
  const end = get('MAINTENANCE_EMBARGO_END');
  return start && end ? windowFrom(start, end) : DEFAULT_EMBARGO;
}

export type EmbargoMode = 'enforce' | 'warn' | 'off';

/** production → enforce; MAINTENANCE_EMBARGO=enforce|warn|off overrides (CI / local default: warn). */
export function embargoMode(env: NodeJS.ProcessEnv = process.env): EmbargoMode {
  const v = (env.MAINTENANCE_EMBARGO ?? '').toLowerCase();
  if (v === 'enforce' || v === 'warn' || v === 'off') return v;
  return env.NODE_ENV === 'production' ? 'enforce' : 'warn';
}

/**
 * Decision for a planned change (migration, deploy, restart). `override` = a written reason from the operator
 * (incident fix that cannot wait): allowed, but loudly logged.
 */
export function checkEmbargo(
  atMs: number,
  w: EmbargoWindow,
  mode: EmbargoMode,
  what: string,
  override?: string | null,
): { allowed: boolean; message: string | null } {
  if (mode === 'off' || !isInsideEmbargo(atMs, w)) return { allowed: true, message: null };
  const base =
    `${what} trong khung bàn giao ca ${formatWindow(w)} (giờ VN, NFR-AVAIL-01). ` +
    `Còn ${minutesUntilEmbargoEnds(atMs, w)} phút nữa hết khung.`;
  if (override && override.trim().length >= 10) {
    return { allowed: true, message: `[embargo] OVERRIDE — ${base} Lý do: ${override.trim()}` };
  }
  if (mode === 'warn') return { allowed: true, message: `[embargo] CẢNH BÁO — ${base}` };
  return {
    allowed: false,
    message:
      `[embargo] DỪNG — không được ${what.toLowerCase()} ${base} ` +
      'Chỉ sự cố khẩn cấp mới được bỏ qua: thêm --override-embargo="<lý do, ≥ 10 ký tự>".',
  };
}
