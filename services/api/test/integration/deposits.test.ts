import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PenaltyReason, TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { deductPenalty, reversePenalty } from '../../src/modules/deposits/deposits.ledger';
import { DepositsService } from '../../src/modules/deposits/deposits.service';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * deposits (BE-3 · Phase 5 · ADR-0004) trên PostgreSQL 16 thật (migration 0001 → 0017):
 *  - ân hạn bắt đầu khi hồ sơ ACTIVE lần đầu (trigger), trạng thái ký quỹ;
 *  - nạp ký quỹ qua VietQR: link ≤ phần thiếu, webhook "KQ…" chỉ ghi tối đa phần còn thiếu, phần dư trả lại, chống lặp;
 *  - phạt có giải thích + kháng cáo trong hạn (dispute PENALTY_APPEAL) + hoàn phạt (PENALTY_REVERSAL);
 *  - đóng tài khoản: 4 điều kiện → WAITING_HOLD / READY (+ hạn chi trả), huỷ trước READY, chi trả / từ chối (Admin);
 *  - đối soát hằng ngày: lệch → đóng băng chi trả cho tới khi Admin xử lý.
 */
describe('deposits (integration)', () => {
  let pool: Pool;
  let service: DepositsService;
  let webhooks: GatewayWebhooksService;
  let admin: string;
  let serviceId: string;
  let customer: { id: string; profile: string };
  const SECRET = 'integration-deposit-secret';
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const CUSTODY = {
    bankBin: '970418',
    bankName: 'BIDV (lưu ký, sandbox)',
    accountNumber: '12410006899999',
    accountName: 'CARENEST KY QUY',
    partnerName: 'Ngân hàng đối tác lưu ký (mô phỏng)',
  };
  const ref = () => `FT-KQ-${randomUUID().slice(0, 12)}`;
  const pay = (orderCode: string, amount: number, reference: string) => {
    const data = { orderCode, amount, reference, description: orderCode, transactionDateTime: new Date().toISOString() };
    return webhooks.handleEscrowWebhook({ code: '00', desc: 'success', success: true, data, signature: signData(data, SECRET) });
  };
  const tx = <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c));

  async function createNurse(o: { deposit?: number; graceDays?: number; status?: string; wallet?: boolean } = {}): Promise<string> {
    const phone = `04${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng ký quỹ', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', $2::profile_status_enum)`, [
      id,
      o.status ?? 'ACTIVE',
    ]);
    if (o.wallet !== false) {
      await pool.query(`INSERT INTO wallets (user_id, deposit_grace_expires_at) VALUES ($1, $2)`, [
        id,
        o.graceDays === undefined ? null : new Date(Date.now() + o.graceDays * DAY),
      ]);
      // The deposit always comes in through the ledger (reconciliation stays exact).
      if (o.deposit) await creditDeposit(id, o.deposit);
    }
    return id;
  }

  const creditDeposit = (nurseId: string, amount: number) =>
    tx((db) =>
      postNurseEntry(db, { userId: nurseId, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: amount, idempotencyKey: `test-dep:${randomUUID()}`, externalRef: 'TEST' }),
    );

  const depositOf = async (nurseId: string) =>
    Number((await pool.query(`SELECT deposit_balance FROM wallets WHERE user_id = $1`, [nurseId])).rows[0].deposit_balance);

  async function createBooking(nurseId: string, o: { status: string; payment?: string; checkoutAt?: Date; commissionDueAt?: Date }): Promise<string> {
    const start = Date.now() - 6 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, total_amount, execution_status, payment_status, commission_due_at)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 300000, 300000,
               $9::execution_status_enum, 'UNPAID', $10)
       RETURNING id`,
      [`HC-D${randomUUID().slice(0, 10)}`, customer.id, customer.profile, nurseId, serviceId, o.payment ?? 'BANK_TRANSFER',
        new Date(start), new Date(start + 4 * HOUR), o.status, o.commissionDueAt ?? null],
    );
    if (o.checkoutAt) {
      await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, $3)`, [rows[0].id, new Date(start), o.checkoutAt]);
    }
    return rows[0].id;
  }

  const resolveOpenMismatches = () =>
    pool.query(
      `UPDATE deposit_reconciliations SET resolved_by = $1, resolved_at = now(), resolution_note = 'integration test cleanup'
        WHERE status = 'MISMATCH' AND resolved_at IS NULL`,
      [admin],
    );

  beforeAll(async () => {
    pool = createTestPool();
    service = new DepositsService({ read: { query }, withTx: (fn) => withTransaction((c) => fn(c)), custodyAccount: () => CUSTODY });
    webhooks = new GatewayWebhooksService({
      read: pool,
      withTx: (fn) => withTransaction((c) => fn(c)),
      secret: () => SECRET,
      receivingAccount: () => null,
      startRadar: async () => {},
    });
    admin = await findOrCreateAdmin(pool);
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Phạm Văn Nam', '1945-06-01', 58, 'NORMAL', '3 Lê Lợi', 'HOME', 16.06, 108.21, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  describe('grace period and status (ADR-0004 D2)', () => {
    it('starts once, when the profile first becomes ACTIVE', async () => {
      const nurse = await createNurse({ status: 'PENDING_VERIFICATION', wallet: false });
      await pool.query(`UPDATE nurse_profiles SET profile_status = 'ACTIVE' WHERE user_id = $1`, [nurse]);
      const first = (await pool.query(`SELECT deposit_grace_expires_at FROM wallets WHERE user_id = $1`, [nurse])).rows[0].deposit_grace_expires_at as Date;
      expect(Math.abs(first.getTime() - (Date.now() + 30 * DAY))).toBeLessThan(5 * 60_000);

      await pool.query(`UPDATE nurse_profiles SET profile_status = 'SUSPENDED' WHERE user_id = $1`, [nurse]);
      await pool.query(`UPDATE nurse_profiles SET profile_status = 'ACTIVE' WHERE user_id = $1`, [nurse]);
      const again = (await pool.query(`SELECT deposit_grace_expires_at FROM wallets WHERE user_id = $1`, [nurse])).rows[0].deposit_grace_expires_at as Date;
      expect(again.getTime()).toBe(first.getTime());

      expect(await service.getStatus(nurse)).toMatchObject({
        depositBalance: 0,
        minDeposit: 300_000,
        shortfall: 300_000,
        grace: { active: true, shiftsUsed: 0, maxShifts: 3, withholdRate: 0.3 },
        canAcceptCash: false,
        canAcceptTransfer: true,
        custodyPartnerName: CUSTODY.partnerName,
      });
    });
  });

  describe('top-up by VietQR', () => {
    it('link ≤ shortfall; at payment only what is still missing is credited, the rest returned; once per reference', async () => {
      const nurse = await createNurse({ graceDays: 20 });
      await expect(service.createTopupLink(nurse, 300_001)).rejects.toMatchObject({ status: 400, code: 'TOPUP_EXCEEDS_SHORTFALL' });

      const link = await service.createTopupLink(nurse, 200_000);
      expect(link).toMatchObject({ amount: 200_000, bankName: CUSTODY.bankName, accountNumber: CUSTODY.accountNumber });
      expect(link.transferContent).toMatch(/^KQ[A-Z2-9]{12}$/);
      expect(link.qrImageUrl).toContain(CUSTODY.accountNumber);
      expect(await service.getTopupStatus(nurse, link.topupId)).toEqual({ status: 'PENDING' });

      // Meanwhile a settlement withheld 150,000 into the deposit (ADR-0004 D2): only 150,000 is still missing.
      await tx((db) =>
        postNurseEntry(db, { userId: nurse, bookingId: null, txType: TxType.DEPOSIT_WITHHOLD, balance: 'DEPOSIT', delta: 150_000, idempotencyKey: `test-dep:${randomUUID()}`, externalRef: null }),
      );

      const reference = ref();
      expect(await pay(link.transferContent, 200_000, reference)).toMatchObject({ outcome: 'TOPUP_EXCESS_RETURNED', bookingId: null });
      expect(await depositOf(nurse)).toBe(300_000);
      expect(await service.getTopupStatus(nurse, link.topupId)).toEqual({ status: 'COMPLETED' });
      const row = (await pool.query(`SELECT credited_amount, returned_amount FROM deposit_topups WHERE id = $1`, [link.topupId])).rows[0];
      expect(row).toEqual({ credited_amount: '150000', returned_amount: '50000' });
      const ledger = await pool.query(`SELECT amount, external_ref FROM wallet_transactions WHERE idempotency_key = $1`, [`deposit-topup:${reference}`]);
      expect(ledger.rows).toEqual([{ amount: '150000', external_ref: reference }]);

      expect(await pay(link.transferContent, 200_000, reference)).toMatchObject({ outcome: 'DUPLICATE' });
      expect(await pay(link.transferContent, 200_000, ref())).toMatchObject({ outcome: 'TOPUP_RETURNED' });
      expect(await depositOf(nurse)).toBe(300_000);
      await expect(service.createTopupLink(nurse, 1)).rejects.toMatchObject({ status: 409, code: 'DEPOSIT_FULL' });

      const events = await pool.query(`SELECT outcome FROM payment_webhook_events WHERE order_code = $1 ORDER BY received_at`, [link.transferContent]);
      expect(events.rows.map((r) => r.outcome)).toEqual(['TOPUP_EXCESS_RETURNED', 'DUPLICATE', 'TOPUP_RETURNED']);
    });

    it('wrong amount moves nothing; a new link replaces the old one', async () => {
      const nurse = await createNurse({ deposit: 100_000 });
      const first = await service.createTopupLink(nurse, 50_000);
      const second = await service.createTopupLink(nurse, 200_000);
      expect(await service.getTopupStatus(nurse, first.topupId)).toEqual({ status: 'FAILED' });
      expect(await pay(second.transferContent, 199_000, ref())).toMatchObject({ outcome: 'AMOUNT_MISMATCH' });
      expect(await depositOf(nurse)).toBe(100_000);
      expect(await pay(second.transferContent, 200_000, ref())).toMatchObject({ outcome: 'TOPUP_CREDITED' });
      expect(await depositOf(nurse)).toBe(300_000);
      await expect(service.getTopupStatus(await createNurse(), second.topupId)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('penalties, appeal, reversal (ADR-0004 D3)', () => {
    it('explained deduction → appeal within the window → upheld → PENALTY_REVERSAL, each exactly once', async () => {
      const nurse = await createNurse({ deposit: 300_000 });
      const booking = await createBooking(nurse, { status: 'CANCELLED' });
      const p = await tx((db) =>
        deductPenalty(db, { nurseId: nurse, bookingId: booking, reason: PenaltyReason.NURSE_LATE_CANCEL, amount: 60_000, slaRuleRef: 'SRS §5.2 row 7' }, Date.now()),
      );
      expect(p).not.toBeNull();
      expect(await tx((db) => deductPenalty(db, { nurseId: nurse, bookingId: booking, reason: PenaltyReason.NURSE_LATE_CANCEL, amount: 60_000, slaRuleRef: 'SRS §5.2 row 7' }, Date.now()))).toBeNull();
      expect(await depositOf(nurse)).toBe(240_000);

      const [listed] = await service.listPenalties(nurse);
      expect(listed).toMatchObject({ transactionId: p!.transactionId, amount: 60_000, reason: 'NURSE_LATE_CANCEL', slaRuleRef: 'SRS §5.2 row 7', bookingId: booking, reversed: false });
      expect(Math.abs(Date.parse(listed!.appealDeadline!) - (Date.now() + 3 * DAY))).toBeLessThan(5 * 60_000);

      const { disputeId } = await service.appealPenalty(nurse, p!.transactionId, { reason: 'Tôi đã báo hủy trước 13 tiếng, có tin nhắn làm bằng chứng.' });
      const d = (await pool.query(`SELECT reason_code, status::text, raised_by_id, booking_id FROM disputes WHERE id = $1`, [disputeId])).rows[0];
      expect(d).toEqual({ reason_code: 'PENALTY_APPEAL', status: 'OPEN', raised_by_id: nurse, booking_id: booking });
      await expect(service.appealPenalty(nurse, p!.transactionId, { reason: 'Kháng cáo lần thứ hai cho cùng khoản phạt.' })).rejects.toMatchObject({ status: 409, code: 'ALREADY_APPEALED' });
      await expect(service.appealPenalty(await createNurse(), p!.transactionId, { reason: 'Không phải khoản phạt của tôi đâu nhé.' })).rejects.toMatchObject({ status: 404 });

      const rev = await tx((db) => reversePenalty(db, { penaltyTransactionId: p!.transactionId, decidedBy: admin, note: 'Kháng cáo được chấp nhận' }));
      expect(rev).not.toBeNull();
      expect(await tx((db) => reversePenalty(db, { penaltyTransactionId: p!.transactionId, decidedBy: admin, note: 'lặp' }))).toBeNull();
      expect(await depositOf(nurse)).toBe(300_000);
      expect((await service.listPenalties(nurse))[0]).toMatchObject({ reversed: true, appealDisputeId: disputeId });
    });

    it('a dispute-decided penalty is not appealable; a closed window is refused; deposit may go into debt', async () => {
      const nurse = await createNurse({ deposit: 30_000 });
      const booking = await createBooking(nurse, { status: 'COMPLETED' });
      const dispute = (
        await pool.query(`INSERT INTO disputes (booking_id, raised_by_id, status) VALUES ($1, $2, 'RESOLVED_CUSTOMER') RETURNING id`, [booking, customer.id])
      ).rows[0].id;
      const upheld = await tx((db) =>
        deductPenalty(db, { nurseId: nurse, bookingId: booking, reason: PenaltyReason.DISPUTE_UPHELD, amount: 50_000, slaRuleRef: 'FR-DISP-01', disputeId: dispute, decidedBy: admin }, Date.now()),
      );
      expect(await depositOf(nurse)).toBe(-20_000);
      await expect(service.appealPenalty(nurse, upheld!.transactionId, { reason: 'Tôi không đồng ý với phán quyết tranh chấp.' })).rejects.toMatchObject({ code: 'NOT_APPEALABLE' });

      const old = await createBooking(nurse, { status: 'CANCELLED' });
      const late = await tx((db) =>
        deductPenalty(db, { nurseId: nurse, bookingId: old, reason: PenaltyReason.NURSE_NO_SHOW, amount: 50_000, slaRuleRef: 'SRS §5.2 row 8' }, Date.now() - 4 * DAY),
      );
      await expect(service.appealPenalty(nurse, late!.transactionId, { reason: 'Hôm đó tôi bị tai nạn trên đường đi làm.' })).rejects.toMatchObject({ code: 'APPEAL_WINDOW_CLOSED' });
      expect((await service.getStatus(nurse)).shortfall).toBe(370_000);
    });
  });

  describe('closure → refund', () => {
    it('needs a bank account; WAITING_HOLD until 7 days after the last check-out; cancel before READY', async () => {
      const nurse = await createNurse({ deposit: 300_000 });
      const booking = await createBooking(nurse, { status: 'COMPLETED', checkoutAt: new Date(Date.now() - 2 * DAY) });
      await expect(service.requestClosure(nurse)).rejects.toMatchObject({ status: 409, code: 'BANK_ACCOUNT_REQUIRED' });
      expect(await service.setBankAccount(nurse, { bank_name: 'Vietcombank', account_no: '0071006899', account_holder: 'NGUYEN THI LAN' })).toEqual({
        bankName: 'Vietcombank',
        accountMasked: '•••• 6899',
        accountHolder: 'NGUYEN THI LAN',
      });

      const waiting = await service.requestClosure(nurse);
      expect(waiting).toMatchObject({ status: 'WAITING_HOLD', pendingReasons: ['HOLD_DAYS'], refundAmount: null, debtAmount: 0, dueBy: null });
      expect(waiting.bankAccount.accountMasked).toBe('•••• 6899');
      expect(Math.abs(Date.parse(waiting.eligibleAt!) - (Date.now() + 5 * DAY))).toBeLessThan(5 * 60_000);
      expect(await service.getStatus(nurse)).toMatchObject({ canAcceptCash: false, canAcceptTransfer: false });
      await expect(service.requestClosure(nurse)).rejects.toMatchObject({ code: 'REFUND_REQUEST_EXISTS' });
      await expect(service.createTopupLink(nurse, 1)).rejects.toMatchObject({ code: 'ACCOUNT_CLOSING' });

      expect(await service.cancelRefundRequest(nurse, waiting.id)).toEqual({ success: true });
      expect(await service.getRefundRequest(nurse)).toBeNull();
      expect((await service.getStatus(nurse)).canAcceptCash).toBe(true);

      // Hold over → READY with a payout deadline in working days; no cancel any more.
      await pool.query(`UPDATE shift_logs SET checkout_time = $2 WHERE booking_id = $1`, [booking, new Date(Date.now() - 8 * DAY)]);
      const ready = await service.requestClosure(nurse);
      expect(ready).toMatchObject({ status: 'READY', pendingReasons: [], refundAmount: 300_000 });
      expect(Date.parse(ready.dueBy!)).toBeGreaterThanOrEqual(Date.now() + 5 * DAY);
      await expect(service.cancelRefundRequest(nurse, ready.id)).rejects.toMatchObject({ code: 'REFUND_NOT_CANCELLABLE' });

      // Admin pays it out: one DEPOSIT_REFUND with the custody reference.
      await resolveOpenMismatches();
      const paid = await service.payoutRefund(admin, ready.id, 'CUST-REFUND-1');
      expect(paid).toMatchObject({ status: 'REFUNDED', refundAmount: 300_000 });
      expect(await depositOf(nurse)).toBe(0);
      const refundTx = await pool.query(`SELECT tx_type::text, amount, external_ref FROM wallet_transactions WHERE idempotency_key = $1`, [`deposit-refund:${ready.id}`]);
      expect(refundTx.rows).toEqual([{ tx_type: 'DEPOSIT_REFUND', amount: '300000', external_ref: 'CUST-REFUND-1' }]);
      await expect(service.payoutRefund(admin, ready.id, null)).rejects.toMatchObject({ code: 'REFUND_NOT_READY' });
    });

    it('lists every pending condition; the Admin can reject with a written reason', async () => {
      const nurse = await createNurse({ deposit: 300_000 });
      await service.setBankAccount(nurse, { bank_name: 'ACB', account_no: '123456789', account_holder: 'TRAN VAN HUNG' });
      await createBooking(nurse, { status: 'CONFIRMED' });
      await createBooking(nurse, { status: 'COMPLETED', payment: 'CASH', commissionDueAt: new Date(Date.now() + HOUR) });
      const disputed = await createBooking(nurse, { status: 'COMPLETED' });
      await pool.query(`INSERT INTO disputes (booking_id, raised_by_id) VALUES ($1, $2)`, [disputed, customer.id]);

      const r = await service.requestClosure(nurse);
      expect(r.status).toBe('WAITING_HOLD');
      expect(r.pendingReasons).toEqual(['ACTIVE_BOOKING', 'OPEN_DISPUTE', 'UNPAID_COMMISSION']);
      expect((await service.runRefundEligibilitySweep()).failed).toBe(0);

      await expect(service.rejectRefund(admin, r.id, 'sai')).rejects.toMatchObject({ status: 400 });
      const rejected = await service.rejectRefund(admin, r.id, 'Tên chủ tài khoản không khớp CCCD');
      expect(rejected).toMatchObject({ status: 'REJECTED', rejectReason: 'Tên chủ tài khoản không khớp CCCD' });
      expect(await depositOf(nurse)).toBe(300_000); // never forfeited
    });
  });

  describe('daily reconciliation (ADR-0004 D1)', () => {
    it('a deposit that does not match its ledger → MISMATCH and payouts frozen until resolved', async () => {
      await resolveOpenMismatches(); // stale rows of an earlier, interrupted run
      const nurse = await createNurse();
      await pool.query(`UPDATE wallets SET deposit_balance = 12345 WHERE user_id = $1`, [nurse]); // money with no ledger row

      const r = await service.runReconciliation();
      expect(r.status).toBe('MISMATCH');
      expect(r.mismatchedWallets).toBeGreaterThanOrEqual(1);
      await expect(service.payoutRefund(admin, randomUUID(), null)).rejects.toMatchObject({ code: 'RECONCILIATION_MISMATCH' });

      await expect(service.resolveReconciliation(admin, r.runDate, 'ngắn')).rejects.toMatchObject({ status: 400 });
      await service.resolveReconciliation(admin, r.runDate, 'Ví thử nghiệm sửa tay trong integration test');
      await expect(service.payoutRefund(admin, randomUUID(), null)).rejects.toMatchObject({ code: 'REFUND_REQUEST_NOT_FOUND' });

      await pool.query(`UPDATE wallets SET deposit_balance = 0 WHERE user_id = $1`, [nurse]); // leave the DB consistent
    });
  });
});
