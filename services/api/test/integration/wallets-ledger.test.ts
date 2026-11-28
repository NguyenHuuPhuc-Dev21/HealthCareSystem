import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { InsufficientBalanceError, postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WalletsLedgerService } from '../../src/modules/wallets-ledger/wallets-ledger.service';
import { createTestPool, createTestUser } from './helpers';

/**
 * wallets-ledger (BE-3 · Phase 5) trên PostgreSQL 16 thật (migration 0001 → 0016 + seed dịch vụ):
 *  - postNurseEntry: một dòng sổ cái append-only / lần, idempotent, ví khả dụng không bao giờ âm, ký quỹ được âm;
 *  - /wallets/me: 3 số dư, ân hạn ký quỹ (ADR-0004 D2), banner tạm khóa theo thứ tự ưu tiên;
 *  - /wallets/me/transactions: số tiền có dấu, mô tả tiếng Việt, lọc theo chip, phân trang bằng cursor;
 *  - /wallets/me/earnings + /upcoming-settlements;
 *  - hỗ trợ đi lại khi từ chối y lệnh (0012) → TRAVEL_SUPPORT + PAID, đúng 1 lần.
 */
describe('wallets-ledger (integration)', () => {
  let pool: Pool;
  let service: WalletsLedgerService;
  const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const key = (name: string) => `test-wl:${name}:${RUN}`;
  const HOUR = 3_600_000;
  let serviceId: string;
  let customer: { id: string; profile: string };

  async function createNurse(o: { deposit?: number; graceDays?: number; closing?: boolean } = {}): Promise<string> {
    const phone = `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng ví', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await pool.query(
      `INSERT INTO wallets (user_id, deposit_balance, deposit_grace_expires_at, closure_requested_at) VALUES ($1, $2, $3, $4)`,
      [
        id,
        o.deposit ?? 300_000,
        o.graceDays === undefined ? null : new Date(Date.now() + o.graceDays * 86_400_000),
        o.closing ? new Date() : null,
      ],
    );
    return id;
  }

  async function createBooking(nurseId: string, o: {
    payment: 'BANK_TRANSFER' | 'CASH';
    status: string;
    paymentStatus: string;
    total?: number;
    fee?: number;
    commissionDueAt?: Date | null;
    dispute?: string;
    checkoutAt?: Date | null;
  }): Promise<{ id: string; code: string }> {
    const code = `HC-W${randomUUID().slice(0, 10)}`;
    const start = Date.now() - 6 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, platform_fee, total_amount, execution_status, payment_status,
          commission_due_at, dispute_status)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, $9, $10, $9,
               $11::execution_status_enum, $12::payment_status_enum, $13, $14::booking_dispute_status_enum)
       RETURNING id`,
      [
        code, customer.id, customer.profile, nurseId, serviceId, o.payment, new Date(start), new Date(start + 4 * HOUR),
        o.total ?? 500_000, o.fee ?? 75_000, o.status, o.paymentStatus, o.commissionDueAt ?? null, o.dispute ?? 'NONE',
      ],
    );
    if (o.checkoutAt !== undefined) {
      await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)`, [
        rows[0].id, new Date(start), o.checkoutAt,
      ]);
    }
    return { id: rows[0].id, code };
  }

  const post = (e: Parameters<typeof postNurseEntry>[1]) => withTransaction((db) => postNurseEntry(db, e));

  beforeAll(async () => {
    pool = createTestPool();
    service = new WalletsLedgerService({ read: { query }, withTx: (fn) => withTransaction((c) => fn(c)) });
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Lê Thị Hoa', '1948-03-02', 55, 'NORMAL', '2 Trần Phú', 'HOME', 16.05, 108.2, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  describe('postNurseEntry', () => {
    it('books once per idempotency key, available never negative, deposit may go negative', async () => {
      const nurse = await createNurse({ deposit: 0 });
      const first = await post({ userId: nurse, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 50_000, idempotencyKey: key('topup'), externalRef: 'CUST-1' });
      expect(first).toMatchObject({ balanceBefore: 0, balanceAfter: 50_000 });
      expect(await post({ userId: nurse, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 50_000, idempotencyKey: key('topup'), externalRef: 'CUST-1' })).toBeNull();

      await expect(
        post({ userId: nurse, bookingId: null, txType: TxType.WITHDRAW, balance: 'AVAILABLE', delta: -1, idempotencyKey: key('overdraw'), externalRef: null }),
      ).rejects.toBeInstanceOf(InsufficientBalanceError);

      const debt = await post({ userId: nurse, bookingId: null, txType: TxType.PENALTY_DEDUCT, balance: 'DEPOSIT', delta: -80_000, idempotencyKey: key('penalty'), externalRef: null });
      expect(debt).toMatchObject({ balanceBefore: 50_000, balanceAfter: -30_000 });

      const w = await pool.query(`SELECT available_balance, deposit_balance FROM wallets WHERE user_id = $1`, [nurse]);
      expect(w.rows[0]).toEqual({ available_balance: '0', deposit_balance: '-30000' });
      const n = await pool.query(
        `SELECT count(*)::int AS n FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id WHERE w.user_id = $1`,
        [nurse],
      );
      expect(n.rows[0].n).toBe(2); // topup + penalty; duplicate and overdraw wrote nothing
    });
  });

  describe('history, earnings, summary of one nurse', () => {
    let nurse: string;
    let settled: { id: string; code: string };

    beforeAll(async () => {
      nurse = await createNurse({ deposit: 0, graceDays: 20 });
      settled = await createBooking(nurse, { payment: 'BANK_TRANSFER', status: 'COMPLETED', paymentStatus: 'SETTLED' });
      const k = (n: string) => key(`${nurse}:${n}`);
      await post({ userId: nurse, bookingId: settled.id, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: 297_500, idempotencyKey: k('release'), externalRef: null });
      await post({ userId: nurse, bookingId: settled.id, txType: TxType.DEPOSIT_WITHHOLD, balance: 'DEPOSIT', delta: 127_500, idempotencyKey: k('withhold'), externalRef: null });
      await post({ userId: nurse, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 172_500, idempotencyKey: k('topup'), externalRef: 'CUST-2' });
      await post({ userId: nurse, bookingId: settled.id, txType: TxType.PENALTY_DEDUCT, balance: 'DEPOSIT', delta: -60_000, idempotencyKey: k('penalty'), externalRef: null });
      await post({ userId: nurse, bookingId: null, txType: TxType.WITHDRAW, balance: 'AVAILABLE', delta: -100_000, idempotencyKey: k('withdraw'), externalRef: 'BANK-1' });
    });

    it('lists newest first with signed amounts and Vietnamese descriptions, page by page', async () => {
      const seen: { type: string; amount: number; description: string; bookingCode?: string }[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await service.listTransactions(nurse, { cursor, limit: 2 });
        seen.push(...page.items);
        cursor = page.nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < 10);
      expect(pages).toBe(3);
      expect(seen.map((t) => [t.type, t.amount])).toEqual([
        ['WITHDRAW', -100_000],
        ['PENALTY_DEDUCT', -60_000],
        ['TOPUP', 172_500],
        ['DEPOSIT_WITHHOLD', 127_500],
        ['ESCROW_RELEASE', 297_500],
      ]);
      expect(seen[4]).toMatchObject({ bookingCode: settled.code, description: `Quyết toán ca ${settled.code}` });
      expect(seen[0].description).toBe('Rút tiền về ngân hàng');
    });

    it('filters by the wallet-screen chips and by an exact type', async () => {
      const types = async (type: string) => (await service.listTransactions(nurse, { type })).items.map((t) => t.type);
      expect(await types('PENALTY')).toEqual(['PENALTY_DEDUCT']);
      expect(await types('SETTLE')).toEqual(['DEPOSIT_WITHHOLD', 'ESCROW_RELEASE']);
      expect(await types('DEPOSIT')).toEqual(['PENALTY_DEDUCT', 'TOPUP', 'DEPOSIT_WITHHOLD']);
      expect(await types('WITHDRAW')).toEqual(['WITHDRAW']);
      expect(await types('TOPUP')).toEqual(['TOPUP']);
    });

    it('rejects an unknown filter or a forged cursor with 400', async () => {
      await expect(service.listTransactions(nurse, { type: 'NOPE' })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' });
      const err = await service.listTransactions(nurse, { cursor: 'forged' }).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({ code: 'INVALID_CURSOR' });
    });

    it('counts settlement + withholding as earnings, not top-ups, penalties or withdrawals', async () => {
      for (const range of ['week', 'month'] as const) {
        const e = await service.getEarnings(nurse, range);
        expect(e.totalAmount).toBe(297_500 + 127_500);
        expect(e.points.reduce((s, p) => s + p.amount, 0)).toBe(e.totalAmount);
      }
      expect((await service.getEarnings(nurse, 'week')).points.map((p) => p.label)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    });

    it('summary: balances, short deposit inside grace → not suspended', async () => {
      const s = await service.getSummary(nurse);
      expect(s).toMatchObject({
        availableBalance: 197_500,
        depositBalance: 240_000,
        minDeposit: 300_000,
        depositGraceActive: true,
        isSuspended: false,
        suspendedReason: null,
        escrowLockedBalance: 0,
      });
    });

    it('a nurse with no wallet gets zeros and empty lists', async () => {
      const phone = `05${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
      const { rows } = await pool.query("INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Chưa có ví', 'NURSE', 'ACTIVE') RETURNING id", [phone]);
      expect(await service.listTransactions(rows[0].id, {})).toEqual({ items: [], nextCursor: null });
      expect((await service.getEarnings(rows[0].id, 'month')).totalAmount).toBe(0);
      expect(await service.getSummary(rows[0].id)).toMatchObject({ availableBalance: 0, depositBalance: 0, suspendedReason: 'DEPOSIT_BELOW_MIN' });
    });
  });

  describe('suspension banner', () => {
    it('short deposit without grace → DEPOSIT_BELOW_MIN; closure → ACCOUNT_CLOSING', async () => {
      expect((await service.getSummary(await createNurse({ deposit: 100_000 }))).suspendedReason).toBe('DEPOSIT_BELOW_MIN');
      expect((await service.getSummary(await createNurse({ deposit: 100_000, graceDays: -1 }))).suspendedReason).toBe('DEPOSIT_BELOW_MIN');
      expect((await service.getSummary(await createNurse({ closing: true }))).suspendedReason).toBe('ACCOUNT_CLOSING');
    });

    it('cash commission past its deadline without payment → COMMISSION_OVERDUE, until it is paid', async () => {
      const nurse = await createNurse();
      const b = await createBooking(nurse, { payment: 'CASH', status: 'COMPLETED', paymentStatus: 'UNPAID', commissionDueAt: new Date(Date.now() - HOUR) });
      expect(await service.getSummary(nurse)).toMatchObject({ isSuspended: true, suspendedReason: 'COMMISSION_OVERDUE' });
      // The nurse pays the 15% by payment link (commission module, later): only the ledger row matters here.
      await pool.query(
        `INSERT INTO wallet_transactions (wallet_id, booking_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after, external_ref)
         SELECT id, $2, $3, 'COMMISSION_PAYMENT', 'AVAILABLE', 75000, available_balance, available_balance, 'PAY-1' FROM wallets WHERE user_id = $1`,
        [nurse, b.id, key(`commission:${b.id}`)],
      );
      expect(await service.getSummary(nurse)).toMatchObject({ isSuspended: false, suspendedReason: null });
    });

    it('trust-score suspension → TRUST_SCORE_LOW', async () => {
      const nurse = await createNurse();
      await pool.query(`UPDATE nurse_profiles SET profile_status = 'SUSPENDED', suspended_reason = 'TRUST_SCORE_BELOW_THRESHOLD' WHERE user_id = $1`, [nurse]);
      expect((await service.getSummary(nurse)).suspendedReason).toBe('TRUST_SCORE_LOW');
    });
  });

  describe('upcoming settlements', () => {
    it('checked-out transfer shifts still in escrow, settleAt = check-out + SETTLEMENT_COOLING_HOURS', async () => {
      const nurse = await createNurse();
      const out = new Date(Math.floor((Date.now() - 2 * HOUR) / 1000) * 1000);
      const a = await createBooking(nurse, { payment: 'BANK_TRANSFER', status: 'COMPLETED', paymentStatus: 'ESCROW_HELD', checkoutAt: out });
      const b = await createBooking(nurse, { payment: 'BANK_TRANSFER', status: 'COMPLETED', paymentStatus: 'ESCROW_HELD', total: 400_000, fee: 60_000, dispute: 'OPEN', checkoutAt: new Date(out.getTime() + 1000) });
      await createBooking(nurse, { payment: 'BANK_TRANSFER', status: 'IN_PROGRESS', paymentStatus: 'ESCROW_HELD', checkoutAt: null }); // not checked out
      await createBooking(nurse, { payment: 'CASH', status: 'COMPLETED', paymentStatus: 'UNPAID', checkoutAt: out }); // cash: nothing held

      const list = await service.getUpcomingSettlements(nurse);
      expect(list).toEqual([
        { bookingCode: a.code, serviceName: expect.any(String), grossAmount: 500_000, commissionAmount: 75_000, netAmount: 425_000,
          settleAt: new Date(out.getTime() + 24 * HOUR).toISOString(), disputeOpen: false },
        expect.objectContaining({ bookingCode: b.code, netAmount: 340_000, disputeOpen: true }),
      ]);
      expect((await service.getSummary(nurse)).escrowLockedBalance).toBe(425_000 + 340_000);
    });
  });

  describe('travel support (FR-BOOK-02 Layer 3)', () => {
    it('pays a PENDING rejection once: TRAVEL_SUPPORT credit + PAID in one transaction', async () => {
      const nurse = await createNurse();
      const b = await createBooking(nurse, { payment: 'BANK_TRANSFER', status: 'CANCELLED', paymentStatus: 'REFUNDED' });
      const { rows } = await pool.query(
        `INSERT INTO prescription_rejections (booking_id, nurse_id, reason, evidence_file_url, travel_support_amount)
         VALUES ($1, $2, 'Đơn thuốc đã hết hạn sử dụng', 'prescription-rejection/test.jpg', 50000) RETURNING id`,
        [b.id, nurse],
      );
      const rejectionId: string = rows[0].id;

      const sweep = await service.runTravelSupportSweep();
      expect(sweep.paid).toBeGreaterThanOrEqual(1);
      expect(sweep.failed).toBe(0);

      const r = await pool.query(`SELECT travel_support_status, travel_support_paid_at FROM prescription_rejections WHERE id = $1`, [rejectionId]);
      expect(r.rows[0].travel_support_status).toBe('PAID');
      expect(r.rows[0].travel_support_paid_at).not.toBeNull();

      expect(await service.payTravelSupport(rejectionId)).toBe('ALREADY_PAID');
      expect(await service.payTravelSupport(randomUUID())).toBe('NOT_FOUND');

      const tx = await service.listTransactions(nurse, { type: 'TRAVEL_SUPPORT' });
      expect(tx.items).toHaveLength(1);
      expect(tx.items[0]).toMatchObject({ amount: 50_000, balanceType: 'AVAILABLE', bookingCode: b.code });
      expect((await service.getSummary(nurse)).availableBalance).toBe(50_000);
      expect((await service.getEarnings(nurse, 'month')).totalAmount).toBe(50_000);
    });
  });
});
