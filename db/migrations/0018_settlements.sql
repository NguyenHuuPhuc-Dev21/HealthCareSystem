-- =====================================================================
-- 0018 — settlements (BE-3 · Phase 5) · FR-PAY-02 · BR-04 §2.1 · ADR-0004 D2 · SRS §5.2 rows 2–4
--
-- One row per booking whose customer escrow was paid out:
--   SHIFT         a bank-transfer shift, released at check-out + SETTLEMENT_COOLING_HOURS with no dispute,
--                 earlier when the customer confirms completion, or when a dispute is resolved for the nurse.
--                 gross = booking total; commission = booking platform_fee (15%, priced in); net = gross − commission.
--   CANCELLATION  the nurse / platform shares kept in escrow by cancellation-policy (settlement_status PENDING).
--
-- net is split into deposit_withheld (ADR-0004 D2: min(DEPOSIT_WITHHOLD_RATE × net, shortfall) while the deposit
-- is below MIN_NURSE_DEPOSIT, DEPOSIT_WITHHOLD) and payout (ESCROW_RELEASE to available_balance). grace_shift = the
-- shift was worked while the deposit was short: wallets.deposit_grace_shifts_used + 1 in the same transaction.
-- The platform commission is this table's commission_amount: the customer escrow is released by `gross`,
-- the nurse receives `net`. Append-only.
--
-- Forward-only: never edit this file after it is merged; add 0019+.
-- =====================================================================

CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL UNIQUE REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    kind VARCHAR(15) NOT NULL CHECK (kind IN ('SHIFT', 'CANCELLATION')),
    trigger VARCHAR(20) NOT NULL
        CHECK (trigger IN ('COOLING_ELAPSED', 'CUSTOMER_CONFIRMED', 'DISPUTE_RELEASED', 'CANCELLATION_SHARE')),
    gross_amount BIGINT NOT NULL CHECK (gross_amount >= 0),
    commission_amount BIGINT NOT NULL CHECK (commission_amount >= 0),
    net_amount BIGINT NOT NULL CHECK (net_amount >= 0),
    deposit_withheld BIGINT NOT NULL DEFAULT 0 CHECK (deposit_withheld >= 0),
    payout_amount BIGINT NOT NULL CHECK (payout_amount >= 0),
    grace_shift BOOLEAN NOT NULL DEFAULT FALSE,
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (gross_amount = commission_amount + net_amount),
    CHECK (net_amount = deposit_withheld + payout_amount)
);

CREATE INDEX idx_settlements_nurse ON settlements (nurse_id, settled_at);
CREATE INDEX idx_settlements_settled_at ON settlements (settled_at);

CREATE TRIGGER trg_settlements_no_update
    BEFORE UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_settlements_no_delete
    BEFORE DELETE ON settlements
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE settlements IS
    'FR-PAY-02: one payout of a customer escrow per booking (shift or cancellation shares). gross = commission + net; net = deposit_withheld + payout. Platform revenue = Σ commission_amount. Append-only.';

-- Candidates of the settlement sweep: checked-out shifts still held.
CREATE INDEX idx_bookings_settlement_due ON bookings (nurse_id)
    WHERE payment_status = 'ESCROW_HELD' AND settled_at IS NULL AND payment_method = 'BANK_TRANSFER';
