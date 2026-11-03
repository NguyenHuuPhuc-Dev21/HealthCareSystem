import { describe, it, expect } from "vitest";
import { AuditAction } from "@healthcare-system/shared";
import * as auditModule from "../../src/core/audit";
import {
  AuditValidationError,
  writeAuditLog,
  type SqlExecutor,
} from "../../src/core/audit";

const ADMIN_ID = "20000000-0000-0000-0000-000000000001";
const TARGET_ID = "10000000-0000-0000-0000-000000000010";

/** Executor giả: không kết nối DB, chỉ ghi lại các câu SQL được gửi tới. */
function recordingExecutor() {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const executor: SqlExecutor = {
    async query(text, params = []) {
      calls.push({ text, params });
      return {
        rows: [{ id: "audit-row-id", created_at: "2026-11-02T00:00:00Z" }],
        rowCount: 1,
      };
    },
  };
  return { executor, calls };
}

describe("core/audit writeAuditLog (unit)", () => {
  it("gửi đúng 1 câu INSERT, old/new được chuyển thành JSON", async () => {
    const { executor, calls } = recordingExecutor();

    const record = await writeAuditLog(executor, {
      actorId: ADMIN_ID,
      action: AuditAction.UPDATE_CONFIG,
      targetTable: "system_configs",
      oldValue: { config_value: "0.15" },
      newValue: { config_value: "0.12" },
      ipAddress: "10.0.0.1",
    });

    expect(record.id).toBe("audit-row-id");
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/^\s*INSERT INTO audit_logs/);
    expect(calls[0].params).toEqual([
      ADMIN_ID,
      "UPDATE_CONFIG",
      "system_configs",
      null,
      '{"config_value":"0.15"}',
      '{"config_value":"0.12"}',
      "10.0.0.1",
    ]);
  });

  it("chấp nhận actorId = null cho hành động tự động của hệ thống", async () => {
    const { executor, calls } = recordingExecutor();
    await writeAuditLog(executor, {
      actorId: null,
      action: AuditAction.DELETE_PATIENT_DATA,
      targetId: TARGET_ID,
    });
    expect(calls[0].params[0]).toBeNull();
  });

  it("chặn action ngoài audit_action_enum và KHÔNG chạm vào DB", async () => {
    const { executor, calls } = recordingExecutor();
    await expect(
      writeAuditLog(executor, {
        actorId: ADMIN_ID,
        action: "SOS_TRIGGERED" as AuditAction,
      }),
    ).rejects.toThrow(AuditValidationError);
    expect(calls).toHaveLength(0);
  });

  it("chặn actorId hoặc targetId không phải UUID", async () => {
    const { executor } = recordingExecutor();
    await expect(
      writeAuditLog(executor, {
        actorId: "usr_mock",
        action: AuditAction.APPROVE_GPHN,
      }),
    ).rejects.toThrow(AuditValidationError);
    await expect(
      writeAuditLog(executor, {
        actorId: ADMIN_ID,
        action: AuditAction.APPROVE_GPHN,
        targetId: "42",
      }),
    ).rejects.toThrow(AuditValidationError);
  });

  it("không có hàm nào để sửa hoặc xóa audit", () => {
    const exported = Object.keys(auditModule).map((name) => name.toLowerCase());
    expect(
      exported.some((name) => /update|delete|remove|edit/.test(name)),
    ).toBe(false);
  });
});
