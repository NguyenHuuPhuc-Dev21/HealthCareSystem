/**
 * admin-configs — Admin edits the business parameters in system_configs without a redeploy (BE-1, Phase 7).
 * Traceability: SRS §5.1 · Phase 7 BE-1 checklist · TC-PRICE-01 · SEC-9.1
 *
 *  - Values only: keys are added by migrations, never through the API (the code reads them by name).
 *  - Each change: rows locked, value checked (type + guard rails + ordered pairs), stored with updated_by,
 *    audit_logs UPDATE_CONFIG (old/new value) — all in one transaction.
 *  - After COMMIT the config cache is dropped, so this API instance uses the new value at once; other
 *    instances pick it up within CONFIG_CACHE_TTL_MS (60 s).
 */
import { AuditAction } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { invalidateConfig, parseConfigValue } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, notFound } from '../../core/errors';
import { checkConfigValue, checkOrderedPairs, toStoredString } from './admin-configs.policy';
import * as repo from './admin-configs.repo';
import type { ConfigItemDto, ConfigRow, UpdateConfigResult } from './admin-configs.types';

export interface AdminConfigsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  invalidate: () => void;
}

const notFoundKey = () => notFound('CONFIG_NOT_FOUND', 'No such configuration key');
const invalid = (message: string) => new AppError(422, 'INVALID_CONFIG_VALUE', message);

function toDto(r: ConfigRow): ConfigItemDto {
  let value: unknown;
  try {
    value = parseConfigValue(r.config_key, r.config_value, r.data_type);
  } catch {
    value = r.config_value; // show what is stored even if it is broken, so the Admin can fix it
  }
  return {
    value,
    dataType: r.data_type,
    description: r.description,
    updatedAt: new Date(r.updated_at).toISOString(),
    updatedBy: r.updated_by,
  };
}

export class AdminConfigsService {
  constructor(private readonly deps: AdminConfigsDeps) {}

  /** GET /admin/configs → { KEY: { value, dataType, description, updatedAt, updatedBy } } */
  async list(): Promise<Record<string, ConfigItemDto>> {
    const rows = await repo.listConfigs(this.deps.read);
    return Object.fromEntries(rows.map((r) => [r.config_key, toDto(r)]));
  }

  /** PATCH /admin/configs/:key */
  async update(adminId: string, key: string, input: unknown, ip: string | null): Promise<UpdateConfigResult> {
    const out = await this.deps.withTx(async (db) => {
      const rows = await repo.lockAllConfigs(db);
      const row = rows.find((r) => r.config_key === key);
      if (!row) throw notFoundKey();

      const stored = toStoredString(input, row.data_type);
      if (stored === null) throw invalid(`Expected a ${row.data_type} value`);
      const checked = checkConfigValue(key, stored, row.data_type);
      if ('code' in checked) throw invalid(checked.message);

      const oldValue = toDto(row).value;
      if (JSON.stringify(oldValue) === JSON.stringify(checked.value)) {
        return { updated: false, key, value: oldValue };
      }

      if (row.data_type === 'NUMBER') {
        const numbers = new Map<string, number>();
        for (const r of rows) if (r.data_type === 'NUMBER') numbers.set(r.config_key, Number(r.config_value));
        numbers.set(key, checked.value as number);
        const pair = checkOrderedPairs(numbers);
        if (pair) throw invalid(pair.message);
      }

      await repo.updateConfig(db, key, stored, adminId);
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.UPDATE_CONFIG,
        targetTable: 'system_configs',
        oldValue: { key, value: oldValue },
        newValue: { key, value: checked.value },
        ...(ip ? { ipAddress: ip } : {}),
      });
      return { updated: true, key, value: checked.value };
    });
    if (out.updated) this.deps.invalidate();
    return out;
  }
}

let singleton: AdminConfigsService | null = null;

export function getAdminConfigsService(): AdminConfigsService {
  if (!singleton) {
    singleton = new AdminConfigsService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
      invalidate: invalidateConfig,
    });
  }
  return singleton;
}
