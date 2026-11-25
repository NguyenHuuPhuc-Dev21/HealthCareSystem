/**
 * shift-logs — pure rules (BE-2 · Phase 4 · FR-SHIFT-02). No I/O; every number comes in as an argument
 * (system_configs are read by the service).
 */
import {
  AdjustmentStatus,
  ExecutionStatus,
  PaymentMethod,
  type CareActivityItem,
  type ConditionSurchargeStatus,
  type ShiftExecutionState,
  type VitalSignRecord,
} from '@healthcare-system/shared';
import { vnClock, vnDate } from '../availability-engine/availability-engine.policy';
import type {
  BookingTrackingDto,
  CareItem,
  NurseShiftItem,
  PendingExtensionRow,
  ShiftRow,
  StoredVital,
  SurchargePrice,
  SurchargeRow,
  VitalKind,
  VitalsInput,
} from './shift-logs.types';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const VN_OFFSET_MS = 7 * HOUR_MS;

/** Care-checklist item ids the backend completes by itself. */
export const CHECKLIST = {
  INITIAL_VITALS: 'INITIAL_VITALS',
  VERIFY_ORDER: 'VERIFY_ORDER',
  CARE_PROCEDURE: 'CARE_PROCEDURE',
  FINAL_VITALS_HANDOVER: 'FINAL_VITALS_HANDOVER',
} as const;

/**
 * The minimal care checklist written at check-in (the catalogue has no per-service checklist yet — Phase 7
 * admin-catalog). Checking the medical order is mandatory only for invasive services (FR-BOOK-02).
 */
export function defaultChecklist(isInvasive: boolean): CareItem[] {
  const item = (id: string, title: string, category: string, mandatory: boolean): CareItem => ({
    id,
    title,
    category,
    mandatory,
    completed: false,
    completedAt: null,
  });
  const items = [item(CHECKLIST.INITIAL_VITALS, 'Đo sinh hiệu ban đầu (mạch, huyết áp, nhiệt độ, SpO2)', 'VITALS', true)];
  if (isInvasive) items.push(item(CHECKLIST.VERIFY_ORDER, 'Đối chiếu y lệnh gốc, thuốc và vật tư tại chỗ', 'PRESCRIPTION', true));
  items.push(
    item(CHECKLIST.CARE_PROCEDURE, 'Thực hiện quy trình chăm sóc theo dịch vụ đã đặt', 'CARE', true),
    item(CHECKLIST.FINAL_VITALS_HANDOVER, 'Đo sinh hiệu cuối ca và hướng dẫn người nhà theo dõi', 'HANDOVER', true),
  );
  return items;
}

/** Marks items done (idempotent: an item already done keeps its first time). Unknown ids are returned. */
export function completeItems(items: CareItem[], ids: readonly string[], atIso: string): { items: CareItem[]; unknown: string[] } {
  const known = new Set(items.map((i) => i.id));
  const unknown = ids.filter((id) => !known.has(id));
  const wanted = new Set(ids);
  return {
    unknown,
    items: items.map((i) => (wanted.has(i.id) && !i.completed ? { ...i, completed: true, completedAt: atIso } : i)),
  };
}

/** Sets one item on or off. Returns null when the id is unknown. */
export function setItem(items: CareItem[], id: string, completed: boolean, atIso: string): CareItem[] | null {
  if (!items.some((i) => i.id === id)) return null;
  return items.map((i) =>
    i.id !== id ? i : completed ? { ...i, completed: true, completedAt: i.completedAt ?? atIso } : { ...i, completed: false, completedAt: null },
  );
}

export function missingMandatory(items: CareItem[]): string[] {
  return items.filter((i) => i.mandatory && !i.completed).map((i) => i.id);
}

/** A reading as stored. The server keeps its own clock; the device time is kept as measuredAt. */
export function toStoredVital(v: VitalsInput, kind: VitalKind, id: string, nowMs: number): StoredVital {
  const nowIso = new Date(nowMs).toISOString();
  return {
    id,
    kind,
    recordedAt: nowIso,
    measuredAt: v.timestamp ?? nowIso,
    heartRate: v.heartRate,
    bloodPressureSystolic: v.bloodPressureSystolic,
    bloodPressureDiastolic: v.bloodPressureDiastolic,
    temperature: v.temperature,
    spo2: v.spo2,
    respiratoryRate: v.respiratoryRate ?? null,
    bloodGlucose: v.bloodGlucose ?? null,
    notes: v.notes ?? null,
  };
}

/** Allowed device-clock skew for a measurement time. */
export const MAX_CLOCK_SKEW_MS = 5 * MINUTE_MS;

/** A measurement cannot be in the future, nor before the check-in (minus the allowed skew). */
export function measuredAtProblem(measuredAt: string | undefined, checkinMs: number, nowMs: number): boolean {
  if (!measuredAt) return false;
  const t = new Date(measuredAt).getTime();
  return !Number.isFinite(t) || t > nowMs + MAX_CLOCK_SKEW_MS || t < checkinMs - MAX_CLOCK_SKEW_MS;
}

/** The first `windowMinutes` after check-in: a condition discrepancy can still be reported (FR-SHIFT-02). */
export function mismatchWindowOpen(checkinMs: number, nowMs: number, windowMinutes: number): boolean {
  return nowMs <= checkinMs + windowMinutes * MINUTE_MS;
}

/** Extra price of the real condition: the difference of two quotes that only differ by the patient. */
export function surchargeDelta(declared: SurchargePrice, actual: SurchargePrice): SurchargePrice {
  return {
    baseAmount: Math.max(0, actual.baseAmount - declared.baseAmount),
    surchargeAmount: Math.max(0, actual.surchargeAmount - declared.surchargeAmount),
    platformFee: Math.max(0, actual.platformFee - declared.platformFee),
    totalAmount: Math.max(0, actual.totalAmount - declared.totalAmount),
  };
}

export function surchargeViewStatus(s: Pick<SurchargeRow, 'status' | 'applied_at'>): ConditionSurchargeStatus {
  if (s.applied_at) return 'IN_EFFECT';
  switch (s.status) {
    case AdjustmentStatus.REQUESTED:
      return 'AWAITING_FAMILY';
    case AdjustmentStatus.ACCEPTED:
      return 'AWAITING_PAYMENT';
    case AdjustmentStatus.REJECTED:
      return 'DECLINED';
    default:
      return 'EXPIRED';
  }
}

/** `<booking code>-PT<n>` — "phụ thu" transfer content of a condition surcharge (bank transfer bookings). */
export function surchargePaymentCode(bookingCode: string, seq: number): string {
  return `${bookingCode}-PT${seq}`;
}

const SURCHARGE_CODE_RE = /^HC-\d{6}-[A-Z0-9]{6}-PT\d{1,3}$/;

export function isConditionSurchargePaymentCode(orderCode: string): boolean {
  return SURCHARGE_CODE_RE.test(orderCode);
}

/** "2026-11-16 08:02:11 · 10.77690, 106.70090" — Vietnam time, as stamped on the check-in selfie. */
export function watermarkText(checkinMs: number, lat: number, lng: number): string {
  const local = new Date(checkinMs + VN_OFFSET_MS).toISOString();
  return `${local.slice(0, 10)} ${local.slice(11, 19)} · ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Whole years on `atMs`. */
export function ageOn(dob: Date | string | null, atMs: number): number | null {
  if (!dob) return null;
  // DATE columns come back as 'YYYY-MM-DD' or as a JS Date at LOCAL midnight (node-pg): use the local fields.
  const [by, bm, bd] =
    typeof dob === 'string' ? dob.slice(0, 10).split('-').map(Number) : [dob.getFullYear(), dob.getMonth() + 1, dob.getDate()];
  const [ty, tm, td] = vnDate(atMs).split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function timeRange(startMs: number, endMs: number): string {
  return `${vnClock(startMs)}–${vnClock(endMs)}`;
}

/** The nurse may still see the patient's data: before check-out, or until check-out + expiryHours (FR-PRIV-01). */
export function withinRecordWindow(row: Pick<ShiftRow, 'execution_status' | 'checkout_time'>, nowMs: number, expiryHours: number): boolean {
  if (row.execution_status === ExecutionStatus.CONFIRMED || row.execution_status === ExecutionStatus.IN_PROGRESS) return true;
  if (row.execution_status !== ExecutionStatus.COMPLETED || !row.checkout_time) return false;
  return nowMs < new Date(row.checkout_time).getTime() + expiryHours * HOUR_MS;
}

const num = (v: string | number | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

function toVitalRecord(v: StoredVital): VitalSignRecord {
  return {
    id: v.id,
    timestamp: v.measuredAt,
    heartRate: v.heartRate,
    bloodPressureSystolic: v.bloodPressureSystolic,
    bloodPressureDiastolic: v.bloodPressureDiastolic,
    temperature: v.temperature,
    spo2: v.spo2,
    respiratoryRate: v.respiratoryRate ?? undefined,
    bloodGlucose: v.bloodGlucose ?? undefined,
    notes: v.notes ?? undefined,
  };
}

function toActivityItem(i: CareItem): CareActivityItem {
  return {
    id: i.id,
    title: i.title,
    category: i.category,
    completed: i.completed,
    completedAt: i.completedAt ?? undefined,
    mandatory: i.mandatory,
  };
}

export interface StateExtras {
  nowMs: number;
  surcharge: ShiftExecutionState['conditionSurcharge'];
  pendingExtension: PendingExtensionRow | null;
  selfieUrl: string | null;
  checkout: ShiftExecutionState['checkout'];
}

/** ShiftExecutionState (packages/shared) for the assigned nurse. */
export function buildShiftState(r: ShiftRow, x: StateExtras): ShiftExecutionState {
  const startMs = new Date(r.start_time).getTime();
  const endMs = new Date(r.end_time).getTime();
  const vitals = (r.vital_signs_log ?? []).filter((v) => v.kind !== 'FINAL');
  const checkinLat = num(r.checkin_lat);
  const checkinLng = num(r.checkin_lng);
  return {
    bookingId: r.id,
    bookingCode: r.booking_code,
    patientName: r.patient_name,
    patientAge: ageOn(r.patient_dob, x.nowMs) ?? 0,
    patientAddress: r.address_text ?? '',
    patientLatitude: num(r.patient_lat) ?? 0,
    patientLongitude: num(r.patient_lng) ?? 0,
    mobilityStatus: r.mobility_status,
    isInvasive: r.is_invasive,
    serviceName: r.service_name,
    serviceType: r.service_type,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    scheduledHours: Math.round(((endMs - startMs) / HOUR_MS) * 100) / 100,
    totalAmount: Number(r.total_amount),
    executionStatus: r.execution_status,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    disputeStatus: r.dispute_status,
    checkedInAt: iso(r.checkin_time) ?? undefined,
    checkInDistanceMeters: num(r.checkin_distance_m) ?? undefined,
    checkInSelfieUrl: x.selfieUrl ?? undefined,
    checkInLatitude: checkinLat ?? undefined,
    checkInLongitude: checkinLng ?? undefined,
    checkInWatermark:
      r.checkin_time && checkinLat !== null && checkinLng !== null
        ? watermarkText(new Date(r.checkin_time).getTime(), checkinLat, checkinLng)
        : undefined,
    isMockLocationDetected: r.is_mock_location_detected === true,
    assessmentCompleted: r.assessed_at !== null,
    assessmentCompletedAt: iso(r.assessed_at) ?? undefined,
    conditionMismatchReported: r.condition_mismatch_reported === true,
    mismatchReason: r.mismatch_reason ?? undefined,
    mismatchOption: r.mismatch_option ?? undefined,
    vitalSigns: vitals.map(toVitalRecord),
    careActivities: (r.care_activities_log ?? []).map(toActivityItem),
    progressNotes: (r.progress_notes ?? []).map((n) => n.text),
    pendingExtension: x.pendingExtension
      ? {
          id: x.pendingExtension.id,
          extraHours: x.pendingExtension.extra_hours,
          extraAmount: Number(x.pendingExtension.extra_amount),
          requestedAt: new Date(x.pendingExtension.created_at).toISOString(),
          status: x.pendingExtension.status,
        }
      : null,
    checkedOutAt: iso(r.checkout_time) ?? undefined,
    handoverNotes: r.handover_note ?? undefined,
    finalVitalSigns: r.final_vital_signs ? toVitalRecord(r.final_vital_signs) : undefined,
    conditionSurcharge: x.surcharge,
    checkout: x.checkout,
    updatedAt: iso(r.log_updated_at) ?? undefined,
  };
}

/** Activities shown to the family: notes plus finished checklist items, newest first. */
function trackingActivities(r: ShiftRow): BookingTrackingDto['activities'] {
  const done = (r.care_activities_log ?? [])
    .filter((i) => i.completed && i.completedAt)
    .map((i) => ({ id: `item:${i.id}`, at: i.completedAt!, text: `Đã hoàn thành: ${i.title}` }));
  const notes = (r.progress_notes ?? []).map((n) => ({ id: n.id, at: n.at, text: n.text }));
  return [...done, ...notes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** BookingTracking (patient-web) for the customer who booked. */
export function buildTracking(
  r: ShiftRow,
  x: { nowMs: number; selfieUrl: string | null; extensions: unknown[]; surcharge: unknown | null },
): BookingTrackingDto {
  const lat = num(r.checkin_lat);
  const lng = num(r.checkin_lng);
  return {
    bookingId: r.id,
    code: r.booking_code,
    serviceLabel: r.service_name,
    patientName: r.patient_name,
    addressText: r.address_text,
    paymentMethod: r.payment_method,
    executionStatus: r.execution_status,
    scheduledStartAt: new Date(r.start_time).toISOString(),
    scheduledEndAt: new Date(r.end_time).toISOString(),
    nurse: r.nurse_id
      ? { nurseId: r.nurse_id, fullName: r.nurse_name ?? '', avatarUrl: r.nurse_avatar_url, tier: r.nurse_tier ?? 'TIER_1_BASIC' }
      : null,
    checkIn:
      r.checkin_time && lat !== null && lng !== null
        ? {
            at: new Date(r.checkin_time).toISOString(),
            selfieUrl: x.selfieUrl,
            distanceMeters: num(r.checkin_distance_m) ?? 0,
            lat,
            lng,
            watermark: watermarkText(new Date(r.checkin_time).getTime(), lat, lng),
          }
        : null,
    checkOutAt: iso(r.checkout_time),
    vitals: [...(r.vital_signs_log ?? [])]
      .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))
      .map((v) => ({
        id: v.id,
        recordedAt: v.measuredAt,
        pulse: v.heartRate,
        temperatureC: v.temperature,
        systolic: v.bloodPressureSystolic,
        diastolic: v.bloodPressureDiastolic,
        spo2: v.spo2,
        note: v.notes ?? null,
      })),
    activities: trackingActivities(r),
    emergency: null,
    extensions: x.extensions,
    conditionSurcharge: x.surcharge,
    serverTime: new Date(x.nowMs).toISOString(),
  };
}

/** GET /nurse/shifts item. After the record window closes, the address and position are no longer returned. */
export function toListItem(r: ShiftRow, nowMs: number, recordExpiryHours: number): NurseShiftItem {
  const startMs = new Date(r.start_time).getTime();
  const endMs = new Date(r.end_time).getTime();
  const open = withinRecordWindow(r, nowMs, recordExpiryHours);
  const total = Number(r.total_amount);
  const fee = Number(r.platform_fee);
  return {
    bookingId: r.id,
    bookingCode: r.booking_code,
    patientName: r.patient_name,
    patientAge: ageOn(r.patient_dob, nowMs),
    patientAddress: open ? r.address_text : null,
    patientLatitude: open ? num(r.patient_lat) : null,
    patientLongitude: open ? num(r.patient_lng) : null,
    mobilityStatus: open ? r.mobility_status : null,
    serviceName: r.service_name,
    isInvasive: r.is_invasive,
    startTime: new Date(startMs).toISOString(),
    endTime: new Date(endMs).toISOString(),
    timeRange: timeRange(startMs, endMs),
    scheduledHours: Math.round(((endMs - startMs) / HOUR_MS) * 100) / 100,
    executionStatus: r.execution_status,
    paymentStatus: r.payment_status,
    paymentMethod: r.payment_method,
    disputeStatus: r.dispute_status,
    totalAmount: total,
    commissionAmount: fee,
    netAmount: total - fee,
    checkedInAt: iso(r.checkin_time),
    checkedOutAt: iso(r.checkout_time),
  };
}

export const isBankTransfer = (r: Pick<ShiftRow, 'payment_method'>) => r.payment_method === PaymentMethod.BANK_TRANSFER;
