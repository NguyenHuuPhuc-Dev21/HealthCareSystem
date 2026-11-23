-- =====================================================================
-- 0014 — Cancellation / timeout / compensation SLA matrix (Phase 5, BE-1 / Dev A)
-- SRS §5.2 · FR-PAY-02/03 · BR-18 §2.1 · BR-02 · BR-16
--
-- 1. The numbers of the §5.2 matrix as system_configs keys (zero hardcoding, §5.1).
--    Values are the ones written in SRS v2.0 §5.2 (not proposals).
--    NO_SHOW_PENALTY and ICU_TRAVEL_SUPPORT already exist (0001).
-- 2. cancellation_outcomes — the decided outcome of a cancelled booking (one row per
--    booking): which §5.2 scenario, who gets / loses what, and whether the nurse and
--    platform shares still have to be paid out of escrow by settlements (BE-3).
--
-- Forward-only: never edit this file after it is merged; add 0015+.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('CUSTOMER_CANCEL_FREE_HOURS', '12', 'NUMBER',
     'Customer cancels more than this many hours before the start: 100% refund (SRS §5.2 row 1)'),
    ('CUSTOMER_CANCEL_LATE_HOURS', '2', 'NUMBER',
     'Customer cancels less than this many hours before the start: last-minute fee (SRS §5.2 row 3)'),
    ('CUSTOMER_CANCEL_NEAR_FEE_RATE', '0.20', 'NUMBER',
     'Cancellation fee between LATE and FREE hours, share of the booking amount (SRS §5.2 row 2)'),
    ('CUSTOMER_CANCEL_NEAR_NURSE_RATE', '0.15', 'NUMBER',
     'Part of that fee paid to the nurse; the platform keeps the rest (SRS §5.2 row 2)'),
    ('CUSTOMER_CANCEL_LATE_FEE_RATE', '0.50', 'NUMBER',
     'Last-minute cancellation fee, share of the booking amount (SRS §5.2 row 3)'),
    ('CUSTOMER_CANCEL_LATE_NURSE_RATE', '0.40', 'NUMBER',
     'Part of that fee paid to the nurse; the platform keeps the rest (SRS §5.2 row 3)'),
    ('NURSE_CANCEL_FREE_HOURS', '12', 'NUMBER',
     'Nurse cancels more than this many hours before the start: no fine (SRS §5.2 row 6)'),
    ('NURSE_LATE_CANCEL_FINE_RATE', '0.20', 'NUMBER',
     'Nurse late-cancellation fine, share of the shift value, taken from the deposit and paid as Urgent Bonus (SRS §5.2 row 7)'),
    ('NO_SHOW_GRACE_MINUTES', '30', 'NUMBER',
     'Minutes after the start without check-in or replacement before the nurse counts as a no-show (SRS §5.2 row 8)'),
    ('TRUST_PENALTY_NURSE_CANCEL_EARLY', '5', 'NUMBER',
     'TrustScore points lost for a nurse cancellation more than NURSE_CANCEL_FREE_HOURS ahead (SRS §5.2 row 6, FR-RATE-01)'),
    ('TRUST_PENALTY_NURSE_CANCEL_LATE', '20', 'NUMBER',
     'TrustScore points lost for a late nurse cancellation (SRS §5.2 row 7, FR-RATE-01)'),
    ('MIN_BILLABLE_HOURS', '1', 'NUMBER',
     'Minimum hours paid when the customer stops a shift after check-in (SRS §5.2 row 4)')
ON CONFLICT (config_key) DO NOTHING;

CREATE TABLE cancellation_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings (id),
    scenario VARCHAR(40) NOT NULL CHECK (scenario IN (
        'CUSTOMER_CANCEL_EARLY', 'CUSTOMER_CANCEL_NEAR', 'CUSTOMER_CANCEL_LATE',
        'CUSTOMER_STOP_AFTER_CHECKIN', 'FORCE_MAJEURE_ICU', 'NURSE_CANCEL_EARLY',
        'NURSE_CANCEL_URGENT', 'NURSE_NO_SHOW', 'UNMATCHED_EXPIRED')),
    actor VARCHAR(10) NOT NULL CHECK (actor IN ('CUSTOMER', 'NURSE', 'SYSTEM')),
    cancelled_by UUID REFERENCES users (id),
    hours_before_start NUMERIC(10, 2),
    payment_method payment_method_enum NOT NULL,
    amount_paid BIGINT NOT NULL CHECK (amount_paid >= 0),           -- held in escrow when decided
    fee_amount BIGINT NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    fee_collected BOOLEAN NOT NULL,                                 -- false: cash fee only recorded (SRS §5.2 note)
    refund_amount BIGINT NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    nurse_compensation BIGINT NOT NULL DEFAULT 0 CHECK (nurse_compensation >= 0),
    platform_share BIGINT NOT NULL DEFAULT 0 CHECK (platform_share >= 0),
    nurse_fine BIGINT NOT NULL DEFAULT 0 CHECK (nurse_fine >= 0),
    urgent_bonus BIGINT NOT NULL DEFAULT 0 CHECK (urgent_bonus >= 0),
    voucher_amount BIGINT NOT NULL DEFAULT 0 CHECK (voucher_amount >= 0),
    travel_support BIGINT NOT NULL DEFAULT 0 CHECK (travel_support >= 0),
    trust_score_delta INT NOT NULL DEFAULT 0 CHECK (trust_score_delta <= 0),
    settlement_status VARCHAR(15) NOT NULL DEFAULT 'NOT_APPLICABLE'
        CHECK (settlement_status IN ('NOT_APPLICABLE', 'PENDING', 'DONE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (refund_amount + nurse_compensation + platform_share <= amount_paid)
);

CREATE INDEX idx_cancellation_outcomes_pending ON cancellation_outcomes (created_at)
    WHERE settlement_status = 'PENDING';

COMMENT ON TABLE cancellation_outcomes IS
    'SRS §5.2 outcome of a cancelled booking. The customer refund is booked at once (REFUND); nurse_compensation and platform_share stay in the customer escrow with settlement_status PENDING until settlements (BE-3) pays them out and sets DONE.';
