/** SQL for admin-configs. BE-1 · Phase 7 · §5.1. */
import type { Queryable } from '../../core/database';
import type { ConfigRow } from './admin-configs.types';

const SELECT = `SELECT c.config_key, c.config_value, c.data_type, c.description, c.updated_by,
                       u.full_name AS updated_by_name, c.updated_at
                  FROM system_configs c
                  LEFT JOIN users u ON u.id = c.updated_by`;

export async function listConfigs(db: Queryable): Promise<ConfigRow[]> {
  const { rows } = await db.query<ConfigRow>(`${SELECT} ORDER BY c.config_key`);
  return rows;
}

export async function getConfig(db: Queryable, key: string): Promise<ConfigRow | null> {
  const { rows } = await db.query<ConfigRow>(`${SELECT} WHERE c.config_key = $1`, [key]);
  return rows[0] ?? null;
}

/** Locks every row: pair checks read other keys, so two Admins editing a pair cannot interleave. */
export async function lockAllConfigs(db: Queryable): Promise<Pick<ConfigRow, 'config_key' | 'config_value' | 'data_type'>[]> {
  const { rows } = await db.query<Pick<ConfigRow, 'config_key' | 'config_value' | 'data_type'>>(
    'SELECT config_key, config_value, data_type FROM system_configs ORDER BY config_key FOR UPDATE',
  );
  return rows;
}

export async function updateConfig(db: Queryable, key: string, value: string, adminId: string): Promise<void> {
  await db.query(
    'UPDATE system_configs SET config_value = $2, updated_by = $3, updated_at = now() WHERE config_key = $1',
    [key, value, adminId],
  );
}
