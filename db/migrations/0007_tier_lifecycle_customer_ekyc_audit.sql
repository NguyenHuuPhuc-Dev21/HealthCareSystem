-- =====================================================================
-- 0007 — Audit actions for tier-lifecycle and customer eKYC review
--        (Phase 1, requested by BE-2 / Dev B)
-- FR-AUTH-02 §2 · BR-21 §2.5 · FR-AUTH-03 · US-HP-06 AC-01 · SEC-9.1
--
-- Why: audit_action_enum (0001) has no value for
--   * the automatic Tier 2 → Tier 1 demotion done by the daily GPHN sweep
--     (actor_id NULL = system), and
--   * an Admin approving / rejecting a customer's CCCD eKYC.
-- packages/shared AuditAction gains the same two values (core/audit validates against it).
--
-- ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+,
-- as long as the new value is not used in the same transaction (it is not).
-- IF NOT EXISTS keeps the file safe to re-run on a database that already has them.
-- Forward-only: never edit this file after it is merged; add 0008+.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'TIER_DEMOTION';
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'REVIEW_CUSTOMER_KYC';
