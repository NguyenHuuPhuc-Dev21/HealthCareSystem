-- =====================================================================
-- 0019 — settlement holds (BE-3 · Phase 5) · FR-PAY-02 · SEC-5.10 reconciliation
--
-- A booking whose customer escrow does not hold exactly what the settlement must pay
-- (SettlementInconsistencyError) is put on hold: the settlement sweep alerts once (job error → DLQ)
-- and then skips it until an Admin resolves the hold. Without this, a few broken bookings would
-- be retried at the head of every sweep batch and starve the healthy ones behind them.
--
-- Forward-only: never edit this file after it is merged; add 0020+.
-- =====================================================================

CREATE TABLE settlement_holds (
    booking_id UUID PRIMARY KEY REFERENCES bookings (id),
    reason TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by UUID REFERENCES users (id),
    resolved_at TIMESTAMPTZ,
    resolution_note TEXT,
    CHECK (resolved_at IS NULL OR (resolved_by IS NOT NULL AND resolution_note IS NOT NULL))
);

CREATE INDEX idx_settlement_holds_open ON settlement_holds (detected_at) WHERE resolved_at IS NULL;

COMMENT ON TABLE settlement_holds IS
    'Bookings the settlement sweep skips because their escrow does not match (FR-PAY-02, SEC-5.10). Resolved by an Admin (admin-finance, Phase 7); resolving clears resolved_at IS NULL and the sweep picks the booking up again.';
