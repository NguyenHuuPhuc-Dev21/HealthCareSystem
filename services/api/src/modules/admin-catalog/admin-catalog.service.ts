/**
 * admin-catalog — Admin manages the service catalog (BE-1, Phase 7).
 * Traceability: FR-ADMIN-01 · SRS §4.2 (3 groups), §7 table 5 · SEC-9.1
 *
 *  - Create and edit; never delete: bookings keep pointing at their service, so a service is retired
 *    with is_active = false (it disappears from booking, stays in history). `code` never changes.
 *  - Invasive ⇒ required_tier TIER_2_SPECIALIST, checked on the row after the change (422, never fixed silently).
 *  - A new price applies to bookings created afterwards: a booking copies its amounts when it is priced.
 *  - Every create / change writes audit_logs UPDATE_SERVICE_CATALOG (old and new values) in the same transaction.
 */
import { AuditAction } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getPool, withTransaction, type Queryable } from '../../core/database';
import { AppError, conflict, notFound } from '../../core/errors';
import { catalogProblem, changedFields } from './admin-catalog.policy';
import * as repo from './admin-catalog.repo';
import type { CreateServiceBody, UpdateServiceBody } from './admin-catalog.schema';
import type { EditableFields, ServiceCategoryRow } from './admin-catalog.types';

export interface AdminCatalogDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
}

const TARGET = 'service_categories';
const invasiveError = () =>
  new AppError(422, 'INVASIVE_REQUIRES_TIER_2', 'An invasive service must require TIER_2_SPECIALIST');
const notFoundService = () => notFound('SERVICE_NOT_FOUND', 'Service not found');

function editable(r: ServiceCategoryRow): EditableFields {
  return {
    name: r.name,
    service_type: r.service_type,
    is_invasive: r.is_invasive,
    is_prohibited: r.is_prohibited,
    required_tier: r.required_tier,
    base_price: Number(r.base_price),
    unit: r.unit,
    is_active: r.is_active,
  };
}

function toDto(r: ServiceCategoryRow) {
  return { ...r, base_price: Number(r.base_price) };
}

export class AdminCatalogService {
  constructor(private readonly deps: AdminCatalogDeps) {}

  /** GET /admin/services/categories — every service, retired ones included. */
  async list() {
    return (await repo.listServices(this.deps.read)).map(toDto);
  }

  /** POST /admin/services/categories */
  async create(adminId: string, body: CreateServiceBody, ip: string | null) {
    if (catalogProblem(body)) throw invasiveError();
    return this.deps.withTx(async (db) => {
      let row: ServiceCategoryRow;
      try {
        row = await repo.insertService(db, body);
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw conflict('SERVICE_CODE_TAKEN', 'A service with this code already exists');
        throw e;
      }
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.UPDATE_SERVICE_CATALOG,
        targetTable: TARGET,
        targetId: row.id,
        newValue: { code: row.code, ...editable(row) },
        ...(ip ? { ipAddress: ip } : {}),
      });
      return toDto(row);
    });
  }

  /** PATCH /admin/services/categories/:id */
  async update(adminId: string, id: string, body: UpdateServiceBody, ip: string | null) {
    return this.deps.withTx(async (db) => {
      const current = await repo.lockService(db, id);
      if (!current) throw notFoundService();
      const before = editable(current);
      if (catalogProblem({ ...before, ...body })) throw invasiveError();

      const changes = changedFields(before, body);
      if (Object.keys(changes).length === 0) return toDto(current);

      const row = await repo.updateService(db, id, changes);
      const oldValue: Record<string, unknown> = { code: current.code };
      for (const k of Object.keys(changes) as (keyof EditableFields)[]) oldValue[k] = before[k];
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.UPDATE_SERVICE_CATALOG,
        targetTable: TARGET,
        targetId: id,
        oldValue,
        newValue: { code: current.code, ...changes },
        ...(ip ? { ipAddress: ip } : {}),
      });
      return toDto(row);
    });
  }
}

let singleton: AdminCatalogService | null = null;

export function getAdminCatalogService(): AdminCatalogService {
  if (!singleton) {
    singleton = new AdminCatalogService({
      read: getPool(),
      withTx: (fn) => withTransaction((client) => fn(client)),
    });
  }
  return singleton;
}
