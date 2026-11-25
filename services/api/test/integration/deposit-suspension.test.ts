import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { PenaltyReason, TxType } from '@healthcare-system/shared';
import { closePool, runInTransaction } from '../../src/core/database';
import { deductPenalty, reversePenalty } from '../../src/modules/deposits/deposits.ledger';
import { postNurseEntry } from '../../src/modules/wallets-ledger/wallets-ledger.ledger';
import { createTestPool } from './helpers';

/**
 * Phase 5 (BE-2 · deposits) trên PostgreSQL 16 thật — migration 0025 (trigger trên wallets.deposit_balance):
 * SRS v2.0 vòng đời hồ sơ: "ACTIVE → SUSPENDED khi deposit_balance < 300.000 do bị trừ phạt",
 * "SUSPENDED → ACTIVE khi nạp bù đủ ký quỹ"; FR-PAY-03: phạt quá số dư → ghi nợ và khóa nhận ca.
 * Tiền đi qua đúng hàm của BE-3 (deductPenalty, reversePenalty, postNurseEntry) — không sửa số dư bằng tay.
 */
describe('deposit shortfall suspension (integration)', () => {
  let pool: Pool;
  const NOW = Date.now();
  const DAY = 86_400_000;

  async function nurse(o: { deposit?: number; graceDays?: number; status?: string; reason?: string | null; closing?: boolean } = {}) {
    const phone = `08${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      "INSERT INTO users (phone, full_name, role, status) VALUES ($1, 'Điều dưỡng ký quỹ', 'NURSE', 'ACTIVE') RETURNING id",
      [phone],
    );
    const id = rows[0].id as string;
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, profile_status, suspended_reason) VALUES ($1, 'TIER_1_BASIC', $2::profile_status_enum, $3)`,
      [id, o.status ?? 'ACTIVE', o.reason ?? null],
    );
    await pool.query(
      `INSERT INTO wallets (user_id, deposit_balance, deposit_grace_expires_at, closure_requested_at) VALUES ($1, $2, $3, $4)`,
      [id, o.deposit ?? 300_000, o.graceDays === undefined ? null : new Date(NOW + o.graceDays * DAY), o.closing ? new Date(NOW) : null],
    );
    return id;
  }

  const profile = async (id: string) =>
    (await pool.query('SELECT profile_status::text AS status, suspended_reason AS reason FROM nurse_profiles WHERE user_id = $1', [id])).rows[0];
  const balance = async (id: string) => Number((await pool.query('SELECT deposit_balance FROM wallets WHERE user_id = $1', [id])).rows[0].deposit_balance);

  let seq = 0;
  const penalty = (nurseId: string, amount: number) =>
    runInTransaction(pool, (db) =>
      deductPenalty(
        db,
        { nurseId, bookingId: null, reason: PenaltyReason.NURSE_LATE_CANCEL, amount, slaRuleRef: 'SRS §5.2 row 7', idempotencyKey: `test-penalty:${nurseId}:${++seq}` },
        NOW,
      ),
    );
  const credit = (nurseId: string, amount: number, txType: TxType = TxType.TOPUP) =>
    runInTransaction(pool, (db) =>
      postNurseEntry(db, { userId: nurseId, bookingId: null, txType, balance: 'DEPOSIT', delta: amount, idempotencyKey: `test-credit:${nurseId}:${++seq}`, externalRef: null }),
    );

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('a penalty below 300,000 suspends (DEPOSIT_SHORTFALL); topping back up to 300,000 reactivates', async () => {
    const n = await nurse();
    await penalty(n, 50_000);
    expect(await balance(n)).toBe(250_000);
    expect(await profile(n)).toEqual({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });

    await credit(n, 30_000); // not enough yet
    expect(await profile(n)).toEqual({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });
    await credit(n, 20_000);
    expect(await balance(n)).toBe(300_000);
    expect(await profile(n)).toEqual({ status: 'ACTIVE', reason: null });
  });

  it('a penalty above the balance is booked as debt and suspends; an upheld appeal (reversal) reactivates', async () => {
    const n = await nurse();
    const p = await penalty(n, 400_000);
    expect(await balance(n)).toBe(-100_000);
    expect(await profile(n)).toEqual({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });
    await runInTransaction(pool, (db) => reversePenalty(db, { penaltyTransactionId: p!.transactionId, decidedBy: n, note: 'appeal upheld' }));
    expect(await balance(n)).toBe(300_000);
    expect(await profile(n)).toEqual({ status: 'ACTIVE', reason: null });
  });

  it('ADR-0004 grace: a short but positive deposit stays ACTIVE after a penalty; a debt suspends even in grace', async () => {
    const partial = await nurse({ deposit: 200_000, graceDays: 10 });
    await penalty(partial, 50_000);
    expect(await profile(partial)).toEqual({ status: 'ACTIVE', reason: null });

    const empty = await nurse({ deposit: 0, graceDays: 10 });
    await penalty(empty, 50_000);
    expect(await balance(empty)).toBe(-50_000);
    expect(await profile(empty)).toEqual({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });

    const graceOver = await nurse({ deposit: 200_000, graceDays: -1 });
    await penalty(graceOver, 50_000);
    expect(await profile(graceOver)).toEqual({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });
  });

  it('a settlement withholding that completes the deposit reactivates too (DEPOSIT_WITHHOLD)', async () => {
    const n = await nurse({ deposit: 300_000 });
    await penalty(n, 100_000);
    expect((await profile(n)).status).toBe('SUSPENDED');
    await credit(n, 100_000, TxType.DEPOSIT_WITHHOLD);
    expect(await profile(n)).toEqual({ status: 'ACTIVE', reason: null });
  });

  it('other suspension reasons are left to their owners; a closing account is not suspended', async () => {
    const owing = await nurse({ status: 'SUSPENDED', reason: 'COMMISSION_OVERDUE' });
    await penalty(owing, 50_000);
    expect(await profile(owing)).toEqual({ status: 'SUSPENDED', reason: 'COMMISSION_OVERDUE' });
    await credit(owing, 50_000);
    expect(await profile(owing)).toEqual({ status: 'SUSPENDED', reason: 'COMMISSION_OVERDUE' });

    const closing = await nurse({ closing: true });
    await penalty(closing, 50_000);
    expect(await profile(closing)).toEqual({ status: 'ACTIVE', reason: null });

    const pending = await nurse({ status: 'PENDING_VERIFICATION' });
    await penalty(pending, 50_000);
    expect((await profile(pending)).status).toBe('PENDING_VERIFICATION');
  });
});
