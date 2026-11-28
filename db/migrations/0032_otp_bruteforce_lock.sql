-- =====================================================================
-- 0032 — OTP / Admin 2FA brute-force lock (Phase 8, BE-1 / Dev A)
-- Phase 8 BE-1 checklist "rate-limiting against OTP brute-force" · SEC-1.2 · US-HP-05
--
-- Before: each code allowed OTP_MAX_VERIFY_ATTEMPTS (5) wrong tries, and a phone could get
-- OTP_MAX_SENDS_PER_PHONE_PER_HOUR (5) codes — about 25 guesses an hour, forever.
-- Now: wrong codes are also counted per phone over one hour, across every code; at the limit the
-- phone is locked (no verify, no new SMS) for OTP_LOCKOUT_MINUTES. Same for an Admin's
-- authenticator codes, counted per Admin.
--
-- Forward-only: never edit this file after it is merged; add 0033+.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('OTP_MAX_FAILED_VERIFY_PER_PHONE_PER_HOUR', '10', 'NUMBER',
     'Wrong OTP codes per phone within one hour, across all codes, before the phone is locked (also wrong authenticator codes per Admin)'),
    ('OTP_LOCKOUT_MINUTES', '60', 'NUMBER',
     'How long a phone (or an Admin authenticator) stays locked after too many wrong codes')
ON CONFLICT (config_key) DO NOTHING;
