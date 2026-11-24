-- =====================================================================
-- 0023 — notifications (BE-3 · Phase 6) · FR-NOTIF-01 · TC-NFR-01
--
-- notifications (0001) stores one row per channel (IN_APP, PUSH_FCM, SMS_FALLBACK) and drives the
-- 60-second SMS fallback (core/notifications). Added here for the in-app notification centre:
--   * type      — what happened (DISPUTE_OPENED, SETTLEMENT_DONE, …): the apps route on it
--                 (NurseNotificationType in packages/shared). NULL for rows written before 0023.
--   * data      — need-to-know routing ids only (bookingId, disputeId, withdrawalId…). Never clinical detail.
--   * read_at   — when the user opened it (is_read stays the boolean the 0001 index uses).
--   * event_id  — groups the rows of one dispatch (IN_APP + PUSH_FCM, later SMS_FALLBACK). Reading the
--                 in-app row acknowledges the whole event, so the 60 s SMS fallback is not sent.
-- The centre lists IN_APP rows only (the push / SMS rows are delivery records of the same event).
--
-- Forward-only: never edit this file after it is merged; add 0024+.
-- =====================================================================

ALTER TABLE notifications
    ADD COLUMN type VARCHAR(40),
    ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
    ADD COLUMN read_at TIMESTAMPTZ,
    ADD COLUMN event_id UUID;

UPDATE notifications SET read_at = created_at WHERE is_read AND read_at IS NULL;

CREATE INDEX idx_notifications_event ON notifications (event_id) WHERE event_id IS NOT NULL;

CREATE INDEX idx_notifications_inbox
    ON notifications (user_id, created_at DESC, id DESC)
    WHERE channel = 'IN_APP';
