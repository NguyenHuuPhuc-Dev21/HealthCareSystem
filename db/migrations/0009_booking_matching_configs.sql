-- =====================================================================
-- 0009 — booking routing configs + DB guard against prohibited services
--        (Phase 3, requested by BE-2 / Dev B — FR-BOOK-03, BR-03 §2.4, BR-08 §2.1)
--
-- Two numbers of FR-BOOK-03 had no config key yet (zero-hardcoding rule):
--   URGENT_BOOKING_LEAD_HOURS  6   start within <= 6 h  → RADAR_DISPATCH, else JOB_BOARD
--   RADAR_WINDOW_MINUTES      15   Radar offers (wave 2: minutes 5–15) end 15 min after dispatch starts
-- packages/shared SYSTEM_CONFIG_KEYS gains the same two keys.
-- Forward-only: never edit this file after it is merged; add 0010+.
-- =====================================================================

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('URGENT_BOOKING_LEAD_HOURS', '6', 'NUMBER',
     'A booking starting within this many hours is urgent and goes to Radar Dispatch; later ones go to the Job Board (FR-BOOK-03)'),
    ('RADAR_WINDOW_MINUTES', '15', 'NUMBER',
     'Minutes after Radar Dispatch starts at which its offers stop being claimable (wave 2 = minutes 5–15, FR-BOOK-03)')
ON CONFLICT (config_key) DO NOTHING;

-- ---------------------------------------------------------------------
-- Prohibited services (Group 3) can never be booked — enforced by the DATABASE,
-- so no API path (customer, Admin, call-center, script) can create such a booking
-- (FR-BOOK-01, BR-09 §2.5, BR-14 §2.3, Phase 3 exit criterion 4).
-- The booking API answers 403 SERVICE_PROHIBITED before reaching this trigger.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bookings_reject_prohibited_service() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM service_categories s WHERE s.id = NEW.service_id AND s.is_prohibited) THEN
        RAISE EXCEPTION 'Service % is prohibited and can never be booked', NEW.service_id
            USING ERRCODE = 'check_violation', CONSTRAINT = 'bookings_no_prohibited_service';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bookings_no_prohibited_service ON bookings;
CREATE TRIGGER trg_bookings_no_prohibited_service
    BEFORE INSERT OR UPDATE OF service_id ON bookings
    FOR EACH ROW EXECUTE FUNCTION bookings_reject_prohibited_service();
