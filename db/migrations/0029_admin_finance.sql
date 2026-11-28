-- =====================================================================
-- 0029 — admin-finance (BE-3 · Phase 7) · FR-ADMIN-01 "Financial Ledger & Reconciliation" · CT-15
--
-- Admin finance actions are audited (Phase 7 exit criterion: every Admin action writes audit_logs):
--   PROCESS_WITHDRAWAL       withdrawal paid (WITHDRAWN) or rejected (money back to available)
--   PROCESS_DEPOSIT_REFUND   closure refund paid (DEPOSIT_REFUND) or rejected with a reason (ADR-0004 D3)
--   RESOLVE_FINANCE_HOLD     a deposit reconciliation mismatch or a settlement hold explained / corrected
--   EXPORT_FINANCE_REPORT    the ledger audit trail exported (who exported which period)
-- The reconciliation report itself reads the ledger; it adds no table.
--
-- ALTER TYPE … ADD VALUE is fine inside the migration transaction: the new values are not used in this file.
-- Forward-only: never edit this file after it is merged; add 0030+.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'PROCESS_WITHDRAWAL';
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'PROCESS_DEPOSIT_REFUND';
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'RESOLVE_FINANCE_HOLD';
ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'EXPORT_FINANCE_REPORT';

-- Period reports read the ledger by time and type.
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created_type ON wallet_transactions (created_at, tx_type);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_payments_paid ON commission_payments (paid_at) WHERE paid_at IS NOT NULL;
