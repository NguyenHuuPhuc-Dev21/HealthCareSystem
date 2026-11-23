-- =====================================================================
-- 0015 — Two-way blind reviews and TrustScore (Phase 6, BE-1 / Dev A)
-- FR-RATE-01 · BR-18 §2.5 · BR-02 · SRS §4.6, §5.2 rows 6–7
--
-- 1. trust_score_events — every TrustScore change, append-only: why, by how much,
--    the score before and after, and the booking it is about. One event per
--    (nurse, reason, booking), so a retried caller can never deduct twice.
-- 2. Parameters (system_configs):
--      SRS values:   TRUST_PENALTY_DISPUTE_UPHELD 25, TRUST_RECOVERY_GOOD_RATING 2,
--                    TRUST_RECOVERY_MIN_STARS 4, TRUST_SUSPEND_BELOW 60, REVIEW_BLIND_DAYS 7
--      PROPOSED:     REVIEW_WINDOW_DAYS 7 (how long after the shift a review can be sent;
--                    not in SRS v2.0) — pending PO approval.
--
-- Forward-only: never edit this file after it is merged; add 0016+.
-- =====================================================================

CREATE TABLE trust_score_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    nurse_id UUID NOT NULL REFERENCES users (id),
    reason VARCHAR(30) NOT NULL CHECK (reason IN (
        'CANCEL_OVER_12H', 'CANCEL_WITHIN_12H', 'DISPUTE_UPHELD', 'GOOD_RATING_RECOVERY', 'ADMIN_ADJUSTMENT')),
    requested_delta INT NOT NULL,
    applied_delta INT NOT NULL,                       -- after clamping to 0..100
    score_before INT NOT NULL CHECK (score_before BETWEEN 0 AND 100),
    score_after INT NOT NULL CHECK (score_after BETWEEN 0 AND 100),
    booking_id UUID REFERENCES bookings (id),
    note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
    created_by UUID REFERENCES users (id),            -- NULL = system
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (score_after = score_before + applied_delta)
);

CREATE UNIQUE INDEX uq_trust_score_events_once_per_booking
    ON trust_score_events (nurse_id, reason, booking_id)
    WHERE booking_id IS NOT NULL;

CREATE INDEX idx_trust_score_events_nurse ON trust_score_events (nurse_id, created_at DESC);

CREATE TRIGGER trg_trust_score_events_no_update
    BEFORE UPDATE ON trust_score_events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_trust_score_events_no_delete
    BEFORE DELETE ON trust_score_events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE trust_score_events IS
    'FR-RATE-01: history of nurse_profiles.trust_score. Written only by reviews-trustscore applyTrustScoreChange, in the same transaction as the score update. Append-only.';

-- Hidden reviews waiting for the 7-day reveal.
CREATE INDEX IF NOT EXISTS idx_reviews_hidden ON reviews (booking_id) WHERE NOT is_visible;

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('REVIEW_BLIND_DAYS', '7', 'NUMBER',
     'Reviews stay hidden until both sides have reviewed or this many days after the shift ended (FR-RATE-01)'),
    ('REVIEW_WINDOW_DAYS', '7', 'NUMBER',
     'A review can be sent up to this many days after the shift ended (proposed, pending PO; not in SRS v2.0)'),
    ('TRUST_PENALTY_DISPUTE_UPHELD', '25', 'NUMBER',
     'TrustScore points lost when a customer dispute against the nurse is upheld (FR-RATE-01, FR-DISP-01)'),
    ('TRUST_RECOVERY_GOOD_RATING', '2', 'NUMBER',
     'TrustScore points regained for each completed shift the customer rated at least TRUST_RECOVERY_MIN_STARS (FR-RATE-01; capped at 100)'),
    ('TRUST_RECOVERY_MIN_STARS', '4', 'NUMBER',
     'Minimum customer rating (stars) that earns the TrustScore recovery (FR-RATE-01)'),
    ('TRUST_SUSPEND_BELOW', '60', 'NUMBER',
     'A nurse whose TrustScore falls below this value is SUSPENDED automatically (FR-RATE-01)')
ON CONFLICT (config_key) DO NOTHING;
