import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { BookingExpiryService } from '../../src/modules/booking-expiry/booking-expiry.service';
import { createBookingSchema } from '../../src/modules/bookings/bookings.schema';
import { BookingsService } from '../../src/modules/bookings/bookings.service';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { JobBoardService } from '../../src/modules/job-board/job-board.service';
import { MatchingRadarService } from '../../src/modules/matching-radar/matching-radar.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * BE-3 · Phase 3 trên PostgreSQL 16 thật (migration 0001 → 0010 + seed dịch vụ):
 *  - gateway-webhooks: chữ ký HMAC, chống gửi lặp, giữ tiền (ESCROW_HELD) → bắt đầu ghép ca; trả tiền muộn → hoàn 100%;
 *  - booking-expiry: chưa trả sau 15 phút → EXPIRED; chưa có người nhận 30 phút trước giờ bắt đầu
 *    (ca khẩn: 30 phút sau khi bắt đầu ghép) → EXPIRED + hoàn 100% nếu đã giữ tiền;
 *  - job-board: bảng việc chỉ hiện ca nhận được (ký quỹ ADR-0004: đang ân hạn → chỉ ca chuyển khoản),
 *    ai nhận trước được; lời mời trực tiếp 15 phút độc quyền rồi phát lên bảng / Radar.
 * Đồng hồ = giờ thật (trigger của DB đóng dấu matching_started_at bằng now()); test "tua" đồng hồ khi cần.
 */
describe('BE-3 Phase 3: gateway-webhooks + booking-expiry + job-board (integration)', () => {
  let pool: Pool;
  let bookings: BookingsService;
  let radar: MatchingRadarService;
  let webhooks: GatewayWebhooksService;
  let expiry: BookingExpiryService;
  let board: JobBoardService;

  const SECRET = 'integration-webhook-secret';
  /** Unique per run: gateway references are idempotency keys, so a fixed one would hit the previous run's ledger row. */
  const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const ref = (name: string) => `${name}-${RUN}`;
  const HOUR = 3_600_000;
  const MIN = 60_000;
  const T0 = Date.now();
  let clock = T0;
  const radarStarts: { bookingId: string; exclude: string[] }[] = [];
  const scheduler = { scheduleJob: async () => ({}) };

  const CARE = { lat: 16.0 + Math.random() * 0.3, lng: 108.1 + Math.random() * 0.3 }; // Đà Nẵng area, isolated
  const NEAR = { lat: CARE.lat + 0.009, lng: CARE.lng };

  /** A whole-hour start `hours` from the current clock. */
  const at = (hours: number) => new Date(Math.ceil((clock + hours * HOUR) / HOUR) * HOUR);

  async function createCustomer(): Promise<{ id: string; homeProfile: string }> {
    const id = await createTestUser(pool);
    await pool.query(`UPDATE users SET kyc_status = 'VERIFIED' WHERE id = $1`, [id]);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Trần Văn Bình', '1950-01-01', 60, 'NORMAL', '1 Bạch Đằng', 'HOME', $2, $3, TRUE, now()) RETURNING id`,
      [id, CARE.lat, CARE.lng],
    );
    return { id, homeProfile: p.rows[0].id };
  }

  async function createNurse(over: { deposit?: number; graceDays?: number; closing?: boolean } = {}): Promise<string> {
    const phone = `06${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng job board', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, profile_status, current_lat, current_lng) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE', $2, $3)`,
      [id, NEAR.lat, NEAR.lng],
    );
    await pool.query(
      `INSERT INTO wallets (user_id, deposit_balance, deposit_grace_expires_at, closure_requested_at) VALUES ($1, $2, $3, $4)`,
      [id, over.deposit ?? 300_000, over.graceDays === undefined ? null : new Date(clock + over.graceDays * 86_400_000), over.closing ? new Date(clock) : null],
    );
    // Free every day, all day; the 22:00–02:00 overnight window bridges midnight.
    await pool.query(
      `INSERT INTO nurse_availabilities (nurse_id, day_of_week, start_time, end_time, availability_type)
       SELECT $1, d, w.s::time, w.e::time, 'RECURRING_AVAILABLE'
         FROM generate_series(0, 6) AS d, (VALUES ('00:00', '23:59'), ('22:00', '02:00')) AS w(s, e)`,
      [id],
    );
    return id;
  }

  async function book(c: { id: string; homeProfile: string }, startInHours: number, paymentMethod: 'CASH' | 'BANK_TRANSFER', invitedNurseId?: string) {
    const start = at(startInHours);
    return bookings.create(
      c.id,
      createBookingSchema.parse({
        serviceCode: 'SRV_WOUND_CARE',
        patientProfileId: c.homeProfile,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + HOUR).toISOString(),
        paymentMethod,
        ...(invitedNurseId ? { invitedNurseId } : {}),
      }),
    );
  }

  const webhook = (code: string, amount: number, reference: string, over: { secret?: string; success?: boolean } = {}) => {
    const data = { orderCode: code, amount, reference, description: code, transactionDateTime: new Date(clock).toISOString() };
    return { code: over.success === false ? '01' : '00', desc: 'x', success: over.success ?? true, data, signature: signData(data, over.secret ?? SECRET) };
  };

  const row = async (id: string) => (await pool.query('SELECT * FROM bookings WHERE id = $1', [id])).rows[0] as Record<string, any>;
  const ledger = async (bookingId: string) =>
    (await pool.query(`SELECT tx_type, amount, external_ref FROM wallet_transactions WHERE booking_id = $1 ORDER BY created_at, tx_type`, [bookingId]))
      .rows as { tx_type: string; amount: string; external_ref: string | null }[];
  const escrowOf = async (userId: string) =>
    Number((await pool.query('SELECT escrow_locked_balance FROM wallets WHERE user_id = $1', [userId])).rows[0]?.escrow_locked_balance ?? 0);
  const boardIds = async (nurseId: string) => (await board.listJobs(nurseId)).map((j) => j.id);

  async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
  }

  /** Pays a bank-transfer booking through the real webhook. */
  async function pay(view: { id: string; code: string; pricing: { totalAmount: number } }) {
    return webhooks.handleEscrowWebhook(webhook(view.code, view.pricing.totalAmount, ref(`FT-${view.id.slice(0, 8)}`)));
  }

  beforeAll(async () => {
    pool = createTestPool();
    const withTx = <T>(fn: (db: any) => Promise<T>) => runInTransaction(pool, fn);
    const now = () => clock;
    radar = new MatchingRadarService({ read: pool, withTx, scheduler, now });
    const startRadar = async (bookingId: string, exclude: string[] = []) => {
      radarStarts.push({ bookingId, exclude });
    };
    bookings = new BookingsService({
      read: pool,
      withTx,
      scheduler,
      startRadar: (id) => startRadar(id),
      storage: { statObject: async () => ({ sizeBytes: 1000 }), readObjectHead: async () => Buffer.alloc(16) },
      createUploadUrl: async (key) => ({ url: `https://signed.test/${key}`, expiresInSeconds: 600 }),
      now,
    });
    webhooks = new GatewayWebhooksService({
      read: pool,
      withTx,
      secret: () => SECRET,
      receivingAccount: () => ({ bankBin: '970422', bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST' }),
      startRadar: (id) => startRadar(id),
      now,
    });
    expiry = new BookingExpiryService({ withTx, now });
    board = new JobBoardService({
      read: pool,
      withTx,
      claim: (n, b, via) => radar.claimBooking(n, b, via),
      startRadar,
      now,
    });
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  // ===========================================================================
  describe('gateway-webhooks (FR-PAY-01, SEC-5.3/5.4)', () => {
    it('payment link: VietQR with amount + booking code, only while waiting for payment', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      const link = await webhooks.getPaymentLink(c.id, view.id);
      expect(link).toMatchObject({
        bookingCode: view.code,
        amount: view.pricing.totalAmount,
        checkoutUrl: null,
        expiresAt: new Date(clock + 15 * MIN).toISOString(),
        bankTransfer: { bankName: 'MB', accountNumber: '0001', accountName: 'CARENEST', transferContent: view.code },
      });
      expect(link.qrImageUrl).toContain(`amount=${view.pricing.totalAmount}`);

      const other = await createCustomer();
      await rejectsWith(webhooks.getPaymentLink(other.id, view.id), 403, 'FORBIDDEN');
      const cash = await book(c, 8, 'CASH');
      await rejectsWith(webhooks.getPaymentLink(c.id, cash.id), 400, 'NOT_TRANSFER_BOOKING');
    });

    it('bad signature → 401, nothing changes; valid → ESCROW_HELD + MATCHING; 5 re-deliveries book money once', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      const total = view.pricing.totalAmount;

      await rejectsWith(webhooks.handleEscrowWebhook(webhook(view.code, total, ref('FT-BAD'), { secret: 'wrong' })), 401, 'INVALID_SIGNATURE');
      expect(await row(view.id)).toMatchObject({ payment_status: 'UNPAID', execution_status: 'DRAFT' });

      const first = await webhooks.handleEscrowWebhook(webhook(view.code, total, ref('FT-OK-1')));
      expect(first).toEqual({ received: true, outcome: 'HELD', bookingId: view.id });
      const r = await row(view.id);
      expect(r).toMatchObject({ payment_status: 'ESCROW_HELD', execution_status: 'MATCHING', matching_mode: 'JOB_BOARD' });
      expect(r.matching_started_at).not.toBeNull();

      for (let i = 0; i < 5; i++) {
        expect((await webhooks.handleEscrowWebhook(webhook(view.code, total, ref('FT-OK-1')))).outcome).toBe('DUPLICATE');
      }
      expect(await ledger(view.id)).toEqual([{ tx_type: 'ESCROW_HOLD', amount: String(total), external_ref: ref('FT-OK-1') }]);
      expect(await escrowOf(c.id)).toBe(total);
    });

    it('urgent booking paid → Radar starts after COMMIT', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 2, 'BANK_TRANSFER');
      await pay(view);
      expect(await row(view.id)).toMatchObject({ execution_status: 'MATCHING', matching_mode: 'RADAR_DISPATCH' });
      expect(radarStarts).toContainEqual({ bookingId: view.id, exclude: [] });
    });

    it('wrong amount / unknown booking / failed payment → recorded, no money moves', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      expect((await webhooks.handleEscrowWebhook(webhook(view.code, 1000, ref('FT-MIS')))).outcome).toBe('AMOUNT_MISMATCH');
      expect((await webhooks.handleEscrowWebhook(webhook('HC-000000-NOPE00', 1000, ref('FT-UNK')))).outcome).toBe('UNKNOWN_BOOKING');
      expect((await webhooks.handleEscrowWebhook(webhook(view.code, view.pricing.totalAmount, ref('FT-FAIL'), { success: false }))).outcome).toBe(
        'NOT_SUCCESS',
      );
      expect(await row(view.id)).toMatchObject({ payment_status: 'UNPAID', execution_status: 'DRAFT' });
      expect(await ledger(view.id)).toEqual([]);
      const events = await pool.query(`SELECT outcome FROM payment_webhook_events WHERE provider_ref = ANY($1::text[]) ORDER BY outcome`, [
        [ref('FT-MIS'), ref('FT-UNK'), ref('FT-FAIL')],
      ]);
      expect(events.rows.map((e) => e.outcome)).toEqual(['AMOUNT_MISMATCH', 'NOT_SUCCESS', 'UNKNOWN_BOOKING']);
    });

    it('payment after the 15-minute hold → held and refunded 100% at once; booking EXPIRED / REFUNDED', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      clock = T0 + 15 * MIN + 1000;
      expect((await pay(view)).outcome).toBe('LATE_PAYMENT_REFUNDED');
      expect(await row(view.id)).toMatchObject({ execution_status: 'EXPIRED', payment_status: 'REFUNDED', cancellation_reason: 'PAYMENT_TIMEOUT' });
      expect((await ledger(view.id)).map((l) => l.tx_type)).toEqual(['ESCROW_HOLD', 'REFUND']);
      expect(await escrowOf(c.id)).toBe(0);
    });
  });

  // ===========================================================================
  describe('booking-expiry (FR-BOOK-01/03, BR-08 §2.5)', () => {
    it('unpaid bank transfer: nothing before 15 min; EXPIRED at 15 min; a second run changes nothing', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      clock = T0 + 15 * MIN - 1000;
      expect(await expiry.handlePaymentTimeout({ bookingId: view.id })).toEqual({ expired: false, reason: null, refunded: false });
      clock = T0 + 15 * MIN;
      expect(await expiry.handlePaymentTimeout({ bookingId: view.id })).toEqual({ expired: true, reason: 'PAYMENT_TIMEOUT', refunded: false });
      expect(await row(view.id)).toMatchObject({ execution_status: 'EXPIRED', payment_status: 'UNPAID' });
      expect((await expiry.handlePaymentTimeout({ bookingId: view.id })).expired).toBe(false);
    });

    it('paid, no nurse 30 min before the start → EXPIRED + 100% refund exactly once', async () => {
      clock = T0;
      const c = await createCustomer();
      const view = await book(c, 8, 'BANK_TRANSFER');
      await pay(view);
      const start = new Date((await row(view.id)).start_time).getTime();

      clock = start - 31 * MIN;
      expect((await expiry.expireIfDue(view.id)).expired).toBe(false);
      clock = start - 30 * MIN;
      expect(await expiry.expireIfDue(view.id)).toEqual({ expired: true, reason: 'UNMATCHED', refunded: true });
      expect(await row(view.id)).toMatchObject({ execution_status: 'EXPIRED', payment_status: 'REFUNDED', cancellation_reason: 'UNMATCHED' });
      expect((await ledger(view.id)).map((l) => l.tx_type)).toEqual(['ESCROW_HOLD', 'REFUND']);
      expect(await escrowOf(c.id)).toBe(0);

      expect((await expiry.expireIfDue(view.id)).expired).toBe(false);
      expect((await ledger(view.id)).length).toBe(2);
    });

    it('urgent booking: no claim 30 min after matching started → EXPIRED (+ refund); cash booking: no refund', async () => {
      clock = T0;
      const c = await createCustomer();
      const urgent = await book(c, 3, 'BANK_TRANSFER');
      await pay(urgent);
      const cash = await book(c, 3, 'CASH');
      clock = T0 + 31 * MIN;
      expect(await expiry.expireIfDue(urgent.id)).toEqual({ expired: true, reason: 'UNMATCHED', refunded: true });
      expect(await expiry.expireIfDue(cash.id)).toEqual({ expired: true, reason: 'UNMATCHED', refunded: false });
      expect(await row(cash.id)).toMatchObject({ execution_status: 'EXPIRED', payment_status: 'UNPAID' });
    });
  });

  // ===========================================================================
  describe('job-board (FR-BOOK-03 Mechanism B, ADR-0004 deposit rule)', () => {
    it('board shows what the nurse may take: grace nurse → BANK_TRANSFER only; closing → nothing; first accept wins', async () => {
      clock = T0;
      const c = await createCustomer();
      const cashJob = await book(c, 9, 'CASH');
      const transferJob = await book(c, 10, 'BANK_TRANSFER');
      await pay(transferJob);
      const unpaid = await book(c, 11, 'BANK_TRANSFER'); // DRAFT: never on the board

      const full = await createNurse();
      const graceNurse = await createNurse({ deposit: 0, graceDays: 20 });
      const closing = await createNurse({ closing: true });
      const second = await createNurse();

      const fullIds = await boardIds(full);
      expect(fullIds).toEqual(expect.arrayContaining([cashJob.id, transferJob.id]));
      expect(fullIds).not.toContain(unpaid.id);

      const graceIds = await boardIds(graceNurse);
      expect(graceIds).toContain(transferJob.id);
      expect(graceIds).not.toContain(cashJob.id);
      expect(await boardIds(closing)).not.toContain(transferJob.id);
      await rejectsWith(board.getJob(graceNurse, cashJob.id), 404, 'JOB_NOT_FOUND');
      expect(await board.getJob(full, cashJob.id)).toMatchObject({ id: cashJob.id, patientName: 'Bình', matchingMode: 'JOB_BOARD' });

      // The grace nurse cannot take the cash job even by calling the API directly (gate re-checked in the claim).
      await rejectsWith(board.accept(graceNurse, cashJob.id), 403, 'DEPOSIT_SHORTFALL');
      expect(await board.accept(full, cashJob.id)).toMatchObject({ success: true, booking_id: cashJob.id, bookingCode: cashJob.code });
      await rejectsWith(board.accept(second, cashJob.id), 409, 'ALREADY_CLAIMED');
      expect(await row(cashJob.id)).toMatchObject({ execution_status: 'CONFIRMED', nurse_id: full });
      expect(await boardIds(second)).not.toContain(cashJob.id);

      expect(await board.accept(graceNurse, transferJob.id)).toMatchObject({ success: true });
    });

    it('an urgent booking is not claimed through the board', async () => {
      clock = T0;
      const c = await createCustomer();
      const urgent = await book(c, 2, 'CASH');
      const n = await createNurse();
      await rejectsWith(board.accept(n, urgent.id), 409, 'NOT_ON_JOB_BOARD');
    });

    it('direct request: 15-minute exclusive window, others blocked; the invited nurse accepts', async () => {
      clock = T0;
      const c = await createCustomer();
      const invited = await createNurse();
      const other = await createNurse();
      const view = await book(c, 9, 'CASH', invited);

      const inv = await board.getDirectInvitation(invited);
      expect(inv).toMatchObject({ bookingId: view.id, code: view.code, patientName: 'Bình' });
      expect(new Date(inv!.expiresAt).getTime()).toBeGreaterThan(clock);
      expect(await board.getDirectInvitation(other)).toBeNull();
      expect(await boardIds(other)).not.toContain(view.id);
      await rejectsWith(board.accept(other, view.id), 409, 'DIRECT_REQUEST_PENDING');
      await rejectsWith(board.acceptDirectInvite(other, view.id), 403, 'NO_ACTIVE_OFFER');

      expect(await board.getJob(invited, view.id)).toMatchObject({ isDirectInvite: true, inviterName: expect.any(String) });
      expect(await board.acceptDirectInvite(invited, view.id)).toMatchObject({ success: true, booking_id: view.id });
      expect(await row(view.id)).toMatchObject({ execution_status: 'CONFIRMED', nurse_id: invited });
    });

    it('declined → on the board at once; window over (sweep) → board, or Radar without the invited nurse when urgent', async () => {
      clock = T0;
      const c = await createCustomer();
      const invited = await createNurse();
      const other = await createNurse();

      const declined = await book(c, 9, 'CASH', invited);
      expect(await board.declineDirectInvite(invited, declined.id)).toEqual({ success: true });
      expect(await boardIds(other)).toContain(declined.id);
      await rejectsWith(board.declineDirectInvite(invited, declined.id), 404, 'NO_DIRECT_INVITATION');

      const later = await book(c, 9, 'CASH', invited);
      const urgent = await book(c, 3, 'CASH', invited);
      expect(await row(urgent.id)).toMatchObject({ matching_mode: 'JOB_BOARD' }); // exclusive window first, even when urgent

      clock = T0 + 16 * MIN;
      await rejectsWith(board.acceptDirectInvite(invited, later.id), 403, 'NO_ACTIVE_OFFER');
      await board.runDirectRequestSweep();
      expect(await boardIds(other)).toContain(later.id);
      expect(await row(urgent.id)).toMatchObject({ matching_mode: 'RADAR_DISPATCH', execution_status: 'MATCHING' });
      expect(radarStarts).toContainEqual({ bookingId: urgent.id, exclude: [invited] });
      const offers = await pool.query(`SELECT status FROM booking_offers WHERE booking_id = ANY($1::uuid[]) AND offer_type = 'DIRECT_REQUEST'`, [
        [later.id, urgent.id],
      ]);
      expect(offers.rows.map((o) => o.status)).toEqual(['EXPIRED', 'EXPIRED']);
    });
  });
});
