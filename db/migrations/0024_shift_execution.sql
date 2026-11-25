-- =====================================================================
-- 0024 — Shift execution: check-in, shift logs, check-out (BE-2 · Phase 4)
-- FR-SHIFT-01 · FR-SHIFT-02 · FR-SHIFT-04 · SRS §4.4 · BR-07 · BR-15
--
-- shift_logs (0001) stays the one row per booking. Added here:
--   checkin_distance_m       Haversine distance to the care address at check-in (≤ CHECKIN_MAX_RADIUS_METERS)
--   initial_assessment       the nurse's assessment of the first minutes (actual mobility, mental status, initial vitals)
--   assessed_at              when it was submitted (server time)
--   mismatch_reason          condition discrepancy reported in the first CONDITION_MISMATCH_WINDOW_MINUTES
--   mismatch_option          SURCHARGE (asked the family for a surcharge) | REFUSE (cancelled without penalty)
--   progress_notes           free-text care notes [{id, at, text}]
--   final_vital_signs        the vitals taken at check-out
--   updated_at               last write (the apps compare it to refresh)
-- vital_signs_log and care_activities_log (0001) are JSON arrays; every write appends under the booking lock.
--
-- checkin_selfie_uploads — every presigned selfie upload handed out for a check-in. A check-in must use a key
--   issued for THIS booking, to THIS nurse, at most CHECKIN_SELFIE_MAX_AGE_MINUTES earlier, never used before:
--   an old photo (gallery, previous shift) cannot be replayed.
-- checkin_attempts — security log of every refused check-in (mock location, outside the radius, bad selfie)
--   and of the accepted one. Append-only.
-- booking_adjustments — CONDITION_SURCHARGE rows reuse the 0013 columns (payment_code `<code>-PT<n>`,
--   payment_expires_at, applied_at…); at most one open surcharge per booking.
--
-- New parameters (system_configs), PROPOSED values pending PO approval:
--   CHECKIN_OPENS_BEFORE_START_MINUTES = 30   check-in possible from start − 30 min until the scheduled end
--   CHECKIN_SELFIE_MAX_AGE_MINUTES     = 10   = presigned URL lifetime (NFR-SEC-01 max 10 min)
--   CONDITION_MISMATCH_WINDOW_MINUTES  = 30   SRS §4.4 "30 phút đầu"
--   CHECKOUT_EARLY_TOLERANCE_MINUTES   = 15   shift/hour-based bookings: check-out from scheduled end − 15 min
--   CASH_COMMISSION_DUE_HOURS          = 24   cash booking: platform commission due check-out + 24h (FR-PAY-02)
--
-- Forward-only: never edit this file after it is merged; add 0025+.
-- =====================================================================

ALTER TABLE shift_logs
    ADD COLUMN checkin_distance_m NUMERIC(8, 1) CHECK (checkin_distance_m IS NULL OR checkin_distance_m >= 0),
    ADD COLUMN initial_assessment JSONB,
    ADD COLUMN assessed_at TIMESTAMPTZ,
    ADD COLUMN mismatch_reason TEXT CHECK (mismatch_reason IS NULL OR char_length(mismatch_reason) <= 1000),
    ADD COLUMN mismatch_option VARCHAR(10) CHECK (mismatch_option IS NULL OR mismatch_option IN ('SURCHARGE', 'REFUSE')),
    ADD COLUMN progress_notes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(progress_notes) = 'array'),
    ADD COLUMN final_vital_signs JSONB,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN shift_logs.checkin_time IS
    'Server time of the accepted check-in (never the device clock). Watermark of the selfie = this time + checkin_lat/lng.';

CREATE TABLE checkin_selfie_uploads (
    object_key VARCHAR(200) PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    content_type VARCHAR(50) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used_at TIMESTAMPTZ
);

CREATE INDEX idx_checkin_selfie_uploads_booking ON checkin_selfie_uploads (booking_id, issued_at DESC);

COMMENT ON TABLE checkin_selfie_uploads IS
    'Presigned check-in selfie uploads (FR-SHIFT-01). A check-in accepts only a fresh, unused key issued for the same booking and nurse.';

CREATE TABLE checkin_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    nurse_id UUID NOT NULL REFERENCES users (id),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    distance_m NUMERIC(10, 1),
    is_mock_location BOOLEAN NOT NULL DEFAULT FALSE,
    outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('ACCEPTED', 'MOCK_LOCATION_DETECTED', 'OUT_OF_RADIUS', 'INVALID_SELFIE'))
);

CREATE INDEX idx_checkin_attempts_booking ON checkin_attempts (booking_id, attempted_at DESC);

CREATE INDEX idx_checkin_attempts_mock ON checkin_attempts (nurse_id, attempted_at DESC)
WHERE
    outcome = 'MOCK_LOCATION_DETECTED';

COMMENT ON TABLE checkin_attempts IS
    'Security log of check-ins (FR-SHIFT-01): mock-location and out-of-radius refusals stay visible to Admin. Append-only.';

-- At most one condition surcharge in progress per booking (waiting for the family, or accepted but not paid yet).
CREATE UNIQUE INDEX uq_booking_adjustments_open_condition_surcharge
    ON booking_adjustments (booking_id)
    WHERE adjustment_type = 'CONDITION_SURCHARGE'
      AND (status = 'REQUESTED' OR (status = 'ACCEPTED' AND applied_at IS NULL));

INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('CHECKIN_OPENS_BEFORE_START_MINUTES', '30', 'NUMBER',
     'Check-in is possible from this many minutes before the shift start until the scheduled end (FR-SHIFT-01; proposed, pending PO)'),
    ('CHECKIN_SELFIE_MAX_AGE_MINUTES', '10', 'NUMBER',
     'A check-in selfie must be uploaded through a URL issued at most this many minutes earlier (FR-SHIFT-01; proposed, pending PO)'),
    ('CONDITION_MISMATCH_WINDOW_MINUTES', '30', 'NUMBER',
     'A condition discrepancy can be reported this many minutes after check-in (FR-SHIFT-02, SRS §4.4 "30 phút đầu")'),
    ('CHECKOUT_EARLY_TOLERANCE_MINUTES', '15', 'NUMBER',
     'Shift/hour-based bookings can be checked out from this many minutes before the scheduled end (FR-SHIFT-04; proposed, pending PO)'),
    ('CASH_COMMISSION_DUE_HOURS', '24', 'NUMBER',
     'Cash booking: the 15% platform commission is due this many hours after check-out (FR-PAY-02)')
ON CONFLICT (config_key) DO NOTHING;
