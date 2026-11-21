-- =====================================================================
-- 0010 — BE-3 Phase 3: booking expiry, escrow webhook, Job Board direct request
--        (FR-BOOK-01/03, FR-PAY-01, BR-04 §2.1, BR-08 §2.2/§2.5, SEC-5.3/5.4)
--
-- 1. Three numbers of FR-BOOK-03 had no config key yet (zero-hardcoding rule):
--      UNMATCHED_EXPIRY_LEAD_MINUTES    30  unclaimed this close to the start → EXPIRED (+100% refund)
--      URGENT_UNMATCHED_EXPIRY_MINUTES  30  an urgent (Radar) booking unclaimed this long after matching starts → EXPIRED
--      DIRECT_REQUEST_WINDOW_MINUTES    15  the invited nurse's exclusive window before the booking is broadcast
--    packages/shared SYSTEM_CONFIG_KEYS gains the same three keys.
-- 2. bookings.matching_started_at — stamped by the database whenever a booking enters MATCHING
--    (cash at creation, bank transfer at the escrow webhook), so expiry and the direct-request
--    window do not depend on which module started matching.
-- 3. The direct request's 15-minute window starts at that same moment (booking_offers.expires_at).
-- 4. payment_webhook_events — append-only record of every verified gateway notification and what
--    was done with it (held, duplicate, late payment refunded, amount mismatch…), for reconciliation.
--
-- Forward-only: never edit this file after it is merged; add 0011+.
-- =====================================================================

-- 1. Configuration ------------------------------------------------------------
INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('UNMATCHED_EXPIRY_LEAD_MINUTES', '30', 'NUMBER',
     'A MATCHING booking still without a nurse this many minutes before its start expires; prepaid funds are refunded 100% (FR-BOOK-03, BR-08 §2.5)'),
    ('URGENT_UNMATCHED_EXPIRY_MINUTES', '30', 'NUMBER',
     'An urgent (Radar Dispatch) booking still without a nurse this many minutes after matching started expires (FR-BOOK-03, BR-08 §2.5)'),
    ('DIRECT_REQUEST_WINDOW_MINUTES', '15', 'NUMBER',
     'Minutes the invited nurse has to answer a direct request before the booking is broadcast (FR-BOOK-03, BR-08 §2.2)')
ON CONFLICT (config_key) DO NOTHING;

-- 2 + 3. When matching starts --------------------------------------------------
ALTER TABLE bookings ADD COLUMN matching_started_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.matching_started_at IS
    'Set by trg_bookings_matching_started each time execution_status becomes MATCHING. Anchor of the urgent-booking expiry and of the direct-request window (BE-3 booking-expiry / job-board).';

-- Bookings already matching when this migration runs: best known moment.
UPDATE bookings SET matching_started_at = updated_at
 WHERE execution_status = 'MATCHING' AND matching_started_at IS NULL;

CREATE OR REPLACE FUNCTION bookings_stamp_matching_started() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    window_minutes NUMERIC;
BEGIN
    IF NEW.execution_status = 'MATCHING'
       AND (TG_OP = 'INSERT' OR OLD.execution_status IS DISTINCT FROM 'MATCHING') THEN
        NEW.matching_started_at := now();

        IF TG_OP = 'UPDATE' THEN
            SELECT config_value::numeric INTO window_minutes
              FROM system_configs WHERE config_key = 'DIRECT_REQUEST_WINDOW_MINUTES';
            UPDATE booking_offers
               SET expires_at = now() + make_interval(mins => COALESCE(window_minutes, 15)::int)
             WHERE booking_id = NEW.id
               AND offer_type = 'DIRECT_REQUEST'
               AND status = 'SENT'
               AND expires_at IS NULL;
        END IF;
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bookings_matching_started ON bookings;
CREATE TRIGGER trg_bookings_matching_started
    BEFORE INSERT OR UPDATE OF execution_status ON bookings
    FOR EACH ROW EXECUTE FUNCTION bookings_stamp_matching_started();

-- Partial index for the expiry sweep (only bookings that can still expire).
CREATE INDEX idx_bookings_expiry_candidates ON bookings (start_time)
    WHERE execution_status IN ('DRAFT', 'MATCHING') AND nurse_id IS NULL;

-- 4. Gateway notifications (append-only) --------------------------------------
CREATE TABLE payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    provider_ref VARCHAR(100) NOT NULL,          -- gateway transaction reference
    order_code VARCHAR(30) NOT NULL,             -- our booking_code
    booking_id UUID REFERENCES bookings (id),
    amount BIGINT NOT NULL,
    outcome VARCHAR(30) NOT NULL,                -- HELD | DUPLICATE | LATE_PAYMENT_REFUNDED | EXTRA_PAYMENT_REFUNDED
                                                 -- | AMOUNT_MISMATCH | NOT_TRANSFER_BOOKING | UNKNOWN_BOOKING | NOT_SUCCESS
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_webhook_events_ref ON payment_webhook_events (provider_ref);
CREATE INDEX idx_payment_webhook_events_booking ON payment_webhook_events (booking_id) WHERE booking_id IS NOT NULL;

CREATE TRIGGER trg_payment_webhook_events_no_update
    BEFORE UPDATE ON payment_webhook_events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER trg_payment_webhook_events_no_delete
    BEFORE DELETE ON payment_webhook_events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMENT ON TABLE payment_webhook_events IS
    'Every signature-verified escrow webhook and its outcome (SEC-5.3/5.4, SEC-5.10 reconciliation). Money moves only through wallet_transactions; this table explains why each notification did or did not move money.';
