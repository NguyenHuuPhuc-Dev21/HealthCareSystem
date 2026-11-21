-- =====================================================================
-- 0012 — On-site rejection of an invalid medical order (Phase 4, BE-1 / Dev A)
-- FR-BOOK-02 Layer 3 · BR-15 §2.2 · BR-07 · RISK-01
--
-- When the nurse finds the paper prescription forged, altered, expired or not
-- matching the medication, she rejects the shift with photo evidence: the
-- booking is cancelled, she is not penalised, and she is owed the fixed
-- travel support (ICU_TRAVEL_SUPPORT, 50,000 VND) from the operations fund.
--
-- 1. prescription_rejections — one row per rejected booking: the evidence,
--    the reason, and the travel support owed. The payout itself is done by
--    wallets-ledger (BE-3, Phase 5), which flips travel_support_status to PAID.
-- 2. PRESCRIPTION_REJECTION_WINDOW_MINUTES — the action opens this many
--    minutes before the scheduled start, so a shift cannot be dropped days
--    ahead without penalty. PROPOSED value, pending PO approval; to be
--    replaced by "after check-in" once check-in (BE-2) exists.
--
-- Forward-only: never edit this file after it is merged; add 0013+.
-- =====================================================================

CREATE TABLE prescription_rejections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
    evidence_file_url VARCHAR(500) NOT NULL, -- private storage key (category prescription-rejection)
    refunded_amount BIGINT NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    travel_support_amount BIGINT NOT NULL CHECK (travel_support_amount >= 0),
    travel_support_status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (travel_support_status IN ('PENDING', 'PAID')),
    travel_support_paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((travel_support_status = 'PAID') = (travel_support_paid_at IS NOT NULL))
);

CREATE INDEX idx_prescription_rejections_nurse ON prescription_rejections (nurse_id, created_at);
CREATE INDEX idx_prescription_rejections_unpaid ON prescription_rejections (created_at)
    WHERE travel_support_status = 'PENDING';

COMMENT ON TABLE prescription_rejections IS
    'FR-BOOK-02 Layer 3: a shift rejected on site for an invalid medical order. No penalty for the nurse; travel_support_amount (ICU_TRAVEL_SUPPORT at the time) is owed from the operations fund and paid by wallets-ledger.';

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('PRESCRIPTION_REJECTION_WINDOW_MINUTES', '60', 'NUMBER',
     'The nurse can reject a shift for an invalid medical order from this many minutes before its start (FR-BOOK-02 Layer 3; proposed, pending PO)')
ON CONFLICT (config_key) DO NOTHING;
