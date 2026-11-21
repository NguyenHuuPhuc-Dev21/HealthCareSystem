import { describe, expect, it } from 'vitest';
import { ExecutionStatus, PaymentMethod, PaymentStatus, type SystemConfigKey } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import * as storage from '../../src/core/storage';
import { rejectionOpensAt, rejectionProblem } from '../../src/modules/prescription-rejection/prescription-rejection.policy';
import { PrescriptionRejectionService } from '../../src/modules/prescription-rejection/prescription-rejection.service';
import type { EvidenceStoragePort, RejectionBookingRow, RejectionNotice } from '../../src/modules/prescription-rejection/prescription-rejection.types';

/**
 * prescription-rejection — FR-BOOK-02 Layer 3 (BR-15 §2.2). Policy = pure. The service runs against a fake
 * storage and a fake of its SQL, with a fixed clock. The escrow refund itself is proven on real PostgreSQL
 * (test/integration/prescription-rejection.test.ts); here the booking is CASH so no ledger SQL runs.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NURSE = id(1);
const OTHER_NURSE = id(2);
const CUSTOMER = id(3);
const BOOKING = id(100);
const MIN = 60_000;
const START = Date.parse('2026-11-21T02:00:00Z'); // 09:00 in Vietnam
const END = START + 4 * 60 * MIN;
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const REASON = 'Y lệnh bị tẩy xóa ngày kê, thuốc thực tế không khớp';

describe('rejectionProblem (policy)', () => {
  const facts = (over: Partial<Parameters<typeof rejectionProblem>[0]> = {}) => ({
    nurseId: NURSE,
    executionStatus: ExecutionStatus.CONFIRMED,
    isInvasive: true,
    startMs: START,
    endMs: END,
    ...over,
  });

  it('allows the assigned nurse on an invasive CONFIRMED or IN_PROGRESS shift inside the window', () => {
    expect(rejectionProblem(facts(), NURSE, START - 30 * MIN, 60)).toBeNull();
    expect(rejectionProblem(facts({ executionStatus: ExecutionStatus.IN_PROGRESS }), NURSE, START + 60 * MIN, 60)).toBeNull();
  });

  it('opens exactly windowMinutes before the start and closes at the scheduled end', () => {
    expect(rejectionProblem(facts(), NURSE, START - 60 * MIN, 60)).toBeNull();
    expect(rejectionProblem(facts(), NURSE, START - 60 * MIN - 1, 60)).toBe('TOO_EARLY_TO_REJECT');
    expect(rejectionProblem(facts(), NURSE, END - 1, 60)).toBeNull();
    expect(rejectionProblem(facts(), NURSE, END, 60)).toBe('SHIFT_ALREADY_ENDED');
    expect(rejectionOpensAt(START, 60).toISOString()).toBe('2026-11-21T01:00:00.000Z');
  });

  it('follows the configured window, not a constant', () => {
    expect(rejectionProblem(facts(), NURSE, START - 100 * MIN, 120)).toBeNull();
    expect(rejectionProblem(facts(), NURSE, START - 100 * MIN, 60)).toBe('TOO_EARLY_TO_REJECT');
  });

  it('refuses another nurse, an unassigned booking, and a non-invasive service', () => {
    expect(rejectionProblem(facts(), OTHER_NURSE, START, 60)).toBe('NOT_ASSIGNED_NURSE');
    expect(rejectionProblem(facts({ nurseId: null }), NURSE, START, 60)).toBe('NOT_ASSIGNED_NURSE');
    expect(rejectionProblem(facts({ isInvasive: false }), NURSE, START, 60)).toBe('PRESCRIPTION_NOT_REQUIRED');
  });

  it('refuses a booking that is cancelled, completed or not confirmed yet', () => {
    expect(rejectionProblem(facts({ executionStatus: ExecutionStatus.CANCELLED }), NURSE, START, 60)).toBe('ALREADY_CANCELLED');
    for (const s of [ExecutionStatus.COMPLETED, ExecutionStatus.MATCHING, ExecutionStatus.DRAFT, ExecutionStatus.EXPIRED]) {
      expect(rejectionProblem(facts({ executionStatus: s }), NURSE, START, 60)).toBe('BOOKING_NOT_ACTIVE');
    }
  });
});

// ---------------------------------------------------------------------------

class FakeStorage implements EvidenceStoragePort {
  objects = new Map<string, { sizeBytes: number; head: Buffer }>();
  buildObjectKey = storage.buildObjectKey;
  async createUploadUrl(objectKey: string) {
    return { url: `https://storage.test/put/${objectKey}`, objectKey, expiresInSeconds: 600 };
  }
  async statObject(objectKey: string) {
    const o = this.objects.get(objectKey);
    return o ? { sizeBytes: o.sizeBytes, contentType: undefined } : null;
  }
  async readObjectHead(objectKey: string) {
    return this.objects.get(objectKey)?.head ?? null;
  }
  put(ownerId: string, head: Buffer = JPEG, sizeBytes = 2048): string {
    const key = storage.buildObjectKey('prescription-rejection', ownerId, 'image/jpeg');
    this.objects.set(key, { sizeBytes, head });
    return key;
  }
}

class FakeDb {
  booking: RejectionBookingRow | null = null;
  rejections: unknown[][] = [];
  statements: string[] = [];
  async query(text: string, params: unknown[] = []): Promise<any> {
    this.statements.push(text);
    if (text.includes('FROM bookings b')) return { rows: this.booking ? [{ ...this.booking }] : [], rowCount: this.booking ? 1 : 0 };
    if (text.includes("SET execution_status = 'CANCELLED'")) {
      const ok = this.booking && ['CONFIRMED', 'IN_PROGRESS'].includes(this.booking.execution_status);
      if (ok) this.booking!.execution_status = ExecutionStatus.CANCELLED;
      return { rows: [], rowCount: ok ? 1 : 0 };
    }
    if (text.includes('INSERT INTO prescription_rejections')) {
      this.rejections.push(params);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${text}`);
  }
}

function setup(over: Partial<RejectionBookingRow> = {}, now = START - 10 * MIN) {
  const store = new FakeStorage();
  const db = new FakeDb();
  db.booking = {
    id: BOOKING,
    booking_code: 'HC-0001',
    customer_id: CUSTOMER,
    nurse_id: NURSE,
    execution_status: ExecutionStatus.CONFIRMED,
    payment_method: PaymentMethod.CASH,
    payment_status: PaymentStatus.UNPAID,
    start_time: new Date(START),
    end_time: new Date(END),
    total_amount: '350000',
    is_invasive: true,
    ...over,
  };
  const config: Partial<Record<SystemConfigKey, number>> = { PRESCRIPTION_REJECTION_WINDOW_MINUTES: 60, ICU_TRAVEL_SUPPORT: 50_000 };
  const notices: RejectionNotice[] = [];
  const svc = new PrescriptionRejectionService({
    storage: store,
    db,
    withTx: (fn) => fn(db),
    getNumber: async (k) => {
      const v = config[k];
      if (v === undefined) throw new Error(`missing ${k}`);
      return v;
    },
    maxUploadBytes: 10 * 1024 * 1024,
    notify: async (n) => void notices.push(n),
    now: () => now,
  });
  return { svc, store, db, notices };
}

async function expectAppError(p: Promise<unknown>, status: number, code: string): Promise<AppError> {
  let err: unknown;
  try {
    await p;
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).status).toBe(status);
  expect((err as AppError).code).toBe(code);
  return err as AppError;
}

describe('requestEvidenceUploadUrl', () => {
  it('gives the assigned nurse a presigned PUT under prescription-rejection/<nurse>/', async () => {
    const { svc } = setup();
    const res = await svc.requestEvidenceUploadUrl(NURSE, BOOKING, 'image/jpeg');
    expect(res.objectKey.startsWith(`prescription-rejection/${NURSE}/`)).toBe(true);
    expect(res).toMatchObject({ contentType: 'image/jpeg', expiresInSeconds: 600 });
  });

  it('refuses another nurse, an unknown booking, a closed window and a non-image type', async () => {
    await expectAppError(setup().svc.requestEvidenceUploadUrl(OTHER_NURSE, BOOKING, 'image/jpeg'), 403, 'NOT_ASSIGNED_NURSE');
    const empty = setup();
    empty.db.booking = null;
    await expectAppError(empty.svc.requestEvidenceUploadUrl(NURSE, BOOKING, 'image/jpeg'), 404, 'BOOKING_NOT_FOUND');
    await expectAppError(setup({}, START - 2 * 60 * MIN).svc.requestEvidenceUploadUrl(NURSE, BOOKING, 'image/jpeg'), 409, 'TOO_EARLY_TO_REJECT');
    await expectAppError(setup().svc.requestEvidenceUploadUrl(NURSE, BOOKING, 'application/pdf'), 400, 'CONTENT_TYPE_NOT_ALLOWED');
  });
});

describe('reject', () => {
  it('cancels a cash booking, stores the evidence and the travel support owed, refunds nothing, tells the customer', async () => {
    const { svc, store, db, notices } = setup();
    const key = store.put(NURSE);

    const res = await svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: key });

    expect(res).toEqual({
      bookingId: BOOKING,
      executionStatus: 'CANCELLED',
      paymentStatus: PaymentStatus.UNPAID,
      refundedAmount: 0,
      travelSupportAmount: 50_000,
      travelSupportStatus: 'PENDING',
    });
    expect(db.booking!.execution_status).toBe(ExecutionStatus.CANCELLED);
    expect(db.rejections).toEqual([[BOOKING, NURSE, REASON, key, 0, 50_000]]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ userId: CUSTOMER, bookingId: BOOKING });
  });

  it('never touches deposit, ledger or TrustScore for a cash booking', async () => {
    const { svc, store, db } = setup();
    await svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: store.put(NURSE) });
    const sql = db.statements.join('\n');
    expect(sql).not.toMatch(/wallet|trust_score|deposit/i);
  });

  it('TOO_EARLY_TO_REJECT carries the time the action opens', async () => {
    const { svc, store } = setup({}, START - 61 * MIN);
    const err = await expectAppError(svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: store.put(NURSE) }), 409, 'TOO_EARLY_TO_REJECT');
    expect(err.details).toEqual({ opensAt: '2026-11-21T01:00:00.000Z' });
  });

  it('refuses a second rejection of the same booking', async () => {
    const { svc, store } = setup();
    await svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: store.put(NURSE) });
    await expectAppError(svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: store.put(NURSE) }), 409, 'ALREADY_CANCELLED');
  });

  it('refuses evidence of another account, another category, missing, oversized or not a photo — and changes nothing', async () => {
    const { svc, store, db } = setup();
    const reject = (key: string) => svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: key });

    await expectAppError(reject(store.put(OTHER_NURSE)), 400, 'INVALID_FILE_KEY');
    await expectAppError(reject(storage.buildObjectKey('prescription', NURSE, 'image/jpeg')), 400, 'INVALID_FILE_KEY');
    await expectAppError(reject(storage.buildObjectKey('prescription-rejection', NURSE, 'image/jpeg')), 400, 'FILE_NOT_UPLOADED');
    await expectAppError(reject(store.put(NURSE, JPEG, 11 * 1024 * 1024)), 400, 'FILE_TOO_LARGE');
    await expectAppError(reject(store.put(NURSE, Buffer.from('%PDF-1.7'))), 400, 'FILE_TYPE_NOT_ALLOWED');

    expect(db.booking!.execution_status).toBe(ExecutionStatus.CONFIRMED);
    expect(db.rejections).toHaveLength(0);
  });

  it('a failing notification does not undo the rejection', async () => {
    const { svc, store, db } = setup();
    (svc as any).deps.notify = async () => {
      throw new Error('push down');
    };
    await expect(svc.reject(NURSE, BOOKING, { reason: REASON, evidenceKey: store.put(NURSE) })).resolves.toMatchObject({
      executionStatus: 'CANCELLED',
    });
    expect(db.rejections).toHaveLength(1);
  });
});
