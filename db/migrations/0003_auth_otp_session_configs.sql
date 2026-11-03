-- =====================================================================
-- 0003 — Authentication parameters for accounts-otp (Phase 1, BE-1 / Dev A)
--
-- SRS v2.0 does not fix these values (open decision OD-09). They are
-- PROPOSED values taken from docs/security/sec-01 (SEC-1.2 / SEC-1.7):
--   OTP ≥ 6 digits, validity ≤ 5 min, lock after 5 wrong attempts,
--   server-side resend interval + hourly caps, short Admin idle timeout.
-- They live in system_configs so the Product Owner can change them from the
-- Admin config screen (Phase 7) without a deploy.
-- STATUS: pending PO approval — if the PO picks other numbers, add 0004 with
-- UPDATEs; never edit this file after merge.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('OTP_LENGTH', '6', 'NUMBER',
     'Number of digits in a login OTP (SEC-1.2: minimum 6)'),
    ('OTP_TTL_SECONDS', '300', 'NUMBER',
     'Login OTP validity in seconds (SEC-1.2: at most 5 minutes)'),
    ('OTP_MAX_VERIFY_ATTEMPTS', '5', 'NUMBER',
     'Wrong OTP attempts before the code is invalidated and a new one must be requested'),
    ('OTP_RESEND_COOLDOWN_SECONDS', '60', 'NUMBER',
     'Minimum seconds between two OTP requests for the same phone number'),
    ('OTP_MAX_SENDS_PER_PHONE_PER_HOUR', '5', 'NUMBER',
     'Maximum OTP SMS sent to one phone number per rolling hour'),
    ('OTP_MAX_SENDS_PER_IP_PER_HOUR', '20', 'NUMBER',
     'Maximum OTP requests from one client IP per hour (SMS-toll-fraud defence)'),
    ('ACCESS_TOKEN_TTL_MINUTES', '15', 'NUMBER',
     'Lifetime of an access token in minutes'),
    ('REFRESH_TOKEN_TTL_DAYS', '30', 'NUMBER',
     'Lifetime of a Patient/Nurse refresh token (per device) in days'),
    ('ADMIN_SESSION_IDLE_MINUTES', '30', 'NUMBER',
     'Admin Portal idle timeout: Admin refresh tokens expire after this many idle minutes (SEC-1.7)')
ON CONFLICT (config_key) DO NOTHING;
