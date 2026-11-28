-- =====================================================================
-- 0031 — Audit action for Admin service-catalog changes (Phase 7, BE-1 / Dev A)
-- FR-ADMIN-01 · SEC-9.1 · Phase 7 exit criterion "every Admin action writes audit_logs"
--
-- Why: audit_action_enum has UPDATE_CONFIG (used by admin-configs) but nothing for
-- creating or editing a row of service_categories. packages/shared AuditAction gains
-- the same value (core/audit validates against it).
--
-- ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+, as long as
-- the new value is not used in the same transaction (it is not). IF NOT EXISTS keeps the
-- file safe to re-run. Forward-only: never edit this file after it is merged; add 0032+.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'UPDATE_SERVICE_CATALOG';
