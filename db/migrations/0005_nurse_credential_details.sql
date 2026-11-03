-- =====================================================================
-- 0005 — Credential details for nurse-onboarding (Phase 1, BE-1 / Dev A)
-- FR-AUTH-01 / BR-21 §2.1 / US-HP-04 AC-01: a GPHN is submitted with its
-- number, issue date, expiry date, issuing authority and scope of practice.
--
-- Why on nurse_credentials (and not only nurse_profiles): a submitted or
-- renewed GPHN must stay "pending" on its own row until an Admin approves it.
-- credential-review copies the APPROVED values into nurse_profiles
-- (gphn_number, gphn_expiry_date, scope_of_practice), which the daily tier
-- sweep reads. nurse_profiles therefore only ever holds approved data.
-- =====================================================================

ALTER TABLE nurse_credentials
    ADD COLUMN document_number   VARCHAR(50),
    ADD COLUMN issuing_authority VARCHAR(255),
    ADD COLUMN scope_of_practice VARCHAR(255),
    ADD COLUMN document_side     VARCHAR(5);

ALTER TABLE nurse_credentials
    -- CCCD is stored as two rows: FRONT and BACK. Other documents have no side.
    ADD CONSTRAINT chk_nurse_credentials_side
        -- (IS NOT NULL is required: "NULL IN (...)" is unknown, which CHECK would accept)
        CHECK ((doc_type = 'CCCD' AND document_side IS NOT NULL AND document_side IN ('FRONT', 'BACK'))
            OR (doc_type <> 'CCCD' AND document_side IS NULL)),
    -- A GPHN is meaningless without its number and expiry date (tier sweep input).
    ADD CONSTRAINT chk_nurse_credentials_gphn_fields
        CHECK (doc_type <> 'GPHN' OR (document_number IS NOT NULL AND expiry_date IS NOT NULL));

COMMENT ON COLUMN nurse_credentials.document_number IS 'GPHN number (or other document number); FR-AUTH-01';
COMMENT ON COLUMN nurse_credentials.issuing_authority IS 'Authority that issued the GPHN; FR-AUTH-01';
COMMENT ON COLUMN nurse_credentials.scope_of_practice IS 'GPHN scope of practice as submitted; copied to nurse_profiles on approval';
COMMENT ON COLUMN nurse_credentials.document_side IS 'FRONT/BACK for CCCD rows only';
