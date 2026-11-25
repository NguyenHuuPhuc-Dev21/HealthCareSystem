-- =====================================================================
-- 0026 — In-app chat & call logs (BE-2 · Phase 6) · FR-CHAT-01 · RISK-06 · SRS §7 table 13
--
-- conversations_messages (0001) is the conversation of ONE booking (conversation id = booking id): customer ↔ the
-- assigned nurse, open while the booking is CONFIRMED / IN_PROGRESS, read-only afterwards (dispute evidence).
-- Added here:
--   read_at            when the receiver read it (is_read stays for 0001 compatibility)
--   chat_flags         security log of every message the scanner flagged (phone number, external link, off-platform
--                      payment wording — packages/shared detectOffPlatformContact): reasons + what matched
--   no hard delete     DELETE is refused; UPDATE may only set is_read / read_at (evidence never changes)
--   VIEW_CHAT_HISTORY  audit action written when an Admin opens a conversation
--
-- ALTER TYPE … ADD VALUE is fine inside the migration transaction: the new value is not used in this file.
-- Forward-only: never edit this file after it is merged; add 0027+.
-- =====================================================================

ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'VIEW_CHAT_HISTORY';

ALTER TABLE conversations_messages
    ADD COLUMN read_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_messages_content CHECK (
        message_type <> 'TEXT' OR (content IS NOT NULL AND char_length(content) BETWEEN 1 AND 2000)
    ),
    -- IMAGE: content = private object key 'chat-image/<sender>/<uuid>.jpg' (re-encoded, metadata stripped)
    ADD CONSTRAINT chk_messages_image CHECK (message_type <> 'IMAGE' OR content ~ '^chat-image/'),
    ADD CONSTRAINT chk_messages_call CHECK (message_type <> 'VOICE_CALL_LOG' OR call_duration_sec IS NOT NULL);

CREATE INDEX idx_messages_unread ON conversations_messages (booking_id, receiver_id)
WHERE
    is_read = FALSE;

CREATE TABLE chat_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    message_id UUID NOT NULL UNIQUE REFERENCES conversations_messages (id),
    booking_id UUID NOT NULL REFERENCES bookings (id),
    sender_id UUID NOT NULL REFERENCES users (id),
    reasons TEXT[] NOT NULL CHECK (cardinality(reasons) > 0),
    matches TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_flags_sender ON chat_flags (sender_id, created_at DESC);

COMMENT ON TABLE chat_flags IS
    'FR-CHAT-01 / RISK-06 security log: messages flagged for a phone number, an external link or off-platform payment wording. Append-only.';

-- Evidence is never edited nor deleted (dispute evidence, FR-CHAT-01). Only the read receipt may change.
CREATE OR REPLACE FUNCTION conversations_messages_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'conversations_messages rows are dispute evidence and cannot be deleted'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.booking_id IS DISTINCT FROM OLD.booking_id OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
       OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id OR NEW.message_type IS DISTINCT FROM OLD.message_type
       OR NEW.content IS DISTINCT FROM OLD.content OR NEW.call_duration_sec IS DISTINCT FROM OLD.call_duration_sec
       OR NEW.is_flagged IS DISTINCT FROM OLD.is_flagged OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'conversations_messages rows are dispute evidence; only the read receipt can change'
            USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_conversations_messages_guard ON conversations_messages;
CREATE TRIGGER trg_conversations_messages_guard
    BEFORE UPDATE OR DELETE ON conversations_messages
    FOR EACH ROW EXECUTE FUNCTION conversations_messages_guard();

CREATE OR REPLACE FUNCTION chat_flags_append_only() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'chat_flags is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_flags_append_only ON chat_flags;
CREATE TRIGGER trg_chat_flags_append_only
    BEFORE UPDATE OR DELETE ON chat_flags
    FOR EACH ROW EXECUTE FUNCTION chat_flags_append_only();

-- In-app call (FR-CHAT-01): an unanswered RING is treated as missed after this many seconds (apps stop ringing).
INSERT INTO system_configs (config_key, config_value, data_type, description)
VALUES
    ('CHAT_CALL_RING_TIMEOUT_SECONDS', '45', 'NUMBER',
     'In-app call: the callee rings at most this many seconds, then the call is logged as missed (FR-CHAT-01; proposed, pending PO)')
ON CONFLICT (config_key) DO NOTHING;
