-- =====================================================================
-- 0030 — sos (BE-3 · Phase 4) · FR-SHIFT-05 · TC-SOS-01 · BR-23
--
-- An emergency during a shift. The app only ASSISTS: the person on site calls 115 first (the nurse app's SOS
-- button opens the 115 dialer without network). The platform then alerts the family and every Admin within
-- 2 seconds (in-app + WebSocket + push HIGH, SMS fallback after 60 s unacknowledged — core/notifications) with
-- the GPS position and the latest vital signs, and keeps the incident record.
--
-- sos_alerts — one row per emergency: who raised it (nurse or family), where, the vitals snapshot sent, and its
--   life cycle ACTIVE → ACKNOWLEDGED (family / Admin confirmed they got it) → CLOSED (Admin, with the outcome).
--   At most one open (ACTIVE / ACKNOWLEDGED) alert per booking: pressing again, or the nurse app replaying its
--   offline queue, returns the open alert instead of alerting twice.
-- shift_logs.emergency_incident_log (0001) — the incident report itself: an append-only JSON array of events
--   (RAISED, ACKNOWLEDGED, REPORT, CLOSED) kept with the shift for later review and disputes.
--
-- Forward-only: never edit this file after it is merged; add 0031+.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'CLOSE_SOS_INCIDENT';

CREATE TABLE sos_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    raised_by UUID NOT NULL REFERENCES users (id),
    raised_by_role VARCHAR(10) NOT NULL CHECK (raised_by_role IN ('NURSE', 'FAMILY')),
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),
    vitals JSONB, -- the latest vital signs sent with the alert (VitalReading shape), null when none
    status VARCHAR(15) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'CLOSED')),
    acknowledged_by UUID REFERENCES users (id),
    acknowledged_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users (id),
    closed_at TIMESTAMPTZ,
    outcome VARCHAR(30) CHECK (outcome IS NULL OR outcome IN ('TRANSFERRED_TO_HOSPITAL', 'RESOLVED_ON_SITE', 'FALSE_ALARM')),
    close_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((acknowledged_at IS NULL) = (acknowledged_by IS NULL)),
    CHECK (status <> 'CLOSED' OR (closed_at IS NOT NULL AND closed_by IS NOT NULL AND outcome IS NOT NULL AND close_note IS NOT NULL)),
    CHECK ((lat IS NULL) = (lng IS NULL))
);

CREATE UNIQUE INDEX uq_sos_alerts_open_per_booking ON sos_alerts (booking_id) WHERE status <> 'CLOSED';
CREATE INDEX idx_sos_alerts_open ON sos_alerts (created_at) WHERE status <> 'CLOSED';
CREATE INDEX idx_sos_alerts_booking ON sos_alerts (booking_id, created_at DESC);

COMMENT ON TABLE sos_alerts IS
    'FR-SHIFT-05 emergency alerts (BE-3 sos). The incident report is shift_logs.emergency_incident_log; this table is the queryable life cycle. Admin close is audited (CLOSE_SOS_INCIDENT).';
