-- =====================================================================
-- 0006 — Support for privacy-consent (BE-3) — written by BE-1 (migration owner)
-- FR-PRIV-01 · NFR-PRIV-02 · NFR-SEC-01.6 · US-HP-03 · BR-09 §2.3 · BR-17
-- Requested by BE-3 in the privacy-consent design ("Các điểm cần nhóm thống nhất" 1–3).
-- =====================================================================

-- 1–2. Parameters (read through core/config — no hardcoded numbers).
INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    -- NOT specified in SRS v2.0 (open decision): PROPOSED value, pending PO approval.
    -- 24 h matches the dispute window during which an Admin re-grants access (BR-09 §2.3).
    ('RECORD_ACCESS_GRANT_MAX_HOURS', '24', 'NUMBER',
     'Maximum hours an Admin re-grant of medical-record access may last (FR-PRIV-01; proposed, pending PO)'),
    -- Specified: NFR-PRIV-02 — at most 24 months after shift completion, then archive/anonymize.
    ('MEDICAL_RECORD_RETENTION_MONTHS', '24', 'NUMBER',
     'Months medical records stay in active storage after shift completion before archive/anonymization (NFR-PRIV-02)')
ON CONFLICT (config_key) DO NOTHING;

-- 3. Consent withdrawal timestamp (US-HP-03 AC: "the withdrawal is recorded with a timestamp").
--    Withdraw: data_consent_accepted = FALSE, consent_withdrawn_at = now().
--    Re-grant later (TC-USHP03-03): data_consent_accepted = TRUE, consent_timestamp = now();
--    consent_withdrawn_at keeps the LAST withdrawal time, so it must be older than the new consent.
ALTER TABLE patient_profiles
    ADD COLUMN consent_withdrawn_at TIMESTAMPTZ;

ALTER TABLE patient_profiles
    ADD CONSTRAINT chk_patient_profiles_consent_withdrawal
        CHECK (
            consent_withdrawn_at IS NULL
            OR data_consent_accepted = FALSE
            OR consent_timestamp > consent_withdrawn_at
        );

COMMENT ON COLUMN patient_profiles.consent_withdrawn_at IS
    'Last time health-data consent was withdrawn (US-HP-03). While data_consent_accepted = FALSE no new processing or record sharing is allowed.';
