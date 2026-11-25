# chat (BE-2 · Phase 6)

Masked in-app chat and call logs — FR-CHAT-01 · RISK-06 · SRS §7 table 13. Contract:
[`docs/api/chat.api.md`](../../../../../docs/api/chat.api.md) · Migration `0026_chat.sql`.

| File | Role |
|---|---|
| `chat.types.ts` | rows, notices, channel / socket paths |
| `chat.policy.ts` | pure: open rule, participants, scan (shared detector), DTOs, fully masked phone |
| `chat.repo.ts` | SQL — never reads phone numbers |
| `chat.service.ts` | conversation, send, call log, read receipt, Admin evidence view (audit) |
| `chat.realtime.ts` | `ChatHub`, `ChatPublisher` (Redis when `REDIS_URL`), `/ws/chat` |
| `chat.routes.ts` | routes |
| `chat.schema.ts` | validation |
| `chat.image.ts` | photo re-encoding (sharp): orientation, ≤ 1600 px, JPEG, no EXIF / GPS |

## Rules

- Conversation = booking. Participants: the customer and the **current** `nurse_id` (a replaced nurse loses access).
- Open while `CONFIRMED` / `IN_PROGRESS`. A message takes the booking row `FOR SHARE`, so it serializes with a check-out
  or cancellation (`FOR UPDATE`): nothing is accepted after the conversation closed.
- Scan → flagged messages are delivered, marked, warned and logged in `chat_flags` (SRS asks warn + log, not block).
- Evidence: a DB trigger refuses DELETE and any UPDATE other than the read receipt; `chat_flags` is append-only.
- Admin reads are audit-logged (`VIEW_CHAT_HISTORY`, enum value added in 0026).
- Notifications: `NEW_MESSAGE` to the receiver only when not connected to `/ws/chat` for that booking (per process).
- Photos: presigned PUT under `chat-image/<sender>/`, then the server re-encodes (no metadata) and stores the clean
  copy; only that copy is ever served (10-minute presigned GET). Own uploads only.
- Calls: WebRTC audio, peer to peer. `/ws/chat` relays `CALL_SIGNAL` to the other participant's sockets only
  (targeted delivery, also across instances via the Redis envelope `toUserId`); Admin watchers never get signals.
  Starting signals need an open chat; HANGUP / DECLINE / BUSY are always relayed. Nothing of the call is stored except
  the log the caller posts to `/calls`. ICE servers: env `WEBRTC_ICE_SERVERS`; ring timeout:
  `CHAT_CALL_RING_TIMEOUT_SECONDS`.

## Open items

1. **TURN server** — calls across mobile networks need a TURN server (coturn or a provider) in `WEBRTC_ICE_SERVERS`
   (DevOps). Without it only STUN is used and some calls will not connect.
2. **Photos are not scanned** — a phone number written on a photo is not detected (no OCR); Admin sees photos in the
   evidence view.
3. **Admin route** — `GET /admin/bookings/:id/conversation` is ready for Phase 7 admin screens and BE-3 disputes.
4. PO: should a flagged message be hidden from the receiver instead of only flagged? SRS says warn + log.
