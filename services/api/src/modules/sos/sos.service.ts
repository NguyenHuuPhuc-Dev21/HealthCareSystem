/**
 * sos — emergency alerts during a shift (BE-3 · Phase 4 · FR-SHIFT-05 · TC-SOS-01 · BR-23).
 * Contract: docs/api/sos.api.md
 *
 *  POST /bookings/:id/sos                 nurse (nurse app) or family (patient web), booking CONFIRMED / IN_PROGRESS.
 *                                         Under the booking lock: one open alert per booking (pressing again or the
 *                                         nurse app's offline replay returns it, nobody is alerted twice) + the RAISED
 *                                         event in shift_logs.emergency_incident_log. After COMMIT, in parallel:
 *                                         family + every active Admin (+ the nurse when the family raised it) get a
 *                                         HIGH notification type SOS — in-app + WebSocket + push, SMS after 60 s
 *                                         unacknowledged — with the GPS link and the latest vital signs.
 *  GET  /sos-alerts?status=OPEN|…         the viewer's alerts (family / nurse: their bookings; Admin: all)
 *  GET  /bookings/:id/sos                 the booking's open (else latest) alert, for the tracking screens
 *  POST /sos-alerts/:id/acknowledge       family or Admin: "I got it" → ACKNOWLEDGED, their SMS fallback stops
 *  POST /sos-alerts/:id/report            nurse / Admin: what happened (115 called, hospital…) → incident log
 *  POST /admin/sos-alerts/:id/close       Admin, with the outcome → CLOSED, audited CLOSE_SOS_INCIDENT
 *
 * The platform assists; it never replaces 115 (the nurse app dials 115 before calling this API).
 */
import { AuditAction, NotificationPriority } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { query, withTransaction, type Queryable } from '../../core/database';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notice, Notify } from '../notifications/notifications.types';
import { alertBody, latestLoggedVital, raiseError, resolvePosition, roleOf, toVitalReading, vnClock } from './sos.policy';
import * as repo from './sos.repo';
import {
  MAX_SOS_LISTED,
  SOS_ACK_NOTICE,
  SOS_CLOSED_NOTICE,
  SOS_NOTICE,
  SOS_OUTCOMES,
  type RaiseSosBody,
  type SosAlertDto,
  type SosOutcome,
  type SosRaiseResult,
  type SosRow,
  type SosStatus,
} from './sos.types';

const OPEN: SosStatus[] = ['ACTIVE', 'ACKNOWLEDGED'];
const ALL: SosStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'CLOSED'];

export interface Viewer {
  id: string;
  role: string;
}

export interface SosDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  /** notifications; the singleton passes notifyUser. */
  notify?: Notify;
  now?: () => number;
}

export function toDto(r: SosRow): SosAlertDto {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    alertId: r.id,
    bookingId: r.booking_id,
    bookingCode: r.booking_code,
    patientName: r.patient_name,
    nurseName: r.nurse_name ?? null,
    raisedAt: new Date(r.created_at).toISOString(),
    raisedBy: r.raised_by_role,
    status: r.status,
    lat: n(r.lat),
    lng: n(r.lng),
    latestVitals: r.vitals ?? null,
    acknowledgedAt: r.acknowledged_at ? new Date(r.acknowledged_at).toISOString() : null,
    closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
    outcome: r.outcome ?? null,
    closeNote: r.close_note ?? null,
  };
}

export class SosService {
  constructor(private readonly deps: SosDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  // ---- raise ---------------------------------------------------------------------------------------

  async raise(user: Viewer, bookingId: string, body: RaiseSosBody): Promise<SosRaiseResult> {
    const nowMs = this.nowMs();
    const at = new Date(nowMs);
    const out = await this.deps.withTx(async (db) => {
      const b = await repo.lockBooking(db, bookingId);
      if (!b) throw forbidden('FORBIDDEN', 'You do not have access to this booking'); // no existence leak
      const err = raiseError(b, user.id);
      if (err === 'NOT_A_PARTY') throw forbidden('FORBIDDEN', 'You do not have access to this booking');
      if (err) throw conflict('SHIFT_NOT_ACTIVE', 'SOS is available from the confirmed booking until check-out');

      const open = await repo.findOpenForBooking(db, bookingId);
      if (open) return { id: open.id, created: false };

      const role = roleOf(b, user.id);
      const pos = resolvePosition(body, b);
      const vitals = toVitalReading(body.vitals ?? null, at.toISOString()) ?? toVitalReading(latestLoggedVital(b.vital_signs_log), at.toISOString());
      const id = await repo.insertAlert(db, { bookingId, raisedBy: user.id, role, lat: pos?.lat ?? null, lng: pos?.lng ?? null, vitals, at });
      await repo.appendIncident(db, bookingId, { at: at.toISOString(), event: 'RAISED', alertId: id, by: user.id, role, lat: pos?.lat ?? null, lng: pos?.lng ?? null, vitals });
      return { id, created: true };
    });

    const row = (await repo.findAlert(this.deps.read, out.id))!;
    if (out.created) await this.alertEveryone(row, nowMs);
    return { ...toDto(row), triggered: true, emergency_id: row.id, created: out.created };
  }

  /** Family + every active Admin (+ the nurse when the family raised it), all at once — target < 2 s (TC-SOS-01). */
  private async alertEveryone(r: SosRow, nowMs: number): Promise<void> {
    if (!this.deps.notify) return;
    const dto = toDto(r);
    const who = r.raised_by_role === 'NURSE' ? `Điều dưỡng ${r.nurse_name ?? ''}`.trim() : 'Người nhà tại hiện trường';
    const pos = dto.lat !== null && dto.lng !== null ? { lat: dto.lat, lng: dto.lng } : null;
    const body = alertBody(who, vnClock(nowMs), pos, dto.latestVitals);
    const recipients = new Set<string>([r.customer_id, ...(await repo.activeAdminIds(this.deps.read))]);
    if (r.raised_by_role === 'FAMILY' && r.nurse_id) recipients.add(r.nurse_id);
    recipients.delete(r.raised_by); // the person who pressed is on the phone with 115
    const data: Record<string, string> = { alertId: r.id, bookingId: r.booking_id, bookingCode: r.booking_code };
    if (pos) Object.assign(data, { lat: String(pos.lat), lng: String(pos.lng) });
    const notices: Notice[] = [...recipients].map((userId) => ({
      userId,
      bookingId: r.booking_id,
      type: SOS_NOTICE,
      priority: NotificationPriority.HIGH,
      title: `KHẨN CẤP · ${r.patient_name} · ca ${r.booking_code}`,
      body,
      data,
    }));
    const notify = this.deps.notify;
    await Promise.all(notices.map((n) => sendNotices(notify, [n])));
  }

  // ---- read ------------------------------------------------------------------------------------------

  async list(user: Viewer, status: string | undefined): Promise<{ items: SosAlertDto[] }> {
    const statuses: SosStatus[] = !status || status === 'OPEN' ? OPEN : status === 'ALL' ? ALL : [status as SosStatus];
    const rows = await repo.listAlerts(this.deps.read, { id: user.id, isAdmin: user.role === 'ADMIN' }, statuses, MAX_SOS_LISTED);
    return { items: rows.map(toDto) };
  }

  /** Open (else latest) alert of a booking the viewer can see; null when there was none. */
  async forBooking(user: Viewer, bookingId: string): Promise<SosAlertDto | null> {
    const r = await repo.currentForBooking(this.deps.read, bookingId);
    if (r && !this.canSee(user, r)) throw forbidden('FORBIDDEN', 'You do not have access to this booking');
    if (!r) {
      const { rows } = await this.deps.read.query(`SELECT customer_id, nurse_id FROM bookings WHERE id = $1`, [bookingId]);
      if (!rows[0] || (user.role !== 'ADMIN' && user.id !== rows[0].customer_id && user.id !== rows[0].nurse_id)) {
        throw forbidden('FORBIDDEN', 'You do not have access to this booking');
      }
      return null;
    }
    return toDto(r);
  }

  /** Admin: the alert with its incident report. */
  async adminDetail(id: string): Promise<SosAlertDto & { incidentLog: unknown[] }> {
    const r = await repo.findAlert(this.deps.read, id);
    if (!r) throw notFound('SOS_NOT_FOUND', 'SOS alert not found');
    return { ...toDto(r), incidentLog: (await repo.incidentLog(this.deps.read, r.booking_id)).filter((e) => (e as { alertId?: string }).alertId === id) };
  }

  private canSee(user: Viewer, r: Pick<SosRow, 'customer_id' | 'nurse_id'>): boolean {
    return user.role === 'ADMIN' || user.id === r.customer_id || user.id === r.nurse_id;
  }

  // ---- acknowledge / report / close ------------------------------------------------------------------

  async acknowledge(user: Viewer, id: string): Promise<SosAlertDto> {
    const nowMs = this.nowMs();
    const changed = await this.deps.withTx(async (db) => {
      const r = await repo.findAlert(db, id, true);
      if (!r || !this.canSee(user, r)) throw notFound('SOS_NOT_FOUND', 'SOS alert not found');
      if (user.id === r.nurse_id && user.role !== 'ADMIN') throw forbidden('FAMILY_OR_ADMIN_ONLY', 'The family or an Admin acknowledges an SOS');
      await repo.ackNotifications(db, user.id, id); // their own SMS fallback stops in every case
      if (r.status !== 'ACTIVE') return null; // already acknowledged / closed: idempotent
      await repo.setAcknowledged(db, id, user.id, new Date(nowMs));
      await repo.appendIncident(db, r.booking_id, { at: new Date(nowMs).toISOString(), event: 'ACKNOWLEDGED', alertId: id, by: user.id, role: user.role });
      return r;
    });
    if (changed?.nurse_id && changed.raised_by_role === 'NURSE') {
      // The nurse on site learns the family / Admin received the alert.
      await sendNotices(this.deps.notify, [
        {
          userId: changed.nurse_id,
          bookingId: changed.booking_id,
          type: SOS_ACK_NOTICE,
          title: `Đã có người nhận cảnh báo SOS ca ${changed.booking_code}`,
          body: user.role === 'ADMIN' ? 'Quản trị viên đã nhận tin và đang phối hợp.' : 'Gia đình đã nhận tin.',
          data: { alertId: id, bookingId: changed.booking_id },
        },
      ]);
    }
    return toDto((await repo.findAlert(this.deps.read, id))!);
  }

  async report(user: Viewer, id: string, b: { note: string; called115?: boolean; hospital?: string | null }): Promise<{ updated: true }> {
    const note = b.note.trim();
    if (note.length < 5) throw badRequest('VALIDATION_ERROR', 'Describe what happened');
    const nowMs = this.nowMs();
    await this.deps.withTx(async (db) => {
      const r = await repo.findAlert(db, id, true);
      if (!r || !this.canSee(user, r)) throw notFound('SOS_NOT_FOUND', 'SOS alert not found');
      if (user.role !== 'ADMIN' && user.id !== r.nurse_id) throw forbidden('NURSE_OR_ADMIN_ONLY', 'The nurse or an Admin writes the incident report');
      await repo.appendIncident(db, r.booking_id, {
        at: new Date(nowMs).toISOString(),
        event: 'REPORT',
        alertId: id,
        by: user.id,
        role: user.role,
        note,
        called115: b.called115,
        hospital: b.hospital?.trim() || null,
      });
    });
    return { updated: true };
  }

  async close(adminId: string, id: string, b: { outcome: SosOutcome; note: string }, ip?: string): Promise<SosAlertDto> {
    const note = b.note.trim();
    if (!SOS_OUTCOMES.includes(b.outcome)) throw badRequest('VALIDATION_ERROR', 'Unknown outcome');
    if (note.length < 10) throw badRequest('VALIDATION_ERROR', 'Write the incident outcome (at least 10 characters)');
    const nowMs = this.nowMs();
    const closed = await this.deps.withTx(async (db) => {
      const r = await repo.findAlert(db, id, true);
      if (!r) throw notFound('SOS_NOT_FOUND', 'SOS alert not found');
      if (r.status === 'CLOSED') throw conflict('SOS_CLOSED', 'This SOS is already closed');
      const at = new Date(nowMs);
      await repo.setClosed(db, id, { by: adminId, at, outcome: b.outcome, note });
      await repo.appendIncident(db, r.booking_id, { at: at.toISOString(), event: 'CLOSED', alertId: id, by: adminId, role: 'ADMIN', outcome: b.outcome, note });
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.CLOSE_SOS_INCIDENT,
        targetTable: 'sos_alerts',
        targetId: id,
        oldValue: { status: r.status },
        newValue: { status: 'CLOSED', outcome: b.outcome, note, bookingId: r.booking_id },
        ipAddress: ip,
      });
      return r;
    });
    await sendNotices(
      this.deps.notify,
      [closed.customer_id, closed.nurse_id].filter((x): x is string => Boolean(x)).map((userId) => ({
        userId,
        bookingId: closed.booking_id,
        type: SOS_CLOSED_NOTICE,
        title: `Đã đóng sự cố khẩn cấp ca ${closed.booking_code}`,
        body: 'Quản trị viên đã ghi nhận kết quả xử lý sự cố.',
        data: { alertId: id, bookingId: closed.booking_id },
      })),
    );
    return toDto((await repo.findAlert(this.deps.read, id))!);
  }
}

let singleton: SosService | null = null;

export function getSosService(): SosService {
  if (!singleton) singleton = new SosService({ read: { query }, withTx: (fn) => withTransaction((c) => fn(c)), notify: notifyUser });
  return singleton;
}

/** For shift-logs (BE-2) GET /bookings/:id/tracking `emergency`: the booking's open (else latest) alert. */
export async function emergencyForBooking(db: Queryable, bookingId: string): Promise<SosAlertDto | null> {
  const r = await repo.currentForBooking(db, bookingId);
  return r ? toDto(r) : null;
}
