import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { AdminFinanceService } from '../../src/modules/admin-finance/admin-finance.service';
import type { FinancialReconDto } from '../../src/modules/admin-finance/admin-finance.types';
import { DepositsService } from '../../src/modules/deposits/deposits.service';
import { holdEscrow } from '../../src/modules/gateway-webhooks/gateway-webhooks.ledger';
import { SettlementsService, settleShift } from '../../src/modules/settlements/settlements.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WithdrawalsService } from '../../src/modules/withdrawals/withdrawals.service';
import { createTestPool, createTestUser, findOrCreateAdmin } from './helpers';

/**
 * admin-finance (BE-3 · Phase 7 · FR-ADMIN-01 · CT-15) trên PostgreSQL 16 thật (migration 0001 → 0029).
 * DB dev dùng chung nên các con số tổng được kiểm bằng CHÊNH LỆCH trước / sau thao tác của chính test:
 *  - escrow nhận vào, đang giữ, hoa hồng 15% (chuyển khoản), chi trả cho điều dưỡng, giữ lại bù ký quỹ;
 *  - hàng chờ rút tiền: duyệt → WITHDRAWN, từ chối → tiền về ví; mỗi thao tác 1 dòng audit_logs;
 *  - hoàn ký quỹ, giữ đối soát, nợ của điều dưỡng; xuất CSV sổ cái có audit; kỳ báo cáo sai → 400.
 */
describe('admin-finance (integration)', () => {
  let pool: Pool;
  let admin: string;
  let finance: AdminFinanceService;
  let deposits: DepositsService;
  let withdrawals: WithdrawalsService;
  let serviceId: string;
  let customer: { id: string; profile: string };
  const HOUR = 3_600_000;
  const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };
  const today = () => new Date(Date.now() + 7 * HOUR).toISOString().slice(0, 10);
  const report = () => finance.reconciliation(today(), today());
  const gap = (r: FinancialReconDto) => r.checks.map((c) => c.walletsTotal - c.ledgerTotal);

  async function nurse(opts: { available?: number; deposit?: number } = {}): Promise<string> {
    const phone = `03${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng đối soát', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await withTransaction(async (db) => {
      const deposit = opts.deposit ?? 300_000;
      if (deposit > 0) {
        await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: deposit, idempotencyKey: `test-af:${randomUUID()}`, externalRef: 'T' });
      }
      if (opts.available) {
        await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: opts.available, idempotencyKey: `test-af:${randomUUID()}`, externalRef: null });
      }
    });
    await deposits.setBankAccount(id, { bank_name: 'Vietcombank', account_no: '0071006899', account_holder: 'TRAN THI MAI' });
    return id;
  }

  async function shift(nurseId: string, o: { cash?: boolean; dueHoursAgo?: number } = {}): Promise<string> {
    const start = Date.now() - 40 * HOUR - Math.floor(Math.random() * 1000) * 5 * HOUR;
    const { rows } = await pool.query(
      `INSERT INTO bookings
         (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
          start_time, end_time, base_amount, platform_fee, total_amount, execution_status, payment_status, commission_due_at)
       VALUES ($1, $2, $3, $4, $5, 'JOB_BOARD', $6::payment_method_enum, $7, $8, 500000, 75000, 500000, 'COMPLETED',
               $9::payment_status_enum, $10)
       RETURNING id`,
      [
        `HC-F${randomUUID().slice(0, 10)}`,
        customer.id,
        customer.profile,
        nurseId,
        serviceId,
        o.cash ? 'CASH' : 'BANK_TRANSFER',
        new Date(start),
        new Date(start + 4 * HOUR),
        o.cash ? 'UNPAID' : 'ESCROW_HELD',
        o.cash ? new Date(Date.now() - (o.dueHoursAgo ?? -24) * HOUR) : null,
      ],
    );
    const id: string = rows[0].id;
    if (!o.cash) await withTransaction((db) => holdEscrow(db, { customerId: customer.id, bookingId: id, amount: 500_000, idempotencyKey: `escrow-hold:test-${id}`, externalRef: 'FT' }));
    await pool.query(`INSERT INTO shift_logs (booking_id, checkin_time, checkout_time) VALUES ($1, $2, now() - interval '30 hours')`, [id, new Date(start)]);
    return id;
  }

  const auditOf = async (targetId: string) =>
    (await pool.query(`SELECT action_type::text AS a, actor_id, new_value FROM audit_logs WHERE target_id = $1 ORDER BY created_at`, [targetId])).rows;

  beforeAll(async () => {
    pool = createTestPool();
    admin = await findOrCreateAdmin(pool);
    deposits = new DepositsService({ ...deps, custodyAccount: () => null });
    withdrawals = new WithdrawalsService(deps);
    finance = new AdminFinanceService({ read: { query }, withdrawals, deposits, settlements: new SettlementsService(deps) });
    serviceId = (await pool.query(`SELECT id FROM service_categories WHERE code = 'SRV_WOUND_CARE'`)).rows[0].id;
    const id = await createTestUser(pool);
    const p = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Lê Văn Tám', '1950-05-05', 55, 'NORMAL', '12 Trần Phú', 'HOME', 16.07, 108.22, TRUE, now()) RETURNING id`,
      [id],
    );
    customer = { id, profile: p.rows[0].id };
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('CT-15: escrow received / held, 15% commission, payouts and the deposit part withheld move exactly with a settled shift', async () => {
    const before = await report();
    const n = await nurse({ deposit: 0 }); // grace nurse: part of the payout fills the deposit (ADR-0004)
    const b = await shift(n);
    const mid = await report();
    expect(mid.escrow_received - before.escrow_received).toBe(500_000);
    expect(mid.total_escrow_held - before.total_escrow_held).toBe(500_000);

    const s = await withTransaction((db) => settleShift(db, b, 'COOLING_ELAPSED', Date.now()));
    expect(s.settled).toBe(true);
    const after = await report();
    expect(after.total_escrow_held - before.total_escrow_held).toBe(0);
    expect(after.total_commission_collected - before.total_commission_collected).toBe(75_000);
    expect(after.commission_transfer - before.commission_transfer).toBe(75_000);
    const withheld = after.deposit_withheld - before.deposit_withheld;
    expect(withheld).toBeGreaterThan(0);
    expect(after.total_payouts - before.total_payouts + withheld).toBe(425_000);
    expect(gap(after)).toEqual(gap(before)); // our movements keep wallets and ledger in step
    expect(after.checks.map((c) => c.name)).toEqual(['ESCROW_LEDGER', 'AVAILABLE_LEDGER', 'DEPOSIT_LEDGER']);
  });

  it('withdrawal queue: approve → WITHDRAWN, reject → money back; pending total, paid total and one audit row each', async () => {
    const before = await report();
    const n = await nurse({ available: 500_000 });
    const a = await withdrawals.requestWithdrawal(n, 200_000);
    const c = await withdrawals.requestWithdrawal(n, 100_000);
    const mid = await report();
    expect(mid.pending_withdrawals - before.pending_withdrawals).toBe(300_000);
    expect(mid.pending_withdrawals_count - before.pending_withdrawals_count).toBe(2);
    const queued = (await finance.listWithdrawals()).filter((w) => w.nurseId === n);
    expect(queued.map((w) => [w.amount, w.bankAccountNo, w.accountHolder])).toEqual([
      [200_000, '0071006899', 'TRAN THI MAI'],
      [100_000, '0071006899', 'TRAN THI MAI'],
    ]);

    expect(await finance.approveWithdrawal(admin, a.id, 'VCB-FT-9001', '10.0.0.5')).toMatchObject({ status: 'WITHDRAWN' });
    await expect(finance.rejectWithdrawal(admin, c.id, 'ngắn')).rejects.toMatchObject({ status: 400 });
    expect(await finance.rejectWithdrawal(admin, c.id, 'Chủ tài khoản không khớp hồ sơ')).toMatchObject({ status: 'REJECTED' });
    await expect(finance.approveWithdrawal(admin, c.id, null)).rejects.toMatchObject({ code: 'WITHDRAWAL_CLOSED' });

    const after = await report();
    expect(after.pending_withdrawals - before.pending_withdrawals).toBe(0);
    expect(after.withdrawals_paid - before.withdrawals_paid).toBe(200_000);
    expect((await pool.query(`SELECT available_balance::int AS a FROM wallets WHERE user_id = $1`, [n])).rows[0].a).toBe(300_000);
    expect(await auditOf(a.id)).toEqual([
      { a: 'PROCESS_WITHDRAWAL', actor_id: admin, new_value: expect.objectContaining({ status: 'WITHDRAWN', amount: 200_000, payoutRef: 'VCB-FT-9001' }) },
    ]);
    expect(await auditOf(c.id)).toEqual([
      { a: 'PROCESS_WITHDRAWAL', actor_id: admin, new_value: expect.objectContaining({ status: 'REJECTED', reason: 'Chủ tài khoản không khớp hồ sơ' }) },
    ]);
    expect(gap(after)).toEqual(gap(before));
  });

  it('nurse debts: deposit below zero and unpaid / overdue cash commission; outstanding totals follow', async () => {
    const before = await report();
    const n = await nurse({ deposit: 300_000 });
    await withTransaction((db) =>
      postNurseEntry(db, { userId: n, bookingId: null, txType: TxType.PENALTY_DEDUCT, balance: 'DEPOSIT', delta: -350_000, idempotencyKey: `test-af:${randomUUID()}`, externalRef: null }),
    );
    await shift(n, { cash: true, dueHoursAgo: 2 }); // overdue
    await shift(n, { cash: true, dueHoursAgo: -10 }); // due in 10 h
    const after = await report();
    expect(after.nurse_deposit_debt - before.nurse_deposit_debt).toBe(50_000);
    expect(after.cash_commission_unpaid - before.cash_commission_unpaid).toBe(150_000);
    expect(after.cash_commission_overdue - before.cash_commission_overdue).toBe(75_000);
    expect(after.deposit_penalties - before.deposit_penalties).toBe(350_000);
    expect((await finance.listNurseDebts()).find((d) => d.nurseId === n)).toMatchObject({
      depositBalance: -50_000,
      depositDebt: 50_000,
      unpaidCommission: 150_000,
      overdueCommission: 75_000,
      unpaidCashBookings: 2,
    });
  });

  it('deposit refund queue (READY → payout, audited); reconciliation and settlement holds resolved with a note, audited', async () => {
    const n = await nurse({ deposit: 300_000 });
    const req = await deposits.requestClosure(n); // evaluated at once: nothing pending → READY
    expect(req.status).toBe('READY');
    expect((await finance.listDepositRefunds('READY')).find((r) => r.id === req.id)).toMatchObject({ nurseId: n, refundAmount: 300_000, bankAccountNo: '0071006899' });
    const before = await report();
    await pool.query(`UPDATE deposit_reconciliations SET resolved_at = now(), resolved_by = $1, resolution_note = 'test: clear older mismatches' WHERE status = 'MISMATCH' AND resolved_at IS NULL`, [admin]);
    expect(await finance.payoutDepositRefund(admin, req.id, 'CUSTODY-REF-1')).toMatchObject({ status: 'REFUNDED' });
    expect((await report()).deposit_refunds_paid - before.deposit_refunds_paid).toBe(300_000);
    expect((await auditOf(req.id))[0]).toMatchObject({ a: 'PROCESS_DEPOSIT_REFUND', new_value: expect.objectContaining({ status: 'REFUNDED', amount: 300_000 }) });

    // A reconciliation mismatch (a past date the daily job will never touch) and a settlement hold.
    const runDate = `19${String(10 + Math.floor(Math.random() * 89))}-0${1 + Math.floor(Math.random() * 9)}-1${Math.floor(Math.random() * 9)}`;
    const run = await pool.query(
      `INSERT INTO deposit_reconciliations (run_date, wallets_total, ledger_total, custody_total, mismatched_wallets, status)
       VALUES ($1, 1, 0, 0, 1, 'MISMATCH') ON CONFLICT (run_date) DO UPDATE SET resolved_at = NULL, resolved_by = NULL, resolution_note = NULL, status = 'MISMATCH'
       RETURNING id`,
      [runDate],
    );
    expect((await finance.listReconciliations()).length).toBeGreaterThan(0);
    await expect(finance.resolveReconciliation(admin, runDate, 'ngắn')).rejects.toMatchObject({ status: 400 });
    expect(await finance.resolveReconciliation(admin, runDate, 'Sao kê đối tác về trễ một ngày, đã khớp lại.')).toEqual({ resolved: true });
    await expect(finance.resolveReconciliation(admin, runDate, 'Giải quyết lần thứ hai cho cùng ngày.')).rejects.toMatchObject({ status: 404 });
    expect((await auditOf(run.rows[0].id))[0]).toMatchObject({ a: 'RESOLVE_FINANCE_HOLD', actor_id: admin });

    const held = await shift(n);
    await pool.query(`INSERT INTO settlement_holds (booking_id, reason) VALUES ($1, 'test: escrow mismatch')`, [held]);
    expect((await finance.listSettlementHolds()).map((h) => h.bookingId)).toContain(held);
    expect(await finance.resolveSettlementHold(admin, held, 'Đã đối chiếu sao kê, escrow đúng.')).toEqual({ resolved: true });
    expect((await finance.listSettlementHolds()).map((h) => h.bookingId)).not.toContain(held);
    expect((await auditOf(held)).map((r) => r.a)).toEqual(['RESOLVE_FINANCE_HOLD']);
  });

  it('ledger export: CSV of the period with signed amounts, audited; bad periods → 400', async () => {
    const n = await nurse({ available: 123_456 });
    const out = await finance.exportLedger(admin, today(), today(), '10.0.0.9');
    expect(out.filename).toBe(`ledger_${today()}_${today()}.csv`);
    expect(out.csv.startsWith('﻿created_at,tx_type,balance_type,status,signed_amount')).toBe(true);
    expect(out.csv).toContain(`,ESCROW_RELEASE,AVAILABLE,COMPLETED,123456,0,123456,${n},NURSE,`);
    const audit = await pool.query(
      `SELECT new_value, ip_address FROM audit_logs WHERE action_type = 'EXPORT_FINANCE_REPORT' AND actor_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [admin],
    );
    expect(audit.rows[0]).toMatchObject({ ip_address: '10.0.0.9', new_value: { from: today(), to: today(), rows: out.rows } });

    await expect(finance.reconciliation('2026-02-30', today())).rejects.toMatchObject({ status: 400, code: 'INVALID_PERIOD' });
    await expect(finance.reconciliation(today(), '2020-01-01')).rejects.toMatchObject({ status: 400 });
    await expect(finance.reconciliation('2020-01-01', today())).rejects.toMatchObject({ status: 400 }); // > 366 days
  });
});
