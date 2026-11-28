/**
 * admin-configs — Admin edits the business parameters in system_configs without a redeploy (BE-1, Phase 7).
 * Traceability: SRS §5.1 · Phase 7 BE-1 checklist · TC-PRICE-01 · SEC-9.1
 * Contract: the one admin-web proposed (features/configs) — docs/api/admin-configs.api.md.
 *
 *  - Values only: keys are added by migrations, never through the API (the code reads them by name).
 *  - Each change: rows locked, value checked (type + guard rails + ordered pairs), stored with updated_by,
 *    audit_logs UPDATE_CONFIG (old/new value + the Admin's note) — all in one transaction.
 *  - After COMMIT the config cache is dropped, so this API instance uses the new value at once; other
 *    instances pick it up within CONFIG_CACHE_TTL_MS (60 s).
 */
import { AuditAction } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { invalidateConfig } from '../../core/config';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { badRequest, notFound } from '../../core/errors';
import { checkConfigValue, checkOrderedPairs, toStoredString } from './admin-configs.policy';
import * as repo from './admin-configs.repo';
import type { ConfigItemDto, ConfigRow } from './admin-configs.types';

export interface AdminConfigsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  invalidate: () => void;
}

const notFoundKey = () => notFound('CONFIG_NOT_FOUND', 'No such configuration key');
const invalid = (message: string) => badRequest('INVALID_CONFIG_VALUE', message);

function toDto(r: ConfigRow): ConfigItemDto {
  return {
    key: r.config_key,
    value: r.config_value,
    dataType: r.data_type,
    description: r.description,
    updatedBy: r.updated_by ? { id: r.updated_by, name: r.updated_by_name ?? '' } : null,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export class AdminConfigsService {
  constructor(private readonly deps: AdminConfigsDeps) {}

  /** GET /admin/configs → { items } */
  async list(): Promise<{ items: ConfigItemDto[] }> {
    return { items: (await repo.listConfigs(this.deps.read)).map(toDto) };
  }

  /** PATCH /admin/configs/:key { value, note? } → the item after the change. */
  async update(adminId: string, key: string, input: string, note: string | undefined, ip: string | null): Promise<ConfigItemDto> {
    const changed = await this.deps.withTx(async (db) => {
      const rows = await repo.lockAllConfigs(db);
      const row = rows.find((r) => r.config_key === key);
      if (!row) throw notFoundKey();

      const stored = toStoredString(input, row.data_type);
      if (stored === null) throw invalid(`Expected a ${row.data_type} value`);
      const checked = checkConfigValue(key, stored, row.data_type);
      if ('code' in checked) throw invalid(checked.message);
      const old = checkConfigValue(key, row.config_value, row.data_type);
      const oldValue = 'code' in old ? row.config_value : old.value;
      if (JSON.stringify(oldValue) === JSON.stringify(checked.value)) return false;

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
        newValue: { key, value: checked.value, ...(note ? { note } : {}) },
        ...(ip ? { ipAddress: ip } : {}),
      });
      return true;
    });
    if (changed) this.deps.invalidate();
    // Read after COMMIT (or from the same transaction in tests) so the reply shows what is stored.
    const after = await repo.getConfig(this.deps.read, key);
    if (!after) throw notFoundKey();
    return toDto(after);
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
