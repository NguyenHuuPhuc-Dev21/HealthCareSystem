-- =====================================================================
-- 0022 — disputes (BE-3 · Phase 6) · FR-DISP-01 · FR-DISP-02 (MVP outcomes) · ADR-0004 D3
--
-- disputes (0001) holds who opened it, the reason (reason_code = category, or
-- PENALTY_APPEAL for a deposit-penalty appeal, deposits module) and the opener's evidence.
-- Added here:
--   * the counter-party's rebuttal (text, ≤ 5 evidence keys, who, when) and its deadline
--     rebuttal_due_at = opened + DISPUTE_REBUTTAL_HOURS; a rebuttal moves OPEN → UNDER_REVIEW;
--   * what the resolution did: trust_score_delta, deposit_deducted (refund_amount /
--     release_amount already exist), updated_at;
--   * at most one open (OPEN / UNDER_REVIEW) booking dispute per booking — opening one also
--     sets bookings.dispute_status = OPEN under the booking lock, which freezes the settlement.
--
--   * resolved_by / resolved_at are set by DisputesService.resolve; no CHECK on them, because
--     seeds and other modules' tests insert closed disputes directly.
--
-- Forward-only: never edit this file after it is merged; add 0023+.
-- =====================================================================

ALTER TABLE disputes
    ADD COLUMN rebuttal_text TEXT CHECK (rebuttal_text IS NULL OR char_length(rebuttal_text) <= 2000),
    ADD COLUMN rebuttal_evidence_urls JSONB
        CHECK (rebuttal_evidence_urls IS NULL
               OR (jsonb_typeof(rebuttal_evidence_urls) = 'array' AND jsonb_array_length(rebuttal_evidence_urls) <= 5)),
    ADD COLUMN rebuttal_by UUID REFERENCES users (id),
    ADD COLUMN rebuttal_at TIMESTAMPTZ,
    ADD COLUMN rebuttal_due_at TIMESTAMPTZ,
    ADD COLUMN trust_score_delta INT CHECK (trust_score_delta IS NULL OR trust_score_delta <= 0),
    ADD COLUMN deposit_deducted BIGINT CHECK (deposit_deducted IS NULL OR deposit_deducted >= 0),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD CONSTRAINT chk_disputes_rebuttal_complete
        CHECK ((rebuttal_at IS NULL) = (rebuttal_text IS NULL) AND (rebuttal_at IS NULL) = (rebuttal_by IS NULL));

CREATE UNIQUE INDEX uq_disputes_one_open_per_booking
    ON disputes (booking_id)
    WHERE status IN ('OPEN', 'UNDER_REVIEW') AND reason_code IS DISTINCT FROM 'PENALTY_APPEAL';

CREATE INDEX idx_disputes_raised_by ON disputes (raised_by_id, created_at);
-- idx_disputes_open (status) WHERE status IN ('OPEN','UNDER_REVIEW') already exists from 0001.

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('DISPUTE_REBUTTAL_HOURS', '24', 'NUMBER',
     'Hours the counter-party has to submit a rebuttal after a dispute is opened (FR-DISP-01)')
ON CONFLICT (config_key) DO NOTHING;
