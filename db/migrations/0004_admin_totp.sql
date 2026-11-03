-- =====================================================================
-- 0004 — Admin second factor (TOTP) — Phase 1, BE-1 / Dev A
-- SEC-1.5 / US-HP-05: no Admin session before a second factor succeeds.
--
-- totp_secret_enc : AES-256-GCM encrypted base32 secret ("v1.iv.tag.ct"),
--                   key = env TOTP_ENCRYPTION_KEY (never stored in the DB).
-- totp_enabled_at : set when the Admin confirms enrolment with a valid code.
-- Only ADMIN rows may carry a TOTP secret.
-- Resetting a lost authenticator = set both columns back to NULL (by a second
-- Admin through a future admin-users action, audit-logged).
-- =====================================================================

ALTER TABLE users
    ADD COLUMN totp_secret_enc TEXT,
    ADD COLUMN totp_enabled_at TIMESTAMPTZ;

ALTER TABLE users
    ADD CONSTRAINT chk_users_totp_admin_only
        CHECK (totp_secret_enc IS NULL OR role = 'ADMIN'),
    ADD CONSTRAINT chk_users_totp_enabled_has_secret
        CHECK (totp_enabled_at IS NULL OR totp_secret_enc IS NOT NULL);

COMMENT ON COLUMN users.totp_secret_enc IS 'Admin TOTP secret, AES-256-GCM encrypted with TOTP_ENCRYPTION_KEY (SEC-1.5)';
COMMENT ON COLUMN users.totp_enabled_at IS 'When the Admin completed TOTP enrolment; NULL = not enrolled';
