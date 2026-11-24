-- =====================================================================
-- 0020 — withdrawals (BE-3 · Phase 5) · FR-PAY-04
--
-- withdrawal_requests (0001) already holds the request, its WITHDRAW ledger row and
-- the bank details copied at request time. Added here:
--   payout_ref       bank / payout partner reference of the transfer, set when the
--                    Admin marks the request WITHDRAWN (the WITHDRAW ledger row is
--                    append-only and written at request time, before the transfer).
--   reversal_transaction_id  the credit that gives the money back when the request is
--                    REJECTED (the original WITHDRAW row is never edited).
--   idempotency_key  the client's Idempotency-Key: a retried request returns the
--                    first withdrawal instead of taking the money twice.
--
-- Forward-only: never edit this file after it is merged; add 0021+.
-- =====================================================================

ALTER TABLE withdrawal_requests
    ADD COLUMN payout_ref VARCHAR(100),
    ADD COLUMN reversal_transaction_id UUID REFERENCES wallet_transactions (id),
    ADD COLUMN idempotency_key VARCHAR(100) UNIQUE,
    ADD CONSTRAINT chk_withdrawal_rejected_reversed
        CHECK (status <> 'REJECTED' OR (reject_reason IS NOT NULL AND reversal_transaction_id IS NOT NULL)),
    ADD CONSTRAINT chk_withdrawal_reviewed
        CHECK (status = 'WITHDRAW_REQUESTED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL));

CREATE INDEX idx_withdrawal_requests_pending ON withdrawal_requests (created_at)
    WHERE status = 'WITHDRAW_REQUESTED';

COMMENT ON COLUMN withdrawal_requests.payout_ref IS
    'Reference of the bank transfer to the nurse, set when the request becomes WITHDRAWN (FR-PAY-04).';
COMMENT ON COLUMN withdrawal_requests.reversal_transaction_id IS
    'Ledger credit that returned the money to available_balance when the request was REJECTED.';
