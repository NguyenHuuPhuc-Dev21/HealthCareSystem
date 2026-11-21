import { describe, expect, it } from 'vitest';
import { AuditAction, ExecutionStatus, UserRole, type SystemConfigKey } from '@healthcare-system/shared';
import { AppError } from '../../src/core/errors';
import * as storage from '../../src/core/storage';
import { candidateDenial, checkPrescription } from '../../src/modules/prescription-gate/prescription-gate.policy';
import { PrescriptionGateService } from '../../src/modules/prescription-gate/prescription-gate.service';
import type { BookingPrescriptionRow, PrescriptionStoragePort } from '../../src/modules/prescription-gate/prescription-gate.types';

/**
 * prescription-gate — FR-BOOK-02 Layers 1–2 (BR-15). Policy = pure. The service runs against a
 * fake storage and a fake of the three SQL statements it issues, with a fixed clock.
 */
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const CUSTOMER = id(1);
const OTHER_CUSTOMER = id(2);
const NURSE = id(3);
const ADMIN = id(4);
const BOOKING = id(100);
// 2026-11-14 09:00 in Vietnam
const NOW = Date.parse('2026-11-14T02:00:00Z');
const TODAY = '2026-11-14';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe('checkPrescription (Layer 1 policy)', () => {
  const invasive = (issuedDate?: string | null, imageKey: string | null = 'k') => ({ isInvasive: true, imageKey, issuedDate });

  it('asks nothing of a non-invasive service', () => {
    expect(checkPrescription({ isInvasive: false }, TODAY, 7)).toBeNull();
  });

  it('requires both the image and the issue date for an invasive service', () => {
    expect(checkPrescription({ isInvasive: true }, TODAY, 7)).toBe('PRESCRIPTION_REQUIRED');
    expect(checkPrescription(invasive('2026-11-14', null), TODAY, 7)).toBe('PRESCRIPTION_REQUIRED');
    expect(checkPrescription(invasive(null), TODAY, 7)).toBe('PRESCRIPTION_REQUIRED');
  });

  it('accepts today and exactly 7 days old, refuses 8 days old', () => {
    expect(checkPrescription(invasive('2026-11-14'), TODAY, 7)).toBeNull();
    expect(checkPrescription(invasive('2026-11-07'), TODAY, 7)).toBeNull();
    expect(checkPrescription(invasive('2026-11-06'), TODAY, 7)).toBe('PRESCRIPTION_TOO_OLD');
  });

  it('counts calendar days across a month boundary', () => {
    expect(checkPrescription(invasive('2026-10-28'), '2026-11-04', 7)).toBeNull();
    expect(checkPrescription(invasive('2026-10-27'), '2026-11-04', 7)).toBe('PRESCRIPTION_TOO_OLD');
  });

  it('follows the configured number of days, not a constant', () => {
    expect(checkPrescription(invasive('2026-11-11'), TODAY, 3)).toBeNull();
    expect(checkPrescription(invasive('2026-11-10'), TODAY, 3)).toBe('PRESCRIPTION_TOO_OLD');
  });

  it('refuses a future date and a date that does not exist', () => {
    expect(checkPrescription(invasive('2026-11-15'), TODAY, 7)).toBe('PRESCRIPTION_DATE_IN_FUTURE');
    expect(checkPrescription(invasive('2026-02-30'), TODAY, 7)).toBe('INVALID_PRESCRIPTION_DATE');
    expect(checkPrescription(invasive('14/11/2026'), TODAY, 7)).toBe('INVALID_PRESCRIPTION_DATE');
  });
});

describe('candidateDenial (Layer 2 policy)', () => {
  const ok = { hasOpenOffer: true, tier2Valid: true };

  it('allows a Tier 2 nurse with a live offer while the booking is MATCHING', () => {
    expect(candidateDenial(ExecutionStatus.MATCHING, ok)).toBeNull();
  });

  it('refuses once the booking is no longer looking for a nurse', () => {
    for (const s of [ExecutionStatus.DRAFT, ExecutionStatus.CONFIRMED, ExecutionStatus.COMPLETED, ExecutionStatus.CANCELLED]) {
      expect(candidateDenial(s, ok)).toBe('BOOKING_NOT_OPEN');
    }
  });

  it('refuses without a live offer, and without a valid Tier 2', () => {
    expect(candidateDenial(ExecutionStatus.MATCHING, { hasOpenOffer: false, tier2Valid: true })).toBe('NOT_OFFERED');
    expect(candidateDenial(ExecutionStatus.MATCHING, { hasOpenOffer: true, tier2Valid: false })).toBe('TIER_2_REQUIRED');
  });
});

// ---------------------------------------------------------------------------

class FakeStorage implements PrescriptionStoragePort {
  objects = new Map<string, { sizeBytes: number; head: Buffer }>();
  buildObjectKey = storage.buildObjectKey;
  async createUploadUrl(objectKey: string) {
    return { url: `https://storage.test/put/${objectKey}`, objectKey, expiresInSeconds: 600 };
  }
  async createDownloadUrl(objectKey: string) {
    return { url: `https://storage.test/get/${objectKey}`, objectKey, expiresInSeconds: 600 };
  }
  async statObject(objectKey: string) {
    const o = this.objects.get(objectKey);
    return o ? { sizeBytes: o.sizeBytes, contentType: undefined } : null;
  }
  async readObjectHead(objectKey: string) {
    return this.objects.get(objectKey)?.head ?? null;
  }
  put(ownerId: string, head: Buffer = JPEG, sizeBytes = 2048): string {
    const key = storage.buildObjectKey('prescription', ownerId, 'image/jpeg');
    this.objects.set(key, { sizeBytes, head });
    return key;
  }
}

class FakeDb {
  booking: BookingPrescriptionRow | null = null;
  facts = { has_open_offer: false, tier2_valid: false };
  audits: unknown[][] = [];
  async query(text: string, params: unknown[] = []): Promise<any> {
    if (text.includes('FROM bookings')) return { rows: this.booking ? [this.booking] : [], rowCount: this.booking ? 1 : 0 };
    if (text.includes('booking_offers')) return { rows: [this.facts], rowCount: 1 };
    if (text.includes('INSERT INTO audit_logs')) {
      this.audits.push(params);
      return { rows: [{ id: id(900), created_at: new Date(NOW) }], rowCount: 1 };
    }
    throw new Error(`unexpected SQL: ${text}`);
  }
}

function setup(config: Partial<Record<SystemConfigKey, number>> = { PRESCRIPTION_MAX_AGE_DAYS: 7 }) {
  const store = new FakeStorage();
  const db = new FakeDb();
  const assigned: { calls: [string, string][]; deny: boolean } = { calls: [], deny: false };
  const svc = new PrescriptionGateService({
    storage: store,
    db,
    getNumber: async (k) => {
      const v = config[k];
      if (v === undefined) throw new Error(`missing ${k}`);
      return v;
    },
    assertAssignedNurseAccess: async (bookingId, nurseId) => {
      assigned.calls.push([bookingId, nurseId]);
      if (assigned.deny) throw new AppError(403, 'RECORD_ACCESS_DENIED', 'denied', { reason: 'WINDOW_CLOSED' });
    },
    maxUploadBytes: 10 * 1024 * 1024,
    now: () => NOW,
  });
  return { svc, store, db, assigned };
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

describe('requestUploadUrl', () => {
  it('returns a presigned PUT for a key under prescription/<customer>/', async () => {
    const { svc } = setup();
    const res = await svc.requestUploadUrl(CUSTOMER, 'image/jpeg');
    expect(res.objectKey.startsWith(`prescription/${CUSTOMER}/`)).toBe(true);
    expect(res).toMatchObject({ contentType: 'image/jpeg', expiresInSeconds: 600 });
    expect(res.uploadUrl).toContain(res.objectKey);
  });

  it('refuses a content type that is not a photo or a PDF', async () => {
    const { svc } = setup();
    await expectAppError(svc.requestUploadUrl(CUSTOMER, 'text/html'), 400, 'CONTENT_TYPE_NOT_ALLOWED');
  });
});

describe('assertPrescriptionGate (Layer 1)', () => {
  it('returns null for a non-invasive service without reading config or storage', async () => {
    const { svc } = setup({}); // no config at all: must not be read
    await expect(svc.assertPrescriptionGate({ customerId: CUSTOMER, isInvasive: false })).resolves.toBeNull();
  });

  it('accepts an invasive booking with a fresh prescription the customer uploaded', async () => {
    const { svc, store } = setup();
    const key = store.put(CUSTOMER);
    await expect(
      svc.assertPrescriptionGate({ customerId: CUSTOMER, isInvasive: true, prescriptionImageKey: key, prescriptionIssuedDate: '2026-11-10' }),
    ).resolves.toEqual({ prescriptionImageKey: key, prescriptionIssuedDate: '2026-11-10' });
  });

  it('400 PRESCRIPTION_REQUIRED when the image or the date is missing', async () => {
    const { svc, store } = setup();
    await expectAppError(svc.assertPrescriptionGate({ customerId: CUSTOMER, isInvasive: true }), 400, 'PRESCRIPTION_REQUIRED');
    await expectAppError(
      svc.assertPrescriptionGate({ customerId: CUSTOMER, isInvasive: true, prescriptionImageKey: store.put(CUSTOMER) }),
      400,
      'PRESCRIPTION_REQUIRED',
    );
  });

  it('400 PRESCRIPTION_TOO_OLD past the configured age, with the limit in details', async () => {
    const { svc, store } = setup();
    const err = await expectAppError(
      svc.assertPrescriptionGate({
        customerId: CUSTOMER,
        isInvasive: true,
        prescriptionImageKey: store.put(CUSTOMER),
        prescriptionIssuedDate: '2026-11-06',
      }),
      400,
      'PRESCRIPTION_TOO_OLD',
    );
    expect(err.details).toEqual({ maxAgeDays: 7 });
  });

  it('uses the Vietnam calendar day: 00:30 on the 15th in Vietnam is still the 14th in UTC', async () => {
    const store = new FakeStorage();
    const svc = new PrescriptionGateService({
      storage: store,
      db: new FakeDb(),
      getNumber: async () => 7,
      assertAssignedNurseAccess: async () => undefined,
      maxUploadBytes: 10 * 1024 * 1024,
      now: () => Date.parse('2026-11-14T17:30:00Z'),
    });
    const input = { customerId: CUSTOMER, isInvasive: true, prescriptionImageKey: store.put(CUSTOMER) };
    await expect(svc.assertPrescriptionGate({ ...input, prescriptionIssuedDate: '2026-11-15' })).resolves.not.toBeNull();
    await expectAppError(svc.assertPrescriptionGate({ ...input, prescriptionIssuedDate: '2026-11-07' }), 400, 'PRESCRIPTION_TOO_OLD');
  });

  it('refuses a file of another account, of another category, missing, oversized or not really an image', async () => {
    const { svc, store } = setup();
    const gate = (key: string) =>
      svc.assertPrescriptionGate({ customerId: CUSTOMER, isInvasive: true, prescriptionImageKey: key, prescriptionIssuedDate: TODAY });

    await expectAppError(gate(store.put(OTHER_CUSTOMER)), 400, 'INVALID_FILE_KEY');
    await expectAppError(gate(storage.buildObjectKey('kyc-cccd', CUSTOMER, 'image/jpeg')), 400, 'INVALID_FILE_KEY');
    await expectAppError(gate('prescription/../secret.jpg'), 400, 'INVALID_FILE_KEY');
    await expectAppError(gate(storage.buildObjectKey('prescription', CUSTOMER, 'image/jpeg')), 400, 'FILE_NOT_UPLOADED');
    await expectAppError(gate(store.put(CUSTOMER, JPEG, 11 * 1024 * 1024)), 400, 'FILE_TOO_LARGE');
    await expectAppError(gate(store.put(CUSTOMER, Buffer.from('<html><script>'))), 400, 'FILE_TYPE_NOT_ALLOWED');
  });
});

describe('getViewUrl (Layer 2)', () => {
  function withBooking(over: Partial<BookingPrescriptionRow> = {}) {
    const ctx = setup();
    const key = ctx.store.put(CUSTOMER);
    ctx.db.booking = {
      customer_id: CUSTOMER,
      nurse_id: null,
      execution_status: ExecutionStatus.MATCHING,
      prescription_image_url: key,
      prescription_issued_date: '2026-11-12',
      ...over,
    };
    return { ...ctx, key };
  }
  const nurse = { id: NURSE, role: UserRole.NURSE, ip: '203.0.113.9' };

  it('404 for an unknown or malformed booking id', async () => {
    const { svc } = setup();
    await expectAppError(svc.getViewUrl(nurse, BOOKING), 404, 'BOOKING_NOT_FOUND');
    await expectAppError(svc.getViewUrl(nurse, 'not-a-uuid'), 404, 'BOOKING_NOT_FOUND');
  });

  it('the customer who owns the booking gets a link, and that view is not audited', async () => {
    const { svc, db, key } = withBooking();
    const res = await svc.getViewUrl({ id: CUSTOMER, role: UserRole.PATIENT }, BOOKING);
    expect(res).toEqual({ url: `https://storage.test/get/${key}`, expiresInSeconds: 600, basis: 'OWNER', issuedDate: '2026-11-12' });
    expect(db.audits).toHaveLength(0);
  });

  it('another customer gets the same 404 as an unknown booking', async () => {
    const { svc } = withBooking();
    await expectAppError(svc.getViewUrl({ id: OTHER_CUSTOMER, role: UserRole.PATIENT }, BOOKING), 404, 'BOOKING_NOT_FOUND');
  });

  it('an Admin gets a link and the view is audited', async () => {
    const { svc, db } = withBooking();
    const res = await svc.getViewUrl({ id: ADMIN, role: UserRole.ADMIN, ip: '198.51.100.7' }, BOOKING);
    expect(res.basis).toBe('ADMIN');
    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toEqual([
      ADMIN,
      AuditAction.VIEW_MEDICAL_RECORD,
      'bookings',
      BOOKING,
      null,
      JSON.stringify({ document: 'PRESCRIPTION', basis: 'ADMIN' }),
      '198.51.100.7',
    ]);
  });

  it('a Tier 2 nurse with a live offer may look before accepting (audited)', async () => {
    const { svc, db, assigned } = withBooking();
    db.facts = { has_open_offer: true, tier2_valid: true };
    const res = await svc.getViewUrl(nurse, BOOKING);
    expect(res.basis).toBe('CANDIDATE_NURSE');
    expect(db.audits).toHaveLength(1);
    expect(assigned.calls).toHaveLength(0);
  });

  it('403 with the reason for a nurse without an offer, a Tier 1 nurse, or a closed booking — and no audit row', async () => {
    const a = withBooking();
    a.db.facts = { has_open_offer: false, tier2_valid: true };
    expect((await expectAppError(a.svc.getViewUrl(nurse, BOOKING), 403, 'PRESCRIPTION_ACCESS_DENIED')).details).toEqual({ reason: 'NOT_OFFERED' });

    const b = withBooking();
    b.db.facts = { has_open_offer: true, tier2_valid: false };
    expect((await expectAppError(b.svc.getViewUrl(nurse, BOOKING), 403, 'PRESCRIPTION_ACCESS_DENIED')).details).toEqual({ reason: 'TIER_2_REQUIRED' });

    const c = withBooking({ execution_status: ExecutionStatus.CONFIRMED, nurse_id: id(77) });
    c.db.facts = { has_open_offer: true, tier2_valid: true };
    expect((await expectAppError(c.svc.getViewUrl(nurse, BOOKING), 403, 'PRESCRIPTION_ACCESS_DENIED')).details).toEqual({ reason: 'BOOKING_NOT_OPEN' });

    expect([...a.db.audits, ...b.db.audits, ...c.db.audits]).toHaveLength(0);
  });

  it('the assigned nurse goes through the medical-record window of privacy-consent', async () => {
    const { svc, db, assigned } = withBooking({ execution_status: ExecutionStatus.CONFIRMED, nurse_id: NURSE });
    const res = await svc.getViewUrl(nurse, BOOKING);
    expect(res.basis).toBe('ASSIGNED_NURSE');
    expect(assigned.calls).toEqual([[BOOKING, NURSE]]);
    expect(db.audits).toHaveLength(1);

    assigned.deny = true;
    await expectAppError(svc.getViewUrl(nurse, BOOKING), 403, 'RECORD_ACCESS_DENIED');
    expect(db.audits).toHaveLength(1);
  });

  it('404 PRESCRIPTION_NOT_FOUND when the booking has none, without auditing', async () => {
    const { svc, db } = withBooking({ prescription_image_url: null, prescription_issued_date: null });
    await expectAppError(svc.getViewUrl({ id: ADMIN, role: UserRole.ADMIN }, BOOKING), 404, 'PRESCRIPTION_NOT_FOUND');
    expect(db.audits).toHaveLength(0);
  });
});
