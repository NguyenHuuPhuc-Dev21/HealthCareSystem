import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { AuditAction } from "@healthcare-system/shared";
import { writeAuditLog } from "../../src/core/audit";
import { createTestPool } from "./helpers";

const ADMIN_ID = "20000000-0000-0000-0000-000000000001"; // admin trong seed

describe("core/audit với PostgreSQL thật (integration)", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = createTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("lưu đủ mọi cột của bản ghi audit", async () => {
    const targetId = randomUUID();
    const record = await writeAuditLog(pool, {
      actorId: ADMIN_ID,
      action: AuditAction.APPROVE_GPHN,
      targetTable: "nurse_credentials",
      targetId,
      oldValue: { verification_status: "PENDING" },
      newValue: { verification_status: "APPROVED" },
      ipAddress: "203.0.113.7",
    });

    const { rows } = await pool.query(
      `SELECT actor_id, action_type, target_table, target_id,
              old_value->>'verification_status' AS old_status,
              new_value->>'verification_status' AS new_status,
              ip_address
         FROM audit_logs WHERE id = $1`,
      [record.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      actor_id: ADMIN_ID,
      action_type: "APPROVE_GPHN",
      target_table: "nurse_credentials",
      target_id: targetId,
      old_status: "PENDING",
      new_status: "APPROVED",
      ip_address: "203.0.113.7",
    });
  });

  it("bị hủy theo khi giao dịch nghiệp vụ ROLLBACK", async () => {
    const targetId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await writeAuditLog(client, {
        actorId: ADMIN_ID,
        action: AuditAction.UPDATE_CONFIG,
        targetTable: "system_configs",
        targetId,
      });
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    const { rows } = await pool.query(
      "SELECT 1 FROM audit_logs WHERE target_id = $1",
      [targetId],
    );
    expect(rows).toHaveLength(0);
  });

  it("DB từ chối UPDATE và DELETE trên audit_logs", async () => {
    const record = await writeAuditLog(pool, {
      actorId: null,
      action: AuditAction.DELETE_PATIENT_DATA,
      targetId: randomUUID(),
    });

    await expect(
      pool.query(`UPDATE audit_logs SET ip_address = '0.0.0.0' WHERE id = $1`, [
        record.id,
      ]),
    ).rejects.toThrow(/append-only/);
    await expect(
      pool.query("DELETE FROM audit_logs WHERE id = $1", [record.id]),
    ).rejects.toThrow(/append-only/);
  });
});
