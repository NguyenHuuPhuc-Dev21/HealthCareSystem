/**
 * check-in — dual-verified arrival on site (BE-2 · Phase 4). Traceability: FR-SHIFT-01 · SRS §4.4 · BR-07 · NFR-SEC-01.
 *
 *  1. POST /bookings/:id/check-in/selfie-upload-url   presigned PUT for the live selfie (files never go through
 *     the API). The key is recorded for THIS booking and nurse; it is single-use and valid
 *     CHECKIN_SELFIE_MAX_AGE_MINUTES (a gallery photo or an old shift's photo cannot be replayed).
 *  2. POST /bookings/:id/check-in
 *       - device reports a mock location (isFromMockProvider / isSimulatedBySoftware) → 403 MOCK_LOCATION_DETECTED,
 *         the attempt is logged and shift_logs.is_mock_location_detected stays TRUE (security alert for Admin);
 *       - Haversine distance to the care address > CHECKIN_MAX_RADIUS_METERS → 403 OUT_OF_RADIUS (logged);
 *       - the selfie must exist in storage, be a real image (magic bytes) within the size limit;
 *       - then, under the booking lock: CONFIRMED → IN_PROGRESS, shift_logs written with the SERVER time and the GPS
 *         position (the selfie's watermark = that time + position), the care checklist created.
 *     The family is notified and receives the selfie (GET /bookings/:id/tracking) — FR-SHIFT-01 step 3.
 */
import { ExecutionStatus, type CheckInSelfieUploadUrl, type ShiftExecutionState, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { type Queryable } from '../../core/database';
import { AppError, badRequest } from '../../core/errors';
import * as storage from '../../core/storage';
import { defaultChecklist, watermarkText } from '../shift-logs/shift-logs.policy';
import * as shiftRepo from '../shift-logs/shift-logs.repo';
import { defaultShiftDeps, getShiftLogsService, notFoundBooking, sendShiftNotices, type ShiftLogsService } from '../shift-logs/shift-logs.service';
import { SHIFT_NOTICE, type ShiftNotify, type ShiftPublish, type ShiftRow } from '../shift-logs/shift-logs.types';
import { checkInOpensAt, checkInProblem, distanceToCare, selfieProblem, withinRadius } from './check-in.policy';
import * as repo from './check-in.repo';
import { SELFIE_CONTENT_TYPES, type AttemptOutcome, type CheckInInput, type CheckInProblem, type SelfieStoragePort } from './check-in.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY = 'checkin-selfie' as const;

const PROBLEMS: Record<CheckInProblem, { status: number; message: string }> = {
  NOT_ASSIGNED_NURSE: { status: 403, message: 'Only the nurse assigned to this booking can check in' },
  ALREADY_CHECKED_IN: { status: 409, message: 'This shift is already checked in' },
  BOOKING_NOT_CONFIRMED: { status: 409, message: 'Only a confirmed shift can be checked in' },
  TOO_EARLY_TO_CHECK_IN: { status: 409, message: 'Check-in is not open yet' },
  SHIFT_ALREADY_ENDED: { status: 409, message: 'The scheduled time of this shift is over' },
};

export interface CheckInDeps {
  /** Pool, for the read-only checks outside the transaction. */
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  getNumber: (key: SystemConfigKey) => Promise<number>;
  storage: SelfieStoragePort;
  maxUploadBytes: number;
  /** Builds the returned ShiftExecutionState (same view as GET /shift-state). */
  shifts: Pick<ShiftLogsService, 'stateOf'>;
  notify?: ShiftNotify;
  publish?: ShiftPublish;
  now?: () => number;
}

export class CheckInService {
  constructor(private readonly deps: CheckInDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private assertAllowed(row: ShiftRow | null, nurseId: string, opensBefore: number): ShiftRow {
    if (!row) throw notFoundBooking();
    const startMs = new Date(row.start_time).getTime();
    const problem = checkInProblem(
      { nurseId: row.nurse_id, executionStatus: row.execution_status, startMs, endMs: new Date(row.end_time).getTime() },
      nurseId,
      this.nowMs(),
      opensBefore,
    );
    if (problem) {
      const { status, message } = PROBLEMS[problem];
      const details =
        problem === 'TOO_EARLY_TO_CHECK_IN'
          ? { opensAt: new Date(checkInOpensAt(startMs, opensBefore)).toISOString() }
          : { executionStatus: row.execution_status };
      throw new AppError(status, problem, message, details);
    }
    return row;
  }

  /** POST /bookings/:id/check-in/selfie-upload-url */
  async requestSelfieUploadUrl(nurseId: string, bookingId: string, contentType: string): Promise<CheckInSelfieUploadUrl> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    this.assertAllowed(await shiftRepo.findShift(this.deps.read, bookingId), nurseId, await this.deps.getNumber('CHECKIN_OPENS_BEFORE_START_MINUTES'));
    if (!(SELFIE_CONTENT_TYPES as readonly string[]).includes(contentType)) {
      throw badRequest('CONTENT_TYPE_NOT_ALLOWED', `The selfie accepts ${SELFIE_CONTENT_TYPES.join(', ')}`);
    }
    const objectKey = this.deps.storage.buildObjectKey(CATEGORY, nurseId, contentType);
    const url = await this.deps.storage.createUploadUrl(objectKey, contentType);
    await repo.insertSelfieUpload(this.deps.read, { key: objectKey, bookingId, nurseId, contentType, at: new Date(this.nowMs()) });
    return { objectKey, uploadUrl: url.url, expiresInSeconds: url.expiresInSeconds, contentType };
  }

  /** Writes a refused attempt in its own transaction (it must survive the error answer). */
  private async logRefusal(row: ShiftRow, nurseId: string, input: CheckInInput, outcome: AttemptOutcome, distanceM: number | null) {
    const at = new Date(this.nowMs());
    await this.deps.withTx(async (db) => {
      await repo.insertAttempt(db, { bookingId: row.id, nurseId, at, lat: input.latitude, lng: input.longitude, distanceM, mock: input.isMockLocation, outcome });
      if (outcome === 'MOCK_LOCATION_DETECTED') await shiftRepo.flagMockLocation(db, row.id);
    });
  }

  /** POST /bookings/:id/check-in */
  async checkIn(nurseId: string, bookingId: string, input: CheckInInput): Promise<ShiftExecutionState> {
    if (!UUID_RE.test(bookingId)) throw notFoundBooking();
    const [opensBefore, radius, maxAge] = await Promise.all([
      this.deps.getNumber('CHECKIN_OPENS_BEFORE_START_MINUTES'),
      this.deps.getNumber('CHECKIN_MAX_RADIUS_METERS'),
      this.deps.getNumber('CHECKIN_SELFIE_MAX_AGE_MINUTES'),
    ]);
    // Cheap checks first, with clear errors; everything is checked again under the lock.
    const row = this.assertAllowed(await shiftRepo.findShift(this.deps.read, bookingId), nurseId, opensBefore);

    if (input.isMockLocation) {
      await this.logRefusal(row, nurseId, input, 'MOCK_LOCATION_DETECTED', null);
      throw new AppError(403, 'MOCK_LOCATION_DETECTED', 'A simulated (mock) location was detected; turn off fake-GPS apps to check in');
    }
    if (row.patient_lat === null || row.patient_lng === null) {
      throw new AppError(409, 'BOOKING_LOCATION_MISSING', 'The care address of this booking has no GPS position; contact support');
    }
    const distanceM = distanceToCare({ lat: input.latitude, lng: input.longitude }, { lat: Number(row.patient_lat), lng: Number(row.patient_lng) });
    if (!withinRadius(distanceM, radius)) {
      await this.logRefusal(row, nurseId, input, 'OUT_OF_RADIUS', distanceM);
      throw new AppError(403, 'OUT_OF_RADIUS', `You must be within ${radius} m of the care address to check in`, {
        distanceMeters: distanceM,
        maxRadiusMeters: radius,
      });
    }
    try {
      await this.verifySelfie(nurseId, row.id, input.selfieKey, maxAge);
    } catch (err) {
      await this.logRefusal(row, nurseId, input, 'INVALID_SELFIE', distanceM);
      throw err;
    }

    const now = new Date(this.nowMs());
    await this.deps.withTx(async (db) => {
      const locked = this.assertAllowed(await shiftRepo.lockShift(db, bookingId), nurseId, opensBefore);
      if (!(await repo.markSelfieUsed(db, input.selfieKey, now))) {
        throw badRequest('SELFIE_ALREADY_USED', 'This selfie was already used; take a new one');
      }
      if (!(await shiftRepo.markInProgress(db, locked.id, now))) {
        throw new AppError(409, 'BOOKING_NOT_CONFIRMED', PROBLEMS.BOOKING_NOT_CONFIRMED.message);
      }
      await shiftRepo.startLog(db, {
        bookingId: locked.id,
        at: now,
        lat: input.latitude,
        lng: input.longitude,
        distanceM,
        selfieKey: input.selfieKey,
        checklist: defaultChecklist(locked.is_invasive),
      });
      await repo.insertAttempt(db, {
        bookingId: locked.id,
        nurseId,
        at: now,
        lat: input.latitude,
        lng: input.longitude,
        distanceM,
        mock: false,
        outcome: 'ACCEPTED',
      });
    });

    const fresh = (await shiftRepo.findShift(this.deps.read, bookingId))!;
    try {
      this.deps.publish?.(fresh.id, 'CHECKED_IN', ExecutionStatus.IN_PROGRESS);
    } catch (err) {
      console.warn(`[check-in] publish failed: ${(err as Error).message}`);
    }
    await sendShiftNotices(this.deps.notify, [
      {
        userId: fresh.customer_id,
        bookingId: fresh.id,
        type: SHIFT_NOTICE.CHECKED_IN,
        title: `Ca ${fresh.booking_code} đã bắt đầu`,
        body: `Điều dưỡng ${fresh.nurse_name ?? ''} đã đến nơi và check-in lúc ${watermarkText(now.getTime(), input.latitude, input.longitude)}. Xem ảnh xác thực trong ứng dụng.`,
        data: { bookingId: fresh.id, bookingCode: fresh.booking_code },
      },
    ]);
    return this.deps.shifts.stateOf(this.deps.read, fresh);
  }

  /** Issued for this booking + nurse, fresh, unused; exists; real image; within the size limit. */
  private async verifySelfie(nurseId: string, bookingId: string, key: string, maxAgeMinutes: number): Promise<void> {
    const details = { purpose: 'CHECKIN_SELFIE', key };
    if (!storage.objectKeyBelongsTo(key, nurseId) || !key.startsWith(`${CATEGORY}/`)) {
      throw badRequest('INVALID_FILE_KEY', 'File key is not a check-in selfie of this account', details);
    }
    const problem = selfieProblem(await repo.findSelfieUpload(this.deps.read, key), { bookingId, nurseId, nowMs: this.nowMs(), maxAgeMinutes });
    if (problem === 'SELFIE_EXPIRED') throw badRequest(problem, 'The selfie is too old; take a new one', details);
    if (problem === 'SELFIE_ALREADY_USED') throw badRequest(problem, 'This selfie was already used; take a new one', details);
    if (problem) throw badRequest(problem, 'Take the selfie with the in-app camera for this shift', details);
    const info = await this.deps.storage.statObject(key);
    if (!info) throw badRequest('FILE_NOT_UPLOADED', 'The selfie was not uploaded', details);
    if (info.sizeBytes <= 0 || info.sizeBytes > this.deps.maxUploadBytes) {
      throw badRequest('FILE_TOO_LARGE', 'The selfie must be between 1 byte and the size limit', details);
    }
    const head = await this.deps.storage.readObjectHead(key);
    const realType = head ? storage.detectContentType(head) : null;
    if (!realType || !(SELFIE_CONTENT_TYPES as readonly string[]).includes(realType)) {
      throw badRequest('FILE_TYPE_NOT_ALLOWED', 'The selfie must be a JPEG, PNG or WebP photo', details);
    }
  }
}

let singleton: CheckInService | null = null;

export function getCheckInService(): CheckInService {
  if (!singleton) {
    const shared = defaultShiftDeps();
    singleton = new CheckInService({
      read: shared.read,
      withTx: shared.withTx,
      getNumber: getConfigNumber,
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: (key, type) => storage.createUploadUrl(key, type),
        statObject: storage.statObject,
        readObjectHead: (key) => storage.readObjectHead(key),
      },
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
      shifts: getShiftLogsService(),
      notify: shared.notify,
      publish: shared.publish,
    });
  }
  return singleton;
}
