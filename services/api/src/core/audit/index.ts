/**
 * Core Audit Logger (BE-3)
 * Ghi audit_logs theo kiểu append-only (SRS §7 bảng 16, SEC-9.1).
 * - Module chỉ INSERT, không có hàm update/delete.
 * - DB cũng tự chặn UPDATE/DELETE bằng trigger (migration 0001).
 * - Nhận executor của người gọi để audit commit/rollback cùng nghiệp vụ.
 */

import { AuditAction } from "@healthcare-system/shared";

/** Thứ gì có hàm query() đều dùng được: pg.Pool hoặc client trong transaction. */
export interface SqlExecutor {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: any[]; rowCount: number | null }>;
}

export interface AuditLogEntry {
  actorId: string | null; // người thực hiện; null = hệ thống tự động
  action: AuditAction; // 1 trong 6 giá trị của audit_action_enum
  targetTable?: string; // bảng bị tác động, vd 'nurse_credentials'
  targetId?: string; // UUID của dòng bị tác động
  oldValue?: unknown; // giá trị trước (lưu dạng JSON)
  newValue?: unknown; // giá trị sau
  ipAddress?: string;
}

export interface AuditLogRecord {
  id: string;
  createdAt: Date | string;
}

export class AuditValidationError extends Error {
  readonly code = "AUDIT_VALIDATION_ERROR";
}

const VALID_ACTIONS = new Set<string>(Object.values(AuditAction));
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INSERT_AUDIT_SQL = `
  INSERT INTO audit_logs (actor_id, action_type, target_table, target_id, old_value, new_value, ip_address)
  VALUES ($1, $2::audit_action_enum, $3, $4, $5::jsonb, $6::jsonb, $7)
  RETURNING id, created_at`;

function toJsonParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

/** Kiểm tra dữ liệu TRƯỚC khi chạm vào DB. */
export function validateAuditEntry(entry: AuditLogEntry): void {
  if (!VALID_ACTIONS.has(entry.action)) {
    throw new AuditValidationError(
      `Unknown audit action "${String(entry.action)}"`,
    );
  }
  if (entry.actorId !== null && !UUID_RE.test(entry.actorId)) {
    throw new AuditValidationError("actorId must be a UUID or null");
  }
  if (entry.targetId !== undefined && !UUID_RE.test(entry.targetId)) {
    throw new AuditValidationError("targetId must be a UUID");
  }
  if (entry.targetTable !== undefined && entry.targetTable.length > 100) {
    throw new AuditValidationError("targetTable exceeds 100 characters");
  }
  if (entry.ipAddress !== undefined && entry.ipAddress.length > 45) {
    throw new AuditValidationError("ipAddress exceeds 45 characters");
  }
}

/** Thêm 1 dòng vào audit_logs. Trong transaction thì truyền client của transaction. */
export async function writeAuditLog(
  executor: SqlExecutor,
  entry: AuditLogEntry,
): Promise<AuditLogRecord> {
  validateAuditEntry(entry);

  const result = await executor.query(INSERT_AUDIT_SQL, [
    entry.actorId,
    entry.action,
    entry.targetTable ?? null,
    entry.targetId ?? null,
    toJsonParam(entry.oldValue),
    toJsonParam(entry.newValue),
    entry.ipAddress ?? null,
  ]);

  const row = result.rows[0];
  return { id: row.id, createdAt: row.created_at };
}
