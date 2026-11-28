import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PenaltyReason, TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { CashCommissionService } from '../../src/modules/cash-commission/cash-commission.service';
import { deductPenalty, reversePenalty } from '../../src/modules/deposits/deposits.ledger';
import { DepositsService } from '../../src/modules/deposits/deposits.service';
import { DisputesService } from '../../src/modules/disputes/disputes.service';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { signData } from '../../src/modules/gateway-webhooks/gateway-webhooks.policy';
import { GatewayWebhooksService } from '../../src/modules/gateway-webhooks/gateway-webhooks.service';
import { settleShift } from '../../src/modules/settlements/settlements.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WithdrawalsService } from '../../src/modules/withdrawals/withdrawals.service';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * Phase 8 (BE-3) — tương tranh trên tiền, PostgreSQL 16 thật. Mỗi kịch bản bắn nhiều giao dịch CÙNG LÚC rồi kiểm
 * bất biến trong DB (không chỉ kết quả trả về), và luôn kiểm số dư ví = tổng sổ cái của ví đó:
 *  1. cùng 1 webhook escrow giao lại 8 lần song song → giữ tiền đúng 1 lần (7 DUPLICATE)
 *  2. khách chuyển 2 lần (2 mã giao dịch) cùng lúc → 1 HELD, 1 hoàn lại; escrow của ca = đúng giá ca
 *  3. webhook hoa hồng tiền mặt "HH…" trùng + chuyển dư cùng lúc → đúng 1 COMMISSION_PAYMENT, ca SETTLED
 *  4. quyết toán 1 ca 6 lần song song (job quét chạy trùng + khách xác nhận) → 1 dòng settlements, trả 1 lần
 *  5. 10 lệnh rút 60.000 song song trên ví 300.000 → đúng 5 thành công, ví về 0, không bao giờ âm
 *  6. trừ phạt cùng idempotency key 4 lần + hoàn phạt 4 lần song song → mỗi việc đúng 1 dòng sổ cái
 *  7. Admin duyệt và từ chối 1 lệnh rút cùng lúc → 1 bên thắng, tiền không bị trả 2 lần, 1 dòng audit
 *  8. 3 Admin phân xử 1 khiếu nại cùng lúc → 1 kết quả, hoàn escrow 1 lần, 1 dòng audit
 */
describe('finance concurrency (integration)', () => {
  let pool: Pool;
  let admin: string;
  let serviceId: string;
  let customer: { id: string; profile: string };
  let webhooks: GatewayWebhooksService;
  let withdrawals: WithdrawalsService;
  let deposits: DepositsService;
  let commission: CashCommissionService;
  let disputes: DisputesService;
  const HOUR = 3_600_000;
  const SECRET = 'integration-concurrency-secret';
  const ACCOUNT = { bankBin: '970422', bankName: 'MB Bank (sandbox)', accountNumber: '0000000000', accountName: 'CARENEST' };
  const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };
  let slot = 0;

  const webhook = (orderCode: string, amount: number, reference: string) => {
    const data = { orderCode, amount, reference, description: orderCode, transactionDateTime: new Date().toISOString() };
    return { code: '00', desc: 'success', success: true, data, signature: signData(data, SECRET) };
  };
  const all = <T>(n: number, fn: (i: number) => Promise<T>) => Promise.allSettled(Array.from({ length: n }, (_, i) => fn(i)));
  const ok = <T>(r: PromiseSettledResult<T>[]) => r.filter((x): x is PromiseFulfilledResult<T> => x.status === 'fulfilled').map((x) => x.value);
  const failed = (r: PromiseSettledResult<unknown>[]) => r.filter((x): x is PromiseRejectedResult => x.status === 'rejected').map((x) => x.reason);

  async function nurse(available = 0, deposit = 300_000): Promise<string> {
    const phone = `04${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query("INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng tải cao', 'NURSE', 'ACTIVE') RETURNING id", [phone]);
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await withTransaction(async (db) => {
      if (deposit > 0) await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: deposit, idempotencyKey: `test-cc:${randomUUID()}`, externalRef: 'T' });
      if (available > 0) await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: available, idempotencyKey: `test-cc:${randomUUID()}`, externalRef: null });
    });
    await deposits.setBankAccount(id, { bank_name: 'Vietcombank', account_no: '0071006899', account_holder: 'PHAM VAN AN' });
    return id;
  }

  /** A booking in the given state; for a finished transfer shift the escrow is held and the check-out was 30 h ago. */
  async function booking(o: { nurseId?: string | null; draft?: boolean; cash?: boolean }): Promise<{ id: string; code: string }> {
    const start = o.draft ? Date.now() + 48 * HOUR + slot * 5 * HOUR : Date.now() - 40 * HOUR - slot * 5 * HOUR;
    slot += 1;
    const code = `HC-C${randomUUID().slice(0, 10).toUpperCase()}`;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method, start_time, end_time,
          base_amount, platform_fee, total_amount, execution_status, payment_status, hold_expires_at, commission_due_at)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 500000, 75000, 500000,
               $9::execution_status_enum, $10::payment_status_enum, $11, $12)
       RETURNING id`,
      [
        code,
        customer.id,
        customer.profile,
        o.nurseId ?? null,
        serviceId,
        o.cash ? 'CASH' : 'BANK_TRANSFER',
        new Date(start),
        new Date(start + 4 * HOUR),
        o.draft ? 'DRAFT' : 'COMPLETED',
        o.cash || o.draft ? 'UNPAID' : 'ESCROW_HELD',
        o.draft ? new Date(Date.now() + 15 * 60_000) : null,
        o.cash ? new Date(Date.now() + 24 * HOUR) : null,
      ],
    );
    const id: string = rows[0].id;
    if (!o.draft && !o.cash) {
      await withTransaction((db) => holdEscrow(db, { customerId: customer.id, bookingId: id, amount: 500_000, idempotencyKey: `escrow-hold:test-${id}`, externalRef: 'FT' }));
    }
    if (!o.draft) await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, now() - interval '30 hours')`, [id, new Date(start)]);
    return { id, code };
  }

  /** Every balance of the wallet equals the sum of its completed ledger rows. */
  async function expectWalletMatchesLedger(userId: string): Promise<void> {
    const { rows } = await pool.query(
      `SELECT w.available_balance::bigint::text AS a, w.escrow_locked_balance::bigint::text AS e, w.deposit_balance::bigint::text AS d,
              COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'AVAILABLE'), 0)::text AS la,
              COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'ESCROW_LOCKED'), 0)::text AS le,
              COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'DEPOSIT'), 0)::text AS ld
         FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id = w.id AND t.status = 'COMPLETED'
        WHERE w.user_id = $1 GROUP BY w.id`,
      [userId],
    );
    const r = rows[0];
    expect({ available: r.a, escrow: r.e, deposit: r.d }).toEqual({ available: r.la, escrow: r.le, deposit: r.ld });
  }

  const ledgerCount = async (bookingId: string, txType: string) =>
    (await pool.query(`SELECT count(*)::int AS n FROM wallet_transactions WHERE booking_id = $1 AND tx_type = $2::tx_type_enum`, [bookingId, txType])).rows[0].n;

  beforeAll(async () => {
    pool = createTestPool();
    admin = await findOrCreateAdmin(pool);
    deposits = new DepositsService({ ...deps, custodyAccount: () => null });
    withdrawals = new WithdrawalsService(deps);
    commission = new CashCommissionService({ ...deps, receivingAccount: () => ACCOUNT });
    disputes = new DisputesService(deps);
    webhooks = new GatewayWebhooksService({ read: pool, withTx: deps.withTx, secret: () => SECRET, receivingAccount: () => ACCOUNT, startRadar: async () => {} });
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Đỗ Thị Hoa', '1948-03-03', 48, 'NORMAL', '20 Lý Thường Kiệt', 'HOME', 10.77, 106.69, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('1. the same escrow webhook delivered 8 times at once books the money once', async () => {
    const b = await booking({ draft: true });
    const r = await all(8, () => webhooks.handleEscrowWebhook(webhook(b.code, 500_000, `FT-DUP-${b.id.slice(0, 8)}`)));
    expect(failed(r)).toEqual([]);
    expect(ok(r).map((x) => x.outcome).sort()).toEqual(['DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'DUPLICATE', 'HELD']);
    expect(await ledgerCount(b.id, 'ESCROW_HOLD')).toBe(1);
    expect((await pool.query(`SELECT payment_status::text AS p FROM bookings WHERE id = $1`, [b.id])).rows[0].p).toBe('ESCROW_HELD');
    expect((await pool.query(`SELECT count(*)::int AS n FROM payment_webhook_events WHERE booking_id = $1`, [b.id])).rows[0].n).toBe(8);
    await expectWalletMatchesLedger(customer.id);
  }, 30_000);

  it('2. two different payments for one booking at once: one held, the other refunded in full', async () => {
    const b = await booking({ draft: true });
    const r = await all(2, (i) => webhooks.handleEscrowWebhook(webhook(b.code, 500_000, `FT-TWO-${i}-${b.id.slice(0, 8)}`)));
    expect(ok(r).map((x) => x.outcome).sort()).toEqual(['EXTRA_PAYMENT_REFUNDED', 'HELD']);
    const held = await pool.query(
      `SELECT COALESCE(sum(balance_after - balance_before), 0)::int AS held FROM wallet_transactions WHERE booking_id = $1 AND balance_type = 'ESCROW_LOCKED'`,
      [b.id],
    );
    expect(held.rows[0].held).toBe(500_000);
    await expectWalletMatchesLedger(customer.id);
  }, 30_000);

  it('3. cash commission: duplicate "HH" webhooks + a second transfer at once → one COMMISSION_PAYMENT, booking SETTLED', async () => {
    const n = await nurse();
    const b = await booking({ nurseId: n, cash: true });
    const link = await commission.createPaymentLink(n, b.id);
    const sameRef = `FT-HH-${b.id.slice(0, 8)}`;
    const r = await all(6, (i) => webhooks.handleEscrowWebhook(webhook(link.transferContent, 75_000, i < 5 ? sameRef : `FT-HH2-${b.id.slice(0, 8)}`)));
    expect(failed(r)).toEqual([]);
    const outcomes = ok(r).map((x) => x.outcome);
    expect(outcomes.filter((o) => o === 'COMMISSION_PAID')).toHaveLength(1);
    expect(outcomes.every((o) => ['COMMISSION_PAID', 'DUPLICATE', 'COMMISSION_RETURNED'].includes(o))).toBe(true);
    expect(await ledgerCount(b.id, 'COMMISSION_PAYMENT')).toBe(1);
    expect((await pool.query(`SELECT settled_at IS NOT NULL AS s FROM bookings WHERE id = $1`, [b.id])).rows[0].s).toBe(true);
    await expectWalletMatchesLedger(n);
  }, 30_000);

  it('4. one shift settled 6 times at once (sweep re-run + customer confirm) is paid once', async () => {
    const n = await nurse();
    const b = await booking({ nurseId: n });
    const r = await all(6, (i) => withTransaction((db) => settleShift(db, b.id, i % 2 ? 'CUSTOMER_CONFIRMED' : 'COOLING_ELAPSED', Date.now())));
    expect(failed(r)).toEqual([]);
    expect(ok(r).filter((x) => x.settled)).toHaveLength(1);
    expect((await pool.query(`SELECT count(*)::int AS n FROM settlements WHERE booking_id = $1`, [b.id])).rows[0].n).toBe(1);
    expect(await ledgerCount(b.id, 'ESCROW_RELEASE')).toBe(2); // customer escrow out + nurse available in, once each
    expect((await pool.query(`SELECT available_balance::int AS a FROM wallets WHERE user_id = $1`, [n])).rows[0].a).toBe(425_000);
    await expectWalletMatchesLedger(n);
    await expectWalletMatchesLedger(customer.id);
  }, 30_000);

  it('5. 10 withdrawals of 60,000 at once on 300,000: exactly 5 pass, the balance ends at 0, never below', async () => {
    const n = await nurse(300_000);
    const r = await all(10, () => withdrawals.requestWithdrawal(n, 60_000));
    expect(ok(r)).toHaveLength(5);
    expect(failed(r).map((e) => e.code)).toEqual(Array(5).fill('INSUFFICIENT_BALANCE'));
    expect((await pool.query(`SELECT available_balance::int AS a, deposit_balance::int AS d FROM wallets WHERE user_id = $1`, [n])).rows[0]).toEqual({ a: 0, d: 300_000 });
    await expectWalletMatchesLedger(n);
  }, 30_000);

  it('6. the same penalty (same key) 4 times and its reversal 4 times at once → one row each', async () => {
    const n = await nurse();
    const b = await booking({ nurseId: n });
    const key = `deposit-penalty:TEST:${b.id}`;
    const p = await all(4, () =>
      withTransaction((db) =>
        deductPenalty(db, { nurseId: n, bookingId: b.id, reason: PenaltyReason.NURSE_LATE_CANCEL, amount: 100_000, slaRuleRef: 'SRS §5.2 row 7', idempotencyKey: key }, Date.now()),
      ),
    );
    expect(failed(p)).toEqual([]);
    const posted = ok(p).filter((x) => x !== null);
    expect(posted).toHaveLength(1);
    const rev = await all(4, () => withTransaction((db) => reversePenalty(db, { penaltyTransactionId: posted[0]!.transactionId, decidedBy: admin, note: 'Kháng cáo hợp lệ (test tương tranh)' })));
    expect(failed(rev)).toEqual([]);
    expect(ok(rev).filter((x) => x !== null)).toHaveLength(1);
    expect(await ledgerCount(b.id, 'PENALTY_DEDUCT')).toBe(1);
    expect(await ledgerCount(b.id, 'PENALTY_REVERSAL')).toBe(1);
    expect((await pool.query(`SELECT deposit_balance::int AS d FROM wallets WHERE user_id = $1`, [n])).rows[0].d).toBe(300_000);
    await expectWalletMatchesLedger(n);
  }, 30_000);

  it('7. two Admins approve and reject the same withdrawal at once: one wins, the money moves once, one audit row', async () => {
    const n = await nurse(200_000);
    const w = await withdrawals.requestWithdrawal(n, 150_000);
    const r = await Promise.allSettled([
      withdrawals.markWithdrawn(admin, w.id, 'VCB-RACE'),
      withdrawals.reject(admin, w.id, 'Sai tên chủ tài khoản (test tương tranh)'),
      withdrawals.markWithdrawn(admin, w.id, 'VCB-RACE-2'),
    ]);
    expect(ok(r)).toHaveLength(1);
    expect(failed(r).map((e) => e.code)).toEqual(['WITHDRAWAL_CLOSED', 'WITHDRAWAL_CLOSED']);
    const refunds = (await pool.query(`SELECT count(*)::int AS n FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id WHERE w.user_id = $1 AND t.tx_type = 'REFUND'`, [n])).rows[0].n;
    expect(refunds).toBe(ok(r)[0].status === 'REJECTED' ? 1 : 0);
    expect((await pool.query(`SELECT count(*)::int AS n FROM audit_logs WHERE target_id = $1`, [w.id])).rows[0].n).toBe(1);
    await expectWalletMatchesLedger(n);
  }, 30_000);

  it('8. three Admins resolve the same dispute at once: one decision, the escrow refunded once, one audit row', async () => {
    const n = await nurse();
    const b = await booking({ nurseId: n });
    await pool.query(`UPDATE shift_logs SET checkout_time = now() - interval '2 hours' WHERE booking_id = $1`, [b.id]); // inside the 24 h window
    const { dispute_id } = await disputes.open(customer.id, b.id, { category: 'UNPROFESSIONAL_CONDUCT', description: 'Khiếu nại kiểm thử tương tranh.', evidenceKeys: [] });
    const r = await all(3, (i) =>
      disputes.resolve(admin, dispute_id, { resolution: i === 1 ? 'RESOLVED_NURSE' : 'RESOLVED_CUSTOMER', notes: 'Phân xử song song trong kiểm thử.' }),
    );
    expect(ok(r)).toHaveLength(1);
    expect(failed(r).map((e) => e.code)).toEqual(['DISPUTE_CLOSED', 'DISPUTE_CLOSED']);
    const outcome = ok(r)[0].outcome;
    expect(await ledgerCount(b.id, 'REFUND')).toBe(outcome === 'RESOLVED_CUSTOMER' ? 1 : 0);
    expect((await pool.query(`SELECT count(*)::int AS n FROM settlements WHERE booking_id = $1`, [b.id])).rows[0].n).toBe(outcome === 'RESOLVED_NURSE' ? 1 : 0);
    expect((await pool.query(`SELECT count(*)::int AS n FROM audit_logs WHERE target_id = $1 AND action_type = 'RESOLVE_DISPUTE'`, [dispute_id])).rows[0].n).toBe(1);
    await expectWalletMatchesLedger(n);
    await expectWalletMatchesLedger(customer.id);
  }, 30_000);
});
