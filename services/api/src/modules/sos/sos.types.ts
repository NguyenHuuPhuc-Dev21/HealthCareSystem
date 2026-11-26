/**
 * sos — types (BE-3 · Phase 4 · FR-SHIFT-05 · TC-SOS-01). DTO shape = patient-web booking-tracking.types.ts SosAlert.
 */

export type SosStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'CLOSED';
export type SosRaisedBy = 'NURSE' | 'FAMILY';
export type SosOutcome = 'TRANSFERRED_TO_HOSPITAL' | 'RESOLVED_ON_SITE' | 'FALSE_ALARM';
export const SOS_OUTCOMES: readonly SosOutcome[] = ['TRANSFERRED_TO_HOSPITAL', 'RESOLVED_ON_SITE', 'FALSE_ALARM'];

/** Latest vital signs as the family sees them (patient-web VitalReading). */
export interface VitalReading {
  id: string;
  recordedAt: string;
  pulse: number | null;
  temperatureC: number | null;
  systolic: number | null;
  diastolic: number | null;
  spo2: number | null;
  note?: string | null;
}

export interface SosAlertDto {
  alertId: string;
  bookingId: string;
  bookingCode: string;
  patientName: string;
  nurseName: string | null;
  raisedAt: string;
  raisedBy: SosRaisedBy;
  status: SosStatus;
  lat: number | null;
  lng: number | null;
  latestVitals: VitalReading | null;
  acknowledgedAt: string | null;
  closedAt: string | null;
  outcome: SosOutcome | null;
  closeNote: string | null;
}

/** POST /bookings/:id/sos answer: the alert + nurse-app fields (sos.api.ts SosResponseData). */
export interface SosRaiseResult extends SosAlertDto {
  triggered: true;
  emergency_id: string;
  /** false when an open alert already existed (pressed again / offline replay): nobody was alerted twice. */
  created: boolean;
}

export interface RaiseSosBody {
  lat?: number;
  lng?: number;
  /** nurse app: currentVitals (heartRate / spo2 / bloodPressureSystolic… or pulse / systolic…) */
  vitals?: Record<string, unknown> | null;
}

/** One event in shift_logs.emergency_incident_log (append-only). */
export interface IncidentEvent {
  at: string;
  event: 'RAISED' | 'ACKNOWLEDGED' | 'REPORT' | 'CLOSED';
  alertId: string;
  by: string;
  role: string;
  lat?: number | null;
  lng?: number | null;
  vitals?: VitalReading | null;
  note?: string;
  called115?: boolean;
  hospital?: string | null;
  outcome?: SosOutcome;
}

export interface SosRow {
  id: string;
  booking_id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  patient_name: string;
  nurse_name: string | null;
  raised_by: string;
  raised_by_role: SosRaisedBy;
  lat: string | number | null;
  lng: string | number | null;
  vitals: VitalReading | null;
  status: SosStatus;
  acknowledged_at: Date | null;
  closed_at: Date | null;
  outcome: SosOutcome | null;
  close_note: string | null;
  created_at: Date;
}

/** What raising needs to know about the booking (locked). */
export interface SosBookingRow {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: string;
  patient_name: string;
  nurse_name: string | null;
  checkin_lat: string | number | null;
  checkin_lng: string | number | null;
  care_lat: string | number | null;
  care_lng: string | number | null;
  vital_signs_log: Array<Record<string, unknown>> | null;
}

/** Notification types (ops-monitoring SOS_UNACKNOWLEDGED watches 'SOS'). */
export const SOS_NOTICE = 'SOS';
export const SOS_ACK_NOTICE = 'SOS_ACKNOWLEDGED';
export const SOS_CLOSED_NOTICE = 'SOS_CLOSED';

export const MAX_SOS_LISTED = 100;
