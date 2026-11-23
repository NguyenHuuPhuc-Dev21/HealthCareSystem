-- =====================================================================
-- 0017 — deposits (BE-3 · Phase 5) · ADR-0004 D1–D3 · FR-PAY-03 · BR-04 §2.2 · BR-12 §2.3
--
-- 1. Grace period start: when a nurse profile first becomes ACTIVE
--    (PENDING_VERIFICATION → ACTIVE), wallets.deposit_grace_expires_at is set to
--    now() + DEPOSIT_GRACE_DAYS (the wallet is created if needed). Done by a
--    trigger so every activation path (credential-review today, any other later)
--    starts the grace exactly once; COALESCE keeps the first value.
-- 2. nurse_bank_accounts — the nurse's registered payout account (deposit refund,
--    withdrawals). One per nurse.
-- 3. deposit_topups — VietQR top-up intents. The transfer content (payment_code,
--    "KQ…") routes the gateway webhook to the deposit, never to a booking.
--    A top-up never takes deposit_balance above MIN_NURSE_DEPOSIT: any part above
--    the shortfall at payment time is returned by the custody partner
--    (returned_amount), never credited.
-- 4. deposit_penalty_appeals — a nurse's appeal of one PENALTY_DEDUCT, carried by
--    a disputes row (reason_code PENALTY_APPEAL). Append-only.
-- 5. deposit_reconciliations — daily comparison of the deposit mirror ledger with
--    the custody statement (ADR-0004 D1). An unresolved MISMATCH freezes deposit
--    refund payouts.
--
-- Forward-only: never edit this file after it is merged; add 0018+.
-- =====================================================================

-- 1. Grace period starts at the first activation ----------------------------
CREATE OR REPLACE FUNCTION nurse_profiles_start_deposit_grace() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    grace_days NUMERIC;
BEGIN
    IF OLD.profile_status = 'PENDING_VERIFICATION' AND NEW.profile_status = 'ACTIVE' THEN
        SELECT config_value::numeric INTO grace_days
          FROM system_configs WHERE config_key = 'DEPOSIT_GRACE_DAYS';
        IF grace_days IS NOT NULL THEN
            INSERT INTO wallets (user_id, deposit_grace_expires_at)
            VALUES (NEW.user_id, now() + make_interval(days => grace_days::int))
            ON CONFLICT (user_id) DO UPDATE
               SET deposit_grace_expires_at = COALESCE(wallets.deposit_grace_expires_at, EXCLUDED.deposit_grace_expires_at),
                   updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nurse_profiles_deposit_grace ON nurse_profiles;
CREATE TRIGGER trg_nurse_profiles_deposit_grace
    AFTER UPDATE OF profile_status ON nurse_profiles
    FOR EACH ROW EXECUTE FUNCTION nurse_profiles_start_deposit_grace();

-- 2. Registered payout bank account ------------------------------------------
CREATE TABLE nurse_bank_accounts (
    user_id UUID PRIMARY KEY REFERENCES users (id),
    bank_name VARCHAR(100) NOT NULL,
    account_no VARCHAR(30) NOT NULL CHECK (account_no ~ '^[0-9]{6,30}$'),
    account_holder VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE nurse_bank_accounts IS
    'The nurse''s registered payout account, used for the deposit refund (ADR-0004 D3) and withdrawals (FR-PAY-04). The holder name must match the verified identity; the Admin rejects a payout otherwise.';

-- 3. Deposit top-ups ---------------------------------------------------------
CREATE TABLE deposit_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    wallet_id UUID NOT NULL REFERENCES wallets (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    amount BIGINT NOT NULL CHECK (amount > 0),
    payment_code VARCHAR(30) NOT NULL UNIQUE,            -- transfer content / gateway orderCode, "KQ…"
    status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'EXPIRED', 'RETURNED')),
    expires_at TIMESTAMPTZ NOT NULL,
    provider_ref VARCHAR(100),
    credited_amount BIGINT CHECK (credited_amount IS NULL OR credited_amount >= 0),
    returned_amount BIGINT CHECK (returned_amount IS NULL OR returned_amount >= 0),
    transaction_id UUID REFERENCES wallet_transactions (id), -- the TOPUP row
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status <> 'COMPLETED' OR (transaction_id IS NOT NULL AND paid_at IS NOT NULL))
);

CREATE INDEX idx_deposit_topups_nurse ON deposit_topups (nurse_id, created_at);

COMMENT ON TABLE deposit_topups IS
    'Deposit top-up by VietQR (ADR-0004 D2). Paid → one TOPUP ledger row (external_ref = gateway reference) for at most the shortfall to MIN_NURSE_DEPOSIT; the rest is returned by the custody partner (returned_amount). RETURNED = nothing could be credited.';

-- 4. Penalty appeals ---------------------------------------------------------
CREATE TABLE deposit_penalty_appeals (
    transaction_id UUID PRIMARY KEY REFERENCES wallet_transactions (id), -- the PENALTY_DEDUCT row
    dispute_id UUID NOT NULL UNIQUE REFERENCES disputes (id),             -- reason_code PENALTY_APPEAL
    nurse_id UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_deposit_penalty_appeals_no_update
    BEFORE UPDATE ON deposit_penalty_appeals
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_deposit_penalty_appeals_no_delete
    BEFORE DELETE ON deposit_penalty_appeals
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE deposit_penalty_appeals IS
    'One appeal per deposit penalty, within PENALTY_APPEAL_DAYS (ADR-0004 D3). The dispute (reason_code PENALTY_APPEAL) is decided in disputes (Phase 6); upheld → PENALTY_REVERSAL. Append-only.';

-- 5. Daily reconciliation ----------------------------------------------------
CREATE TABLE deposit_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    run_date DATE NOT NULL UNIQUE,                 -- Vietnam date of the run
    wallets_total BIGINT NOT NULL,                 -- Σ wallets.deposit_balance
    ledger_total BIGINT NOT NULL,                  -- Σ signed DEPOSIT ledger movements
    custody_total BIGINT NOT NULL,                 -- custody partner statement (simulated = ledger_total)
    mismatched_wallets INT NOT NULL DEFAULT 0 CHECK (mismatched_wallets >= 0),
    status VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'MISMATCH')),
    details JSONB NOT NULL DEFAULT '[]'::jsonb,    -- first mismatched wallets: [{walletId, balance, ledger}]
    resolved_by UUID REFERENCES users (id),
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (resolved_at IS NULL OR (resolved_by IS NOT NULL AND resolution_note IS NOT NULL))
);

COMMENT ON TABLE deposit_reconciliations IS
    'Daily deposit reconciliation (ADR-0004 D1). MISMATCH without resolved_at freezes deposit refund payouts until an Admin resolves it with a note.';
