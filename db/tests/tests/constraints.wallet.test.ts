import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Test ràng buộc schema THẬT (Tier 1) cho các bảng tiền và audit.
 * Mọi test chạy trong transaction rồi ROLLBACK -> DB giữ nguyên như cũ.
 * Cần migration 0001 + seed 001 (CI tự chạy; ở máy mình: npm run docker:up).
 */

const NURSE_WALLET_OWNER = "20000000-0000-0000-0000-000000000002"; // điều dưỡng trong seed

describe("PostgreSQL Schema Constraint: Wallets & Append-Only Ledger", () => {
  let client: Client;
  let walletId: string;

  beforeAll(async () => {
    client = new Client({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgrespassword@localhost:5432/healthcare_dev",
    });
    await client.connect();
    const { rows } = await client.query(
      "SELECT id FROM wallets WHERE user_id = $1",
      [NURSE_WALLET_OWNER],
    );
    walletId = rows[0].id;
  });

  afterAll(async () => {
    await client.end();
  });

  /** Chạy fn trong transaction và LUÔN rollback. */
  async function inRolledBackTx<T>(fn: () => Promise<T>): Promise<T> {
    await client.query("BEGIN");
    try {
      return await fn();
    } finally {
      await client.query("ROLLBACK");
    }
  }

  /** Mong câu lệnh bị lỗi, nhưng vẫn giữ transaction dùng tiếp được (nhờ SAVEPOINT). */
  async function expectFailure(
    sql: string,
    params: unknown[],
    pattern: RegExp,
  ): Promise<void> {
    await client.query("SAVEPOINT expect_failure");
    await expect(client.query(sql, params)).rejects.toThrow(pattern);
    await client.query("ROLLBACK TO SAVEPOINT expect_failure");
  }

  async function insertLedgerRow(
    idempotencyKey: string = randomUUID(),
  ): Promise<string> {
    const { rows } = await client.query(
      `INSERT INTO wallet_transactions
         (wallet_id, idempotency_key, tx_type, balance_type, amount, balance_before, balance_after)
       VALUES ($1, $2, 'TOPUP', 'AVAILABLE', 100000, 1500000, 1600000)
       RETURNING id`,
      [walletId, idempotencyKey],
    );
    return rows[0].id;
  }

  it("available_balance >= 0 và escrow_locked_balance >= 0", async () => {
    await inRolledBackTx(async () => {
      await expectFailure(
        "UPDATE wallets SET available_balance = -1 WHERE id = $1",
        [walletId],
        /check constraint/,
      );
      await expectFailure(
        "UPDATE wallets SET escrow_locked_balance = -1 WHERE id = $1",
        [walletId],
        /check constraint/,
      );
    });
  });

  it("deposit_balance ĐƯỢC PHÉP âm (ghi nợ phạt, FR-PAY-03)", async () => {
    await inRolledBackTx(async () => {
      const { rowCount } = await client.query(
        "UPDATE wallets SET deposit_balance = -50000 WHERE id = $1",
        [walletId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("wallet_transactions append-only: chặn UPDATE và DELETE", async () => {
    await inRolledBackTx(async () => {
      const txId = await insertLedgerRow();
      await expectFailure(
        "UPDATE wallet_transactions SET amount = 1 WHERE id = $1",
        [txId],
        /append-only/,
      );
      await expectFailure(
        "DELETE FROM wallet_transactions WHERE id = $1",
        [txId],
        /append-only/,
      );
    });
  });

  it("amount phải > 0 (chiều cộng/trừ do tx_type quyết định)", async () => {
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

  it("idempotency_key là UNIQUE: webhook gọi lại không tạo bút toán kép", async () => {
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

  it("audit_logs append-only: chặn UPDATE và DELETE", async () => {
    await inRolledBackTx(async () => {
      const { rows } = await client.query(
        `INSERT INTO audit_logs (actor_id, action_type, target_table)
         VALUES (NULL, 'UPDATE_CONFIG', 'system_configs') RETURNING id`,
      );
      await expectFailure(
        `UPDATE audit_logs SET target_table = 'x' WHERE id = $1`,
        [rows[0].id],
        /append-only/,
      );
      await expectFailure(
        "DELETE FROM audit_logs WHERE id = $1",
        [rows[0].id],
        /append-only/,
      );
    });
  });
});
