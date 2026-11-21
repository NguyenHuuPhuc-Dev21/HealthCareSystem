-- =====================================================================
-- 0013 — In-session shift extension (Phase 4, BE-1 / Dev A)
-- FR-SHIFT-03 · BR-15 §2.3 · BR-13 · SRS §4.4
--
-- An extension is a booking_adjustments row (adjustment_type = 'EXTENSION'):
--   REQUESTED  customer asked (price fixed at that moment)
--   REJECTED   nurse declined
--   ACCEPTED   nurse agreed — CASH: applied at once (applied_at set);
--              BANK_TRANSFER: waits for the payment until payment_expires_at
--   PAID       bank transfer received into escrow and applied
--   EXPIRED    nurse never answered before the shift end, or payment not received in time
-- "Applied" = bookings.end_time and the amount columns were increased.
--
-- New parameters (system_configs), PROPOSED values pending PO approval:
--   EXTENSION_REQUEST_DEADLINE_MINUTES = 30  last request at scheduled end − 30 min (SRS wording
--                                            "ít nhất 30 phút trước khi kết thúc ca")
--   MAX_EXTENSION_HOURS                = 4   per request (SRS gives no maximum; same as the FE mock)
--
-- ALTER TYPE … ADD VALUE is fine inside the migration transaction on PostgreSQL 12+
-- because the new value is not used in this file.
-- Forward-only: never edit this file after it is merged; add 0014+.
-- =====================================================================

ALTER TYPE adjustment_status_enum ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE booking_adjustments
    ADD COLUMN responded_by UUID REFERENCES users (id),
    ADD COLUMN decline_reason TEXT CHECK (decline_reason IS NULL OR char_length(decline_reason) <= 500),
    ADD COLUMN extra_base_amount BIGINT CHECK (extra_base_amount IS NULL OR extra_base_amount >= 0),
    ADD COLUMN extra_surcharge_amount BIGINT CHECK (extra_surcharge_amount IS NULL OR extra_surcharge_amount >= 0),
    ADD COLUMN extra_platform_fee BIGINT CHECK (extra_platform_fee IS NULL OR extra_platform_fee >= 0),
    ADD COLUMN payment_code VARCHAR(40) UNIQUE,          -- transfer content / gateway orderCode, e.g. HC-261121-ABC123-GH1
    ADD COLUMN payment_expires_at TIMESTAMPTZ,
    ADD COLUMN payment_ref VARCHAR(100),                 -- gateway reference of the extension payment
    ADD COLUMN paid_at TIMESTAMPTZ,
    ADD COLUMN applied_at TIMESTAMPTZ;

-- At most one extension in progress per booking (waiting for the nurse, or accepted but not applied yet).
CREATE UNIQUE INDEX uq_booking_adjustments_open_extension
    ON booking_adjustments (booking_id)
    WHERE adjustment_type = 'EXTENSION'
      AND (status = 'REQUESTED' OR (status = 'ACCEPTED' AND applied_at IS NULL));

COMMENT ON COLUMN booking_adjustments.applied_at IS
    'When bookings.end_time and the amounts were increased by this extension (FR-SHIFT-03). NULL = not in effect.';

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('EXTENSION_REQUEST_DEADLINE_MINUTES', '30', 'NUMBER',
     'A shift extension must be requested at least this many minutes before the scheduled end (FR-SHIFT-03; proposed, pending PO)'),
    ('MAX_EXTENSION_HOURS', '4', 'NUMBER',
     'Maximum hours in one shift extension request, in 1-hour steps (FR-SHIFT-03; proposed, pending PO)')
ON CONFLICT (config_key) DO NOTHING;
