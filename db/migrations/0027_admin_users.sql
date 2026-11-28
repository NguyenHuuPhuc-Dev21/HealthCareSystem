-- =====================================================================
-- 0027 · admin-users (BE-2 · Phase 7 · FR-ADMIN-01 "Quản lý Người dùng")
--
-- Admin searches, views and locks / unlocks customer and nurse accounts (ACTIVE / SUSPENDED / BANNED).
--  * Customer  → users.status.
--  * Nurse     → nurse_profiles.profile_status (single source of truth for taking shifts); a BAN also sets
--                users.status = BANNED so sign-in is refused. An Admin suspension writes
--                suspended_reason = 'ADMIN_SUSPENDED': the automatic lifts (deposit top-up trigger 0025,
--                commission payment) only lift their own reason, so only an Admin lifts it.
--  * Every change writes audit_logs CHANGE_ACCOUNT_STATUS (old / new status, reason, released bookings).
--
-- ALTER TYPE … ADD VALUE is fine inside the migration transaction: the new value is not used in this file.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'CHANGE_ACCOUNT_STATUS';

-- Admin list: newest first, filtered by role.
CREATE INDEX IF NOT EXISTS idx_users_role_created ON users (role, created_at DESC);

-- Status history of one account (detail screen) reads audit_logs by (target_table, target_id): idx_audit_target (0001).

COMMENT ON COLUMN nurse_profiles.suspended_reason IS
    'Code of the current suspension: DEPOSIT_SHORTFALL (0025 trigger), COMMISSION_OVERDUE (cash-commission), '
    'TRUST_SCORE_BELOW_THRESHOLD (reviews-trustscore), ADMIN_SUSPENDED / ADMIN_BANNED (admin-users). '
    'Each automatic lift only clears its own code.';
