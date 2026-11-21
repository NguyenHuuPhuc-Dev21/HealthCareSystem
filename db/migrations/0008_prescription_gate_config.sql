-- =====================================================================
-- 0008 — Prescription gate parameter (Phase 3, BE-1 / Dev A)
-- FR-BOOK-02 Layer 1 · SRS §4.2 Group 2 · BR-15
--
-- "Prescription date must be within 7 days" is a business number, so it
-- lives in system_configs like every other one (zero hardcoding, §5.1).
-- The value 7 is the one written in SRS v2.0 / FR-BOOK-02.
-- Forward-only: never edit this file after it is merged; add 0009+.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('PRESCRIPTION_MAX_AGE_DAYS', '7', 'NUMBER',
     'Maximum age in days of a doctor''s prescription / medical order when booking an invasive service (FR-BOOK-02)')
ON CONFLICT (config_key) DO NOTHING;
