import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

/**
 * Real schema-constraint checks (Tier 1) for the money tables and the audit
 * trail. Every test runs inside a transaction that is rolled back, so the
 * database is left exactly as it was.
 *
 * Needs migration 0001 + seed 001 applied (CI does this; locally run
 * `npm run docker:up`).
 */

describe('PostgreSQL Schema Constraint: Wallets & Append-Only Ledger', () => {
  let client: Client;
  let walletId: string;

  beforeAll(async () => {
    client = new Client({
      connectionString:
        process.env.DATABASE_URL ?? 'postgresql://postgres:postgrespassword@localhost:5432/healthcare_dev',
    });
    await client.connect();
    // Không dùng cứng id của seed: lấy 1 ví bất kỳ đang có trong DB.
    const { rows } = await client.query('SELECT id FROM wallets ORDER BY created_at LIMIT 1');
    if (rows.length === 0) throw new Error('No wallet found: run db/seeds/001_reference_and_demo.sql first');
    walletId = rows[0].id;
  });

  afterAll(async () => {
    await client.end();
  });

  /** Runs `fn` in a transaction and always rolls back. */
  async function inRolledBackTx<T>(fn: () => Promise<T>): Promise<T> {
    await client.query('BEGIN');
    try {
      return await fn();
    } finally {
      await client.query('ROLLBACK');
    }
  }

  /** Expects the statement to fail, keeping the surrounding transaction usable. */
  async function expectFailure(sql: string, params: unknown[], pattern: RegExp): Promise<void> {
    await client.query('SAVEPOINT expect_failure');
    await expect(client.query(sql, params)).rejects.toThrow(pattern);
    await client.query('ROLLBACK TO SAVEPOINT expect_failure');
  }

  async function insertLedgerRow(idempotencyKey: string = randomUUID()): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after)
       VALUES ($1, $2, 'TOPUP', 'AVAILABLE', 100000, 1500000, 1600000)
       RETURNING id`,
      [walletId, idempotencyKey],
    );
    return rows[0].id;
  }

  it('enforces available_balance >= 0 and escrow_locked_balance >= 0', async () => {
    await inRolledBackTx(async () => {
      await expectFailure('UPDATE wallets SET available_balance = -1 WHERE id = $1', [walletId], /check constraint/);
      await expectFailure('UPDATE wallets SET escrow_locked_balance = -1 WHERE id = $1', [walletId], /check constraint/);
    });
  });

  it('allows deposit_balance to go negative (booked penalty debt, FR-PAY-03)', async () => {
    await inRolledBackTx(async () => {
      const { rowCount } = await client.query('UPDATE wallets SET deposit_balance = -50000 WHERE id = $1', [walletId]);
      expect(rowCount).toBe(1);
    });
  });

  it('enforces append-only triggers on wallet_transactions preventing UPDATE and DELETE', async () => {
    await inRolledBackTx(async () => {
      const txId = await insertLedgerRow();
      await expectFailure('UPDATE wallet_transactions SET amount = 1 WHERE id = $1', [txId], /append-only/);
      await expectFailure('DELETE FROM wallet_transactions WHERE id = $1', [txId], /append-only/);
    });
  });

  it('rejects a zero or negative ledger amount (direction follows tx_type)', async () => {
    await inRolledBackTx(async () => {
      await expectFailure(
        `INSERT INTO wallet_transactions
           (wallet_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after)
         VALUES ($1, $2, 'TOPUP', 'AVAILABLE', 0, 0, 0)`,
        [walletId, randomUUID()],
        /check constraint/,
      );
    });
  });

  it('guarantees idempotency_key is UNIQUE across wallet_transactions', async () => {
    await inRolledBackTx(async () => {
      const key = `webhook-${randomUUID()}`;
      await insertLedgerRow(key);
      await expectFailure(
        `INSERT INTO wallet_transactions
           (wallet_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after)
         VALUES ($1, $2, 'TOPUP', 'AVAILABLE', 100000, 1600000, 1700000)`,
        [walletId, key],
        /duplicate key value/,
      );
    });
  });

  it('enforces append-only triggers on audit_logs preventing mutation', async () => {
    await inRolledBackTx(async () => {
      const { rows } = await client.query(
        `INSERT INTO audit_logs (actor_id, action_type, target_table) VALUES (NULL, 'UPDATE_CONFIG', 'system_configs') RETURNING id`,
      );
      await expectFailure(`UPDATE audit_logs SET target_table = 'x' WHERE id = $1`, [rows[0].id], /append-only/);
      await expectFailure('DELETE FROM audit_logs WHERE id = $1', [rows[0].id], /append-only/);
    });
  });
});
