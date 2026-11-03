/**
 * Core Audit Logger (BE-3)
 *
 * Append-only security audit trail backed by `audit_logs` (SRS §7 table 16, SEC-9.1).
 *
 * Guarantees:
 *  - This module only ever INSERTs. It exposes no update or delete operation.
 *  - The database enforces the same rule independently: the triggers
 *    `trg_audit_logs_no_update` / `trg_audit_logs_no_delete` (migration 0001)
 *    reject any UPDATE or DELETE, whoever issues it.
 *  - `writeAuditLog` takes the caller's executor, so the audit row commits or
 *    rolls back together with the business change it records (pass the
 *    transaction client, not the pool, when you are inside a transaction).
 *  - Old/new values are stored in the database only, never printed to
 *    application logs (SEC-3.6: no sensitive content in logs).
 */

import { AuditAction } from '@healthcare-system/shared';

/**
 * Minimal query interface. Both `pg.Pool` and a `pg.PoolClient` (inside a
 * transaction) satisfy it, so core modules do not depend on `core/database`.
 */
export interface SqlExecutor {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

export interface AuditLogEntry {
  /** The acting user. `null` for automated system actions (schema note D-08). */
  actorId: string | null;
  action: AuditAction;
  /** Table the action targeted, e.g. `nurse_credentials`. */
  targetTable?: string;
  /** UUID of the targeted row. */
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export interface AuditLogRecord {
  id: string;
  createdAt: Date | string;
}

export class AuditValidationError extends Error {
  readonly code = 'AUDIT_VALIDATION_ERROR';
}

const VALID_ACTIONS = new Set<string>(Object.values(AuditAction));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TARGET_TABLE_LENGTH = 100; // audit_logs.target_table VARCHAR(100)
const MAX_IP_LENGTH = 45; // audit_logs.ip_address VARCHAR(45)

const INSERT_AUDIT_SQL = `
  INSERT INTO audit_logs (actor_id, action_type, target_table, target_id, old_value, new_value, ip_address)
  VALUES ($1, $2::audit_action_enum, $3, $4, $5::jsonb, $6::jsonb, $7)
  RETURNING id, created_at`;

function toJsonParam(value: unknown): string | null {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export function validateAuditEntry(entry: AuditLogEntry): void {
  if (!VALID_ACTIONS.has(entry.action)) {
    throw new AuditValidationError(`Unknown audit action "${String(entry.action)}"`);
  }
  if (entry.actorId !== null && !UUID_RE.test(entry.actorId)) {
    throw new AuditValidationError('actorId must be a UUID or null');
  }
  if (entry.targetId !== undefined && !UUID_RE.test(entry.targetId)) {
    throw new AuditValidationError('targetId must be a UUID');
  }
  if (entry.targetTable !== undefined && entry.targetTable.length > MAX_TARGET_TABLE_LENGTH) {
    throw new AuditValidationError(`targetTable exceeds ${MAX_TARGET_TABLE_LENGTH} characters`);
  }
  if (entry.ipAddress !== undefined && entry.ipAddress.length > MAX_IP_LENGTH) {
    throw new AuditValidationError(`ipAddress exceeds ${MAX_IP_LENGTH} characters`);
  }
}

/**
 * Appends one row to `audit_logs`.
 *
 * Call it with the same transaction client as the change being audited:
 *
 *   await withTransaction(pool, async (tx) => {
 *     await approveCredential(tx, ...);
 *     await writeAuditLog(tx, { actorId: adminId, action: AuditAction.APPROVE_GPHN, ... });
 *   });
 */
export async function writeAuditLog(executor: SqlExecutor, entry: AuditLogEntry): Promise<AuditLogRecord> {
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
