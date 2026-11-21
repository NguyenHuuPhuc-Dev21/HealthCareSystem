-- =====================================================================
-- 0008 — nurse_availabilities: overnight windows + "open hours on one date"
--        (Phase 2, requested by BE-2 / Dev B — FR-SCHED-01, BR-03 §2.5)
--
-- Why:
--  1. Overnight windows. FR-SCHED-01 / BR-03 §2.5 use windows such as
--     "Mon–Fri 18:00–06:00", and the Nurse Web board (N13) saves 19:00–06:00.
--     0001 has CHECK (end_time > start_time), which rejects them.
--     New rule: end_time <> start_time. end_time < start_time means the window
--     runs past midnight into the next day (start date/day = the evening).
--  2. Open hours for a single date (board N13 "mở rảnh riêng ngày này"): a new
--     availability_type DATE_AVAILABLE with specific_date set. On that date it
--     REPLACES the recurring windows of that weekday (see availability-engine).
--     packages/shared AvailabilityType gains the same value.
--
-- Conventions kept by the availability-engine (not by the DB):
--   * all times are Vietnam local time (Asia/Ho_Chi_Minh, UTC+7, no DST);
--   * an end_time of 23:59 means "until midnight" (the UI's all-day = 00:00–23:59).
--
-- ALTER TYPE … ADD VALUE runs inside the migrator's transaction (PG 12+). The new
-- value cannot be used as an enum literal in the same transaction, so the new
-- CHECK compares availability_type::text instead.
-- Forward-only: never edit this file after it is merged; add 0009+.
-- =====================================================================

ALTER TYPE availability_type_enum ADD VALUE IF NOT EXISTS 'DATE_AVAILABLE';

-- Drop the two unnamed table CHECKs from 0001 (found by definition, not by
-- auto-generated name). The day_of_week BETWEEN 0 AND 6 check is kept.
DO $$
DECLARE
    c record;
BEGIN
    FOR c IN
        SELECT conname
          FROM pg_constraint
         WHERE conrelid = 'nurse_availabilities'::regclass
           AND contype = 'c'
           AND (pg_get_constraintdef(oid) LIKE '%end_time > start_time%'
                OR pg_get_constraintdef(oid) LIKE '%availability_type%')
    LOOP
        EXECUTE format('ALTER TABLE nurse_availabilities DROP CONSTRAINT %I', c.conname);
    END LOOP;
END $$;

ALTER TABLE nurse_availabilities
    ADD CONSTRAINT ck_nurse_availabilities_nonzero_window CHECK (end_time <> start_time),
    ADD CONSTRAINT ck_nurse_availabilities_shape CHECK (
        (
            availability_type::text = 'RECURRING_AVAILABLE'
            AND day_of_week IS NOT NULL
            AND specific_date IS NULL
        )
        OR (
            availability_type::text IN ('TIME_OFF_EXCEPTION', 'DATE_AVAILABLE')
            AND specific_date IS NOT NULL
            AND day_of_week IS NULL
        )
    );

-- Date rows are read by date range (engine) — the 0001 index covers (nurse_id, type).
CREATE INDEX IF NOT EXISTS idx_availabilities_nurse_date
    ON nurse_availabilities (nurse_id, specific_date)
    WHERE specific_date IS NOT NULL;

COMMENT ON TABLE nurse_availabilities IS
    'SRS §7 table 10 (FR-SCHED-01). RECURRING_AVAILABLE weekly windows, DATE_AVAILABLE open hours for one date (replace that weekday''s windows), TIME_OFF_EXCEPTION blocks. end_time < start_time = overnight. Times are Vietnam local. Effective availability (minus CONFIRMED/IN_PROGRESS bookings ± 60-min travel buffer) is computed only by services/api availability-engine.';
