/** SQL for admin-configs. BE-1 · Phase 7 · §5.1. */
import type { Queryable } from '../../core/database';
import type { ConfigRow } from './admin-configs.types';

const COLUMNS = 'config_key, config_value, data_type, description, updated_by, updated_at';

export async function listConfigs(db: Queryable): Promise<ConfigRow[]> {
  const { rows } = await db.query<ConfigRow>(`SELECT ${COLUMNS} FROM system_configs ORDER BY config_key`);
  return rows;
}

/** Locks every row: pair checks read other keys, so two Admins editing a pair cannot interleave. */
export async function lockAllConfigs(db: Queryable): Promise<ConfigRow[]> {
  const { rows } = await db.query<ConfigRow>(`SELECT ${COLUMNS} FROM system_configs ORDER BY config_key FOR UPDATE`);
  return rows;
}

export async function updateConfig(db: Queryable, key: string, value: string, adminId: string): Promise<void> {
  await db.query(
    'UPDATE system_configs SET config_value = $2, updated_by = $3, updated_at = now() WHERE config_key = $1',
    [key, value, adminId],
  );
}
