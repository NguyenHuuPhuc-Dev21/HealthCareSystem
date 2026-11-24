import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { TxType } from '@healthcare-system/shared';
import { closePool, query, withTransaction, type Queryable } from '../../src/core/database';
import { DepositsService } from '../../src/modules/deposits/deposits.service';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { WalletsLedgerService } from '../../src/modules/wallets-ledger/wallets-ledger.service';
import { WithdrawalsService } from '../../src/modules/withdrawals/withdrawals.service';
import { createTestPool, findOrCreateAdmin } from './helpers';

/**
 * withdrawals (BE-3 · Phase 5 · FR-PAY-04) trên PostgreSQL 16 thật (migration 0001 → 0020):
 *  - rút tiền trừ ngay ví khả dụng (WITHDRAW), vượt số dư → 400, cần tài khoản ngân hàng;
 *  - gửi lại cùng Idempotency-Key → cùng một yêu cầu, không trừ 2 lần; 2 yêu cầu song song không làm âm ví;
 *  - Admin: đã chuyển → WITHDRAWN; từ chối (có lý do) → REJECTED + tiền về lại ví (1 dòng REFUND);
 *  - ký quỹ không bao giờ bị đụng.
 */
describe('withdrawals (integration)', () => {
  let pool: Pool;
  let service: WithdrawalsService;
  let deposits: DepositsService;
  let wallets: WalletsLedgerService;
  let admin: string;
  const deps = { read: { query }, withTx: <T>(fn: (db: Queryable) => Promise<T>) => withTransaction((c) => fn(c)) };

  async function nurseWith(available: number, bank = true): Promise<string> {
    const phone = `02${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng rút tiền', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id: string = rows[0].id;
    await pool.query(`INSERT INTO nurse_profiles (user_id, tier, profile_status) VALUES ($1, 'TIER_1_BASIC', 'ACTIVE')`, [id]);
    await withTransaction(async (db) => {
      await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.TOPUP, balance: 'DEPOSIT', delta: 300_000, idempotencyKey: `test-wd:${randomUUID()}`, externalRef: 'T' });
      if (available > 0) {
        await postNurseEntry(db, { userId: id, bookingId: null, txType: TxType.ESCROW_RELEASE, balance: 'AVAILABLE', delta: available, idempotencyKey: `test-wd:${randomUUID()}`, externalRef: null });
      }
    });
    if (bank) await deposits.setBankAccount(id, { bank_name: 'Vietcombank', account_no: '0071006899', account_holder: 'NGUYEN THI LAN' });
    return id;
  }

  const balances = async (id: string) =>
    (await pool.query(`SELECT available_balance::int AS a, deposit_balance::int AS d FROM wallets WHERE user_id = $1`, [id])).rows[0];

  beforeAll(async () => {
    pool = createTestPool();
    service = new WithdrawalsService(deps);
    deposits = new DepositsService({ ...deps, custodyAccount: () => null });
    wallets = new WalletsLedgerService(deps);
    admin = await findOrCreateAdmin(pool);
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('takes the money from available at once; same Idempotency-Key → same withdrawal, taken once', async () => {
    const nurse = await nurseWith(500_000);
    const key = `k-${randomUUID().slice(0, 12)}`;
    const r = await service.requestWithdrawal(nurse, 200_000, key);
    expect(r).toMatchObject({ withdrawal_id: r.id, amount: 200_000, status: 'WITHDRAW_REQUESTED' });
    expect(await service.requestWithdrawal(nurse, 200_000, key)).toEqual(r);
    expect(await balances(nurse)).toEqual({ a: 300_000, d: 300_000 });

    const [listed] = await service.listWithdrawals(nurse);
    expect(listed).toMatchObject({ id: r.id, amount: 200_000, status: 'WITHDRAW_REQUESTED' });
    const tx = await wallets.listTransactions(nurse, { type: 'WITHDRAW' });
    expect(tx.items.map((t) => t.amount)).toEqual([-200_000]);

    // The same client key from another nurse is a different request.
    const other = await nurseWith(100_000);
    expect((await service.requestWithdrawal(other, 50_000, key)).id).not.toBe(r.id);
  });

  it('refuses more than available (400 INSUFFICIENT_BALANCE), bad amounts, and a nurse without a bank account', async () => {
    const nurse = await nurseWith(100_000);
    await expect(service.requestWithdrawal(nurse, 100_001)).rejects.toMatchObject({ status: 400, code: 'INSUFFICIENT_BALANCE', details: { available: 100_000 } });
    await expect(service.requestWithdrawal(nurse, 0)).rejects.toMatchObject({ status: 400, code: 'INVALID_AMOUNT' });
    await expect(service.requestWithdrawal(nurse, 10.5)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' });
    await expect(service.requestWithdrawal(await nurseWith(100_000, false), 1_000)).rejects.toMatchObject({ status: 409, code: 'BANK_ACCOUNT_REQUIRED' });
    expect(await balances(nurse)).toEqual({ a: 100_000, d: 300_000 }); // deposit never withdrawn
  });

  it('two requests at the same moment never overdraw', async () => {
    const nurse = await nurseWith(100_000);
    const results = await Promise.allSettled([service.requestWithdrawal(nurse, 70_000), service.requestWithdrawal(nurse, 70_000)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason.code)).toEqual(['INSUFFICIENT_BALANCE']);
    expect(await balances(nurse)).toMatchObject({ a: 30_000 });
  });

  it('Admin: transferred → WITHDRAWN; rejected with a reason → REJECTED and the money comes back once', async () => {
    const nurse = await nurseWith(300_000);
    const a = await service.requestWithdrawal(nurse, 100_000);
    const b = await service.requestWithdrawal(nurse, 150_000);
    expect(await balances(nurse)).toMatchObject({ a: 50_000 });

    expect(await service.markWithdrawn(admin, a.id, 'VCB-FT-0001')).toMatchObject({ status: 'WITHDRAWN', processedAt: expect.any(String) });
    await expect(service.markWithdrawn(admin, a.id, null)).rejects.toMatchObject({ code: 'WITHDRAWAL_CLOSED' });
    expect((await pool.query(`SELECT payout_ref FROM withdrawal_requests WHERE id = $1`, [a.id])).rows[0].payout_ref).toBe('VCB-FT-0001');

    await expect(service.reject(admin, b.id, 'sai')).rejects.toMatchObject({ status: 400 });
    expect(await service.reject(admin, b.id, 'Tên chủ tài khoản không khớp CCCD')).toMatchObject({ status: 'REJECTED', rejectReason: 'Tên chủ tài khoản không khớp CCCD' });
    await expect(service.reject(admin, b.id, 'Từ chối lần thứ hai')).rejects.toMatchObject({ code: 'WITHDRAWAL_CLOSED' });
    expect(await balances(nurse)).toMatchObject({ a: 200_000 });
    await expect(service.markWithdrawn(admin, randomUUID(), null)).rejects.toMatchObject({ status: 404 });

    expect((await service.listWithdrawals(nurse)).map((w) => w.status).sort()).toEqual(['REJECTED', 'WITHDRAWN']);
  });
});
