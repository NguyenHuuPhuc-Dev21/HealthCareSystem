/** SQL for admin-catalog. BE-1 · Phase 7 · FR-ADMIN-01. */
import type { Queryable } from '../../core/database';
import type { EditableFields, ServiceCategoryRow } from './admin-catalog.types';

const COLUMNS = `id, code, name, service_type, is_invasive, is_prohibited, required_tier,
                 base_price::float8 AS base_price, unit, is_active, created_at, updated_at`;

/** Whitelist: the only columns an UPDATE may name. */
const UPDATABLE: readonly (keyof EditableFields)[] = [
  'name', 'service_type', 'is_invasive', 'is_prohibited', 'required_tier', 'base_price', 'unit', 'is_active',
];
const CASTS: Partial<Record<keyof EditableFields, string>> = {
  service_type: '::service_type_enum',
  required_tier: '::nurse_tier_enum',
  unit: '::service_unit_enum',
};

export async function listServices(db: Queryable): Promise<ServiceCategoryRow[]> {
  const { rows } = await db.query<ServiceCategoryRow>(
    `SELECT ${COLUMNS} FROM service_categories ORDER BY service_type, code`,
  );
  return rows;
}

export async function lockService(db: Queryable, id: string): Promise<ServiceCategoryRow | null> {
  const { rows } = await db.query<ServiceCategoryRow>(`SELECT ${COLUMNS} FROM service_categories WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0] ?? null;
}

/** Throws pg 23505 when the code is taken. */
export async function insertService(db: Queryable, s: EditableFields & { code: string }): Promise<ServiceCategoryRow> {
  const { rows } = await db.query<ServiceCategoryRow>(
    `INSERT INTO service_categories
       (code, name, service_type, is_invasive, is_prohibited, required_tier, base_price, unit, is_active)
     VALUES ($1, $2, $3::service_type_enum, $4, $5, $6::nurse_tier_enum, $7, $8::service_unit_enum, $9)
     RETURNING ${COLUMNS}`,
    [s.code, s.name, s.service_type, s.is_invasive, s.is_prohibited, s.required_tier, s.base_price, s.unit, s.is_active],
  );
  return rows[0]!;
}

export async function updateService(db: Queryable, id: string, changes: Partial<EditableFields>): Promise<ServiceCategoryRow> {
  const keys = UPDATABLE.filter((k) => changes[k] !== undefined);
  const sets = keys.map((k, i) => `${k} = $${i + 2}${CASTS[k] ?? ''}`);
  const { rows } = await db.query<ServiceCategoryRow>(
    `UPDATE service_categories SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, ...keys.map((k) => changes[k])],
  );
  return rows[0]!;
}
