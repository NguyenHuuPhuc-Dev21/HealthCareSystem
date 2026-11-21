import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import * as storage from '../../src/core/storage';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { PrescriptionRejectionService } from '../../src/modules/prescription-rejection/prescription-rejection.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * prescription-rejection on real PostgreSQL 16 (FR-BOOK-02 Layer 3): the cancel, the 100% escrow refund through
 * BE-3's ledger, the prescription_rejections row (migration 0012), no penalty for the nurse, and that two
 * concurrent calls cannot both win. Storage is faked (no S3 needed); the clock is fixed.
 * (Test users are not deleted: other tables reference them.)
 */
describe('prescription-rejection (integration)', () => {
  let pool: Pool;
  let customerId: string;
  let profileId: string;
  let invasiveServiceId: string;
  let basicServiceId: string;
  let slot = 0;
  // Bookings start in 2027; "now" is set 10 minutes before each booking's start.
  let now = 0;
  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  const REASON = 'Y lệnh bị tẩy xóa ngày kê, thuốc thực tế không khớp';

  const service = () =>
    new PrescriptionRejectionService({
      storage: {
        buildObjectKey: storage.buildObjectKey,
        createUploadUrl: async (objectKey) => ({ url: `https://storage.test/put/${objectKey}`, objectKey, expiresInSeconds: 600 }),
        statObject: async () => ({ sizeBytes: 2048, contentType: 'image/jpeg' }),
        readObjectHead: async () => JPEG,
      },
      db: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      getNumber: async (key) => (key === 'ICU_TRAVEL_SUPPORT' ? 50_000 : 60),
      maxUploadBytes: storage.MAX_UPLOAD_BYTES,
      now: () => now,
    });

  beforeAll(async () => {
    pool = createTestPool();
    customerId = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, location_type, data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Bệnh nhân test', 'HOME', TRUE, now()) RETURNING id`,
      [customerId],
    );
    profileId = p.rows[0].id;
    invasiveServiceId = (await pool.query("SELECT id FROM service_categories WHERE is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1")).rows[0].id;
    basicServiceId = (await pool.query("SELECT id FROM service_categories WHERE NOT is_invasive AND NOT is_prohibited ORDER BY code LIMIT 1")).rows[0].id;
  });

  afterAll(async () => {
    await pool.end();
  });

  async function createNurse(): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng test', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, gphn_number, gphn_expiry_date, profile_status)
       VALUES ($1, 'TIER_2_SPECIALIST', $2, '2029-12-31', 'ACTIVE')`,
      [rows[0].id, `GPHN-${randomUUID().slice(0, 6)}`],
    );
    return rows[0].id;
  }

  /** A CONFIRMED booking for `nurseId`; a prepaid one also gets its escrow really held in the customer wallet. */
  async function createBooking(
    nurseId: string,
    opts: { payment?: 'BANK_TRANSFER' | 'CASH'; invasive?: boolean; amount?: number } = {},
  ): Promise<string> {
    slot += 1;
    const start = new Date(Date.UTC(2027, 0, slot, 2, 0, 0));
    now = start.getTime() - 10 * 60_000;
    const payment = opts.payment ?? 'BANK_TRANSFER';
    const amount = opts.amount ?? 350_000;
    const prepaid = payment === 'BANK_TRANSFER';
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, payment_status, prescription_verified_by_nurse)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, $9, $9, 'CONFIRMED', $10::payment_status_enum, TRUE)
       RETURNING id`,
      [
        `R-${randomUUID().slice(0, 12)}`,
        customerId,
        profileId,
        nurseId,
        opts.invasive === false ? basicServiceId : invasiveServiceId,
        payment,
        start,
        new Date(start.getTime() + 4 * 3_600_000),
        amount,
        prepaid ? 'ESCROW_HELD' : 'UNPAID',
      ],
    );
    const bookingId = rows[0].id;
    if (prepaid) {
      await runInTransaction(pool, (db) =>
        holdEscrow(db, { customerId, bookingId, amount, idempotencyKey: `test-hold:${bookingId}`, externalRef: null }),
      );
    }
    return bookingId;
  }

  const evidenceKey = (nurseId: string) => storage.buildObjectKey('prescription-rejection', nurseId, 'image/jpeg');
  const escrow = async () =>
    Number((await pool.query('SELECT escrow_locked_balance FROM wallets WHERE user_id = $1', [customerId])).rows[0].escrow_locked_balance);

  async function errorOf(p: Promise<unknown>): Promise<AppError> {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }

  it('prepaid booking: cancelled, 100% refunded through the ledger, evidence + travel support stored, nurse not penalised', async () => {
    const nurse = await createNurse();
    const booking = await createBooking(nurse, { amount: 350_000 });
    const escrowBefore = await escrow();
    const key = evidenceKey(nurse);

    const res = await service().reject(nurse, booking, { reason: REASON, evidenceKey: key });

    expect(res).toMatchObject({ executionStatus: 'CANCELLED', paymentStatus: 'REFUNDED', refundedAmount: 350_000, travelSupportAmount: 50_000 });
    const b = (
      await pool.query('SELECT execution_status, payment_status, cancelled_by, cancellation_reason, cancelled_at FROM bookings WHERE id = $1', [booking])
    ).rows[0];
    expect(b).toMatchObject({ execution_status: 'CANCELLED', payment_status: 'REFUNDED', cancelled_by: nurse, cancellation_reason: 'INVALID_PRESCRIPTION' });
    expect(b.cancelled_at).not.toBeNull();

    expect(await escrow()).toBe(escrowBefore - 350_000);
    const ledger = await pool.query(
      "SELECT amount FROM wallet_transactions WHERE booking_id = $1 AND tx_type = 'REFUND'",
      [booking],
    );
    expect(ledger.rows.map((r) => Number(r.amount))).toEqual([350_000]);

    const rej = (await pool.query('SELECT * FROM prescription_rejections WHERE booking_id = $1', [booking])).rows[0];
    expect(rej).toMatchObject({ nurse_id: nurse, reason: REASON, evidence_file_url: key, travel_support_status: 'PENDING' });
    expect(Number(rej.refunded_amount)).toBe(350_000);
    expect(Number(rej.travel_support_amount)).toBe(50_000);

    const profile = (await pool.query('SELECT trust_score FROM nurse_profiles WHERE user_id = $1', [nurse])).rows[0];
    expect(profile.trust_score).toBe(100);
    const nurseLedger = await pool.query(
      'SELECT count(*)::int AS n FROM wallet_transactions wt JOIN wallets w ON w.id = wt.wallet_id WHERE w.user_id = $1',
      [nurse],
    );
    expect(nurseLedger.rows[0].n).toBe(0);
  });

  it('cash booking: cancelled, nothing refunded, payment status unchanged', async () => {
    const nurse = await createNurse();
    const booking = await createBooking(nurse, { payment: 'CASH' });

    const res = await service().reject(nurse, booking, { reason: REASON, evidenceKey: evidenceKey(nurse) });

    expect(res).toMatchObject({ paymentStatus: 'UNPAID', refundedAmount: 0 });
    const ledger = await pool.query('SELECT count(*)::int AS n FROM wallet_transactions WHERE booking_id = $1', [booking]);
    expect(ledger.rows[0].n).toBe(0);
  });

  it('a second call is refused and refunds nothing more', async () => {
    const nurse = await createNurse();
    const booking = await createBooking(nurse);
    await service().reject(nurse, booking, { reason: REASON, evidenceKey: evidenceKey(nurse) });

    expect((await errorOf(service().reject(nurse, booking, { reason: REASON, evidenceKey: evidenceKey(nurse) }))).code).toBe('ALREADY_CANCELLED');
    const ledger = await pool.query("SELECT count(*)::int AS n FROM wallet_transactions WHERE booking_id = $1 AND tx_type = 'REFUND'", [booking]);
    expect(ledger.rows[0].n).toBe(1);
  });

  it('two concurrent calls: exactly one wins, one refund, one rejection row', async () => {
    const nurse = await createNurse();
    const booking = await createBooking(nurse);

    const results = await Promise.allSettled([
      service().reject(nurse, booking, { reason: REASON, evidenceKey: evidenceKey(nurse) }),
      service().reject(nurse, booking, { reason: REASON, evidenceKey: evidenceKey(nurse) }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((loser.reason as AppError).code).toBe('ALREADY_CANCELLED');
    const refunds = await pool.query("SELECT count(*)::int AS n FROM wallet_transactions WHERE booking_id = $1 AND tx_type = 'REFUND'", [booking]);
    expect(refunds.rows[0].n).toBe(1);
    const rows = await pool.query('SELECT count(*)::int AS n FROM prescription_rejections WHERE booking_id = $1', [booking]);
    expect(rows.rows[0].n).toBe(1);
  });

  it('refuses another nurse, a non-invasive service and a shift that is still too far away', async () => {
    const nurse = await createNurse();
    const other = await createNurse();
    const booking = await createBooking(nurse);
    expect((await errorOf(service().reject(other, booking, { reason: REASON, evidenceKey: evidenceKey(other) }))).code).toBe('NOT_ASSIGNED_NURSE');

    const basic = await createBooking(nurse, { invasive: false });
    expect((await errorOf(service().reject(nurse, basic, { reason: REASON, evidenceKey: evidenceKey(nurse) }))).code).toBe('PRESCRIPTION_NOT_REQUIRED');

    const later = await createBooking(nurse);
    now -= 2 * 3_600_000; // two hours earlier than "10 minutes before start"
    expect((await errorOf(service().reject(nurse, later, { reason: REASON, evidenceKey: evidenceKey(nurse) }))).code).toBe('TOO_EARLY_TO_REJECT');
    const status = (await pool.query('SELECT execution_status FROM bookings WHERE id = $1', [later])).rows[0].execution_status;
    expect(status).toBe('CONFIRMED');
  });
});
