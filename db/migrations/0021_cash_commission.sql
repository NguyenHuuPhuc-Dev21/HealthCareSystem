-- =====================================================================
-- 0021 — cash-commission (BE-3 · Phase 5) · FR-PAY-02 (cash part) · BR-05
--
-- On a CASH booking the customer pays the nurse on site; the nurse then self-transfers
-- the platform commission (the booking's platform_fee, 15%) within the deadline
-- bookings.commission_due_at (set at check-out, BE-2). One payment code per booking:
--   payment_code "HH…" = transfer content / gateway orderCode, routed by the escrow webhook.
-- Paid → one COMMISSION_PAYMENT ledger row (external_ref = gateway reference) that moves
-- NO balance (the nurse pays from her own bank account; the commission is never taken
-- from deposit_balance or available_balance) → booking SETTLED.
-- Unpaid after the deadline → nurse profile SUSPENDED (suspended_reason COMMISSION_OVERDUE)
-- until every overdue commission is paid.
--
-- Forward-only: never edit this file after it is merged; add 0022+.
-- =====================================================================

CREATE TABLE commission_payments (
    booking_id UUID PRIMARY KEY REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_code VARCHAR(30) NOT NULL UNIQUE,
    provider_ref VARCHAR(100),
    transaction_id UUID REFERENCES wallet_transactions (id), -- the COMMISSION_PAYMENT row
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((paid_at IS NULL) = (transaction_id IS NULL))
);

CREATE INDEX idx_commission_payments_nurse ON commission_payments (nurse_id, created_at);

COMMENT ON TABLE commission_payments IS
    'FR-PAY-02 cash bookings: the payment code the nurse uses to self-transfer the platform commission, and its payment. The commission is never taken from the deposit or the available balance.';

-- Overdue sweep: completed cash bookings with a commission deadline, not yet settled.
CREATE INDEX idx_bookings_commission_due ON bookings (commission_due_at)
    WHERE payment_method = 'CASH' AND commission_due_at IS NOT NULL AND settled_at IS NULL;
