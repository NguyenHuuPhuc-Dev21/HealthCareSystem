-- =====================================================================
-- 0016 — wallets-ledger (BE-3 · Phase 5): travel support ledger type
-- FR-BOOK-02 Layer 3 · BR-15 §2.2 · SRS §5.1 ICU_TRAVEL_SUPPORT
--
-- prescription-rejection (0012, BE-1) records the travel support owed to a
-- nurse whose shift was rejected on site for an invalid medical order
-- (travel_support_status = PENDING). wallets-ledger pays it into the nurse's
-- available balance from the operations fund as ONE append-only ledger row
-- of the new type TRAVEL_SUPPORT (idempotency key travel-support:<rejection id>)
-- and flips the rejection to PAID in the same transaction.
--
-- A dedicated type keeps the ledger honest: it is neither a settlement
-- (ESCROW_RELEASE — no customer escrow is involved) nor an urgent bonus.
--
-- ALTER TYPE ... ADD VALUE is safe inside the migration transaction as long
-- as the new value is not used in the same transaction (it is not).
-- Forward-only: never edit this file after it is merged; add 0017+.
-- =====================================================================

ALTER TYPE tx_type_enum ADD VALUE IF NOT EXISTS 'TRAVEL_SUPPORT';
