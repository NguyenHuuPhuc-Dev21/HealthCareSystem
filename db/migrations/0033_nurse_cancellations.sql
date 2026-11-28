-- =====================================================================
-- 0033 — Nurse cancels an accepted shift (BE-1 / Dev A · SRS §5.2 rows 6–7)
-- BR-18 §2.1 · FR-RATE-01 · ADR-0004 D3 (fine from the deposit)
--
-- cancellation_outcomes (0014) holds ONE outcome per booking — the end of the booking. A nurse cancelling
-- does not end the booking: it goes back to MATCHING, may be taken and cancelled by another nurse, and may
-- still be cancelled by the customer later. So each nurse cancellation is its own row here.
--
--   row 6  NURSE_CANCEL_EARLY   > NURSE_CANCEL_FREE_HOURS before start  → −TRUST_PENALTY_NURSE_CANCEL_EARLY
--   row 7  NURSE_CANCEL_URGENT  ≤ NURSE_CANCEL_FREE_HOURS before start  → −TRUST_PENALTY_NURSE_CANCEL_LATE and
--          NURSE_LATE_CANCEL_FINE_RATE × total from the deposit (deposits.deductPenalty, appealable), the same
--          amount added to bookings.urgent_bonus_amount for whoever takes the shift instead.
--
-- Append-only (forbid_mutation). Forward-only: never edit this file after it is merged; add 0034+.
-- =====================================================================

CREATE TABLE nurse_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    scenario VARCHAR(30) NOT NULL CHECK (scenario IN ('NURSE_CANCEL_EARLY', 'NURSE_CANCEL_URGENT')),
    reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    hours_before_start NUMERIC(10, 2) NOT NULL,
    total_amount BIGINT NOT NULL CHECK (total_amount >= 0),
    fine_amount BIGINT NOT NULL DEFAULT 0 CHECK (fine_amount >= 0),
    trust_score_delta INT NOT NULL CHECK (trust_score_delta <= 0),
    penalty_transaction_id UUID REFERENCES wallet_transactions (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (booking_id, nurse_id),
    CHECK (scenario = 'NURSE_CANCEL_URGENT' OR fine_amount = 0)
);

CREATE INDEX idx_nurse_cancellations_nurse ON nurse_cancellations (nurse_id, created_at DESC);

CREATE TRIGGER trg_nurse_cancellations_no_update
    BEFORE UPDATE ON nurse_cancellations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_nurse_cancellations_no_delete
    BEFORE DELETE ON nurse_cancellations
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE nurse_cancellations IS
    'SRS §5.2 rows 6–7: a nurse gave back an accepted shift. Written only by cancellation-policy nurse-cancel, in the transaction that releases the booking. Append-only.';
