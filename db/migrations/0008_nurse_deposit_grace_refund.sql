-- =====================================================================
-- 0008 — Nurse deposit: custody reference, progressive funding (grace
--        period), explained deductions and refund on account closure
--
-- ADR-0004 · FR-PAY-03 · FR-BOOK-03 · BR-04 §2.2 · BR-12 §2.3 · SRS §2.3
--
-- Keeps MIN_NURSE_DEPOSIT = 300,000 VND (team decision 16/11/2026) and adds:
--   * tx types DEPOSIT_WITHHOLD (grace-period withholding from payouts),
--     DEPOSIT_REFUND (payout on account closure) and PENALTY_REVERSAL
--     (an upheld appeal credits a penalty back — the ledger stays append-only);
--   * wallet_transactions.external_ref — reference of the licensed custody
--     partner (bank escrow / e-wallet) for every real money movement;
--   * wallets grace-period and closure columns;
--   * deposit_penalty_details — the "why" of every PENALTY_DEDUCT /
--     PENALTY_REVERSAL (append-only);
--   * deposit_refund_requests — the closure → refund workflow;
--   * six system_configs keys (values proposed in ADR-0004, pending PO).
--
-- ALTER TYPE … ADD VALUE is allowed inside a transaction on PostgreSQL 12+
-- as long as the new values are not used in the same transaction (they are not).
-- Forward-only: never edit this file after it is merged; add 0009+.
-- =====================================================================

-- 1. Ledger transaction types ------------------------------------------------
ALTER TYPE tx_type_enum ADD VALUE IF NOT EXISTS 'DEPOSIT_WITHHOLD';
ALTER TYPE tx_type_enum ADD VALUE IF NOT EXISTS 'DEPOSIT_REFUND';
ALTER TYPE tx_type_enum ADD VALUE IF NOT EXISTS 'PENALTY_REVERSAL';

-- 2. New enums ---------------------------------------------------------------
CREATE TYPE penalty_reason_enum AS ENUM
    ('NURSE_LATE_CANCEL',   -- SRS §5.2 row 7: 20% of shift value
     'NURSE_NO_SHOW',       -- SRS §5.2 row 8: NO_SHOW_PENALTY
     'DISPUTE_UPHELD');     -- FR-DISP-01: RESOLVED_CUSTOMER on a cash booking

CREATE TYPE deposit_refund_status_enum AS ENUM
    ('REQUESTED',      -- nurse asked to close the account; no new jobs from now on
     'WAITING_HOLD',   -- at least one eligibility condition still pending
     'READY',          -- all conditions met; payout due within the SLA
     'REFUNDED',       -- paid out (DEPOSIT_REFUND transaction exists)
     'REJECTED',       -- Admin rejected with a written reason (money is not forfeited)
     'CANCELLED');     -- nurse withdrew the request before READY

-- 3. Custody partner reference on the ledger ---------------------------------
-- Adding a nullable column does not fire the append-only row triggers.
ALTER TABLE wallet_transactions
    ADD COLUMN external_ref VARCHAR(100);

COMMENT ON COLUMN wallet_transactions.external_ref IS
    'Reference returned by the licensed custody partner (bank escrow / e-wallet) for a real money movement: TOPUP, DEPOSIT_WITHHOLD, DEPOSIT_REFUND, WITHDRAW. NULL for purely internal moves and in the simulated (demo) scope. ADR-0004 D1.';

-- 4. Wallet: grace period and closure ----------------------------------------
ALTER TABLE wallets
    ADD COLUMN deposit_grace_expires_at TIMESTAMPTZ,
    ADD COLUMN deposit_grace_shifts_used SMALLINT NOT NULL DEFAULT 0
        CHECK (deposit_grace_shifts_used >= 0),
    ADD COLUMN custody_account_ref VARCHAR(100),
    ADD COLUMN closure_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN wallets.deposit_grace_expires_at IS
    'Set to now() + DEPOSIT_GRACE_DAYS when the nurse profile first becomes ACTIVE. While now() < this value, deposit_grace_shifts_used < DEPOSIT_GRACE_MAX_SHIFTS and deposit_balance < MIN_NURSE_DEPOSIT, the nurse may accept BANK_TRANSFER bookings only (ADR-0004 D2).';
COMMENT ON COLUMN wallets.custody_account_ref IS
    'Identifier of the nurse''s deposit sub-account at the custody partner (ADR-0004 D1).';
COMMENT ON COLUMN wallets.closure_requested_at IS
    'Set when the nurse requests account closure; the matching engine must not offer new jobs from then on (ADR-0004 D3).';

-- 5. Why each penalty was taken (append-only) --------------------------------
CREATE TABLE deposit_penalty_details (
    transaction_id UUID PRIMARY KEY REFERENCES wallet_transactions (id),
    reason penalty_reason_enum NOT NULL,
    sla_rule_ref VARCHAR(30) NOT NULL,            -- e.g. 'SRS §5.2 row 7'
    booking_id UUID REFERENCES bookings (id),
    dispute_id UUID REFERENCES disputes (id),
    note TEXT,
    appeal_deadline TIMESTAMPTZ,                  -- NULL = not appealable (DISPUTE_UPHELD)
    reverses_transaction_id UUID REFERENCES wallet_transactions (id), -- set only on a PENALTY_REVERSAL row
    decided_by UUID REFERENCES users (id),        -- NULL = automatic (system)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (reason <> 'DISPUTE_UPHELD' OR dispute_id IS NOT NULL),
    CHECK (reverses_transaction_id IS NULL OR reverses_transaction_id <> transaction_id)
);

CREATE UNIQUE INDEX uq_deposit_penalty_reversal_once
    ON deposit_penalty_details (reverses_transaction_id)
    WHERE reverses_transaction_id IS NOT NULL;

CREATE TRIGGER trg_deposit_penalty_details_no_update
    BEFORE UPDATE ON deposit_penalty_details
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_deposit_penalty_details_no_delete
    BEFORE DELETE ON deposit_penalty_details
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE deposit_penalty_details IS
    'One row per PENALTY_DEDUCT or PENALTY_REVERSAL wallet transaction: reason, SLA rule, booking, dispute and appeal deadline shown to the nurse. Append-only (ADR-0004 D3).';

-- 6. Account closure → deposit refund ----------------------------------------
CREATE TABLE deposit_refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    wallet_id UUID NOT NULL REFERENCES wallets (id),
    status deposit_refund_status_enum NOT NULL DEFAULT 'REQUESTED',
    pending_reasons JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["ACTIVE_BOOKING","HOLD_DAYS","OPEN_DISPUTE","UNPAID_COMMISSION"]
    eligible_at TIMESTAMPTZ,                     -- earliest date all conditions can clear
    refund_amount BIGINT CHECK (refund_amount IS NULL OR refund_amount >= 0),
    bank_name VARCHAR(100),
    bank_account_no VARCHAR(30),
    account_holder VARCHAR(150),
    transaction_id UUID REFERENCES wallet_transactions (id), -- the DEPOSIT_REFUND row
    due_by TIMESTAMPTZ,                          -- READY + DEPOSIT_REFUND_SLA_WORKING_DAYS
    reviewed_by UUID REFERENCES users (id),
    reject_reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'REFUNDED' OR (transaction_id IS NOT NULL AND refund_amount IS NOT NULL)),
    CHECK (status <> 'REJECTED' OR reject_reason IS NOT NULL)
);

-- At most one open request per wallet.
CREATE UNIQUE INDEX uq_deposit_refund_open
    ON deposit_refund_requests (wallet_id)
    WHERE status IN ('REQUESTED', 'WAITING_HOLD', 'READY');

CREATE INDEX idx_deposit_refund_status ON deposit_refund_requests (status, due_by);

COMMENT ON TABLE deposit_refund_requests IS
    'Account closure and deposit refund workflow (SRS §2.3, BR-12 §2.3, ADR-0004 D3). READY only when: no CONFIRMED/IN_PROGRESS booking, DEPOSIT_REFUND_HOLD_DAYS since last check-out, no OPEN/UNDER_REVIEW dispute, no unpaid cash commission.';

-- 7. Configuration (values proposed in ADR-0004, pending PO approval) --------
INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('DEPOSIT_GRACE_MAX_SHIFTS', '3', 'NUMBER',
     'Max transfer-paid shifts a nurse may complete while the deposit is below MIN_NURSE_DEPOSIT (ADR-0004 D2)'),
    ('DEPOSIT_GRACE_DAYS', '30', 'NUMBER',
     'Days after first activation during which the deposit grace period applies (ADR-0004 D2)'),
    ('DEPOSIT_WITHHOLD_RATE', '0.30', 'NUMBER',
     'Share of each settled net payout withheld into deposit_balance until it reaches MIN_NURSE_DEPOSIT (ADR-0004 D2)'),
    ('DEPOSIT_REFUND_HOLD_DAYS', '7', 'NUMBER',
     'Dispute-free days after the last check-out before the deposit can be refunded on account closure (SRS §2.3)'),
    ('DEPOSIT_REFUND_SLA_WORKING_DAYS', '5', 'NUMBER',
     'Working days to pay out a READY deposit refund (ADR-0004 D3)'),
    ('PENALTY_APPEAL_DAYS', '3', 'NUMBER',
     'Days a nurse has to contest an automatic deposit penalty (ADR-0004 D3)')
ON CONFLICT (config_key) DO NOTHING;
