# Chat API — in-app chat & call logs (BE-2 · Phase 6)

> **Module:** `chat` · FR-CHAT-01 · RISK-06 · SRS §7 table 13 `conversations_messages` · **Migration:** `0026_chat.sql`
> **Base path:** `/api/v1` · envelope `{ success, data }` · types in `packages/shared` `chat.contracts.ts`

One conversation per booking — **conversation id = booking id** — between the customer and the nurse currently
assigned. Open while the booking is `CONFIRMED` or `IN_PROGRESS`; before that and after the shift
(`COMPLETED` / `CANCELLED` / `EXPIRED`) it is read-only. The history is dispute evidence: never deleted, never edited.

**No phone number ever leaves the API**: messages carry the sender's role (`PATIENT` / `NURSE` / `SYSTEM`), not user ids;
the counterpart is `counterpartPhoneMasked: "•••• ••• •••"` (SRS: "che hoàn toàn"). Calls happen in the app.

## `GET /bookings/:id/conversation` — PATIENT (who booked) / NURSE (assigned)

```json
{ "id": "<bookingId>", "bookingId": "<bookingId>", "bookingCode": "HC-261125-AB12CD",
  "counterpartName": "Nguyễn Thị Hoa", "counterpartPhoneMasked": "•••• ••• •••", "isOpen": true,
  "messages": [
    { "id": "system:<bookingId>:open", "senderRole": "SYSTEM", "type": "SYSTEM_ALERT", "content": "🔒 Kênh chat an toàn…", … },
    { "id": "…", "conversationId": "<bookingId>", "senderRole": "PATIENT", "type": "TEXT", "content": "…",
      "flagged": false, "createdAt": "…", "readAt": null } ] }
```

The first message is a status line built by the server (not stored): open / not confirmed yet / shift over.
Newest 500 messages, oldest first. Anyone else → `404 CONVERSATION_NOT_FOUND` (a nurse replaced on the booking too).

## `POST /bookings/:id/messages` — participant

Text: `{ "content": "…" }` (1–2000 characters, `type` optional `"TEXT"`). Photo: `{ "type": "IMAGE", "imageKey": "<objectKey>" }`
(see image-upload-url below). → `201` `SendMessageResult`:

```json
{ "id": "…", "senderRole": "NURSE", "type": "TEXT", "content": "…", "flagged": true, "createdAt": "…", "readAt": null,
  "warning": { "reasons": ["PHONE_NUMBER", "EXTERNAL_LINK", "OFF_PLATFORM_PAYMENT"],
               "message": "Phát hiện số điện thoại cá nhân, … (FR-CHAT-01) …" } }
```

Every message is scanned with the shared detector (`packages/shared` `detectOffPlatformContact`: Vietnamese phone
numbers incl. spaced digits, URLs / Facebook / Zalo / Telegram links, off-platform payment wording). A hit is **still
delivered** (SRS: warn + log), stored `is_flagged`, written to `chat_flags` (reasons + matches) and the sender gets
`warning`. `warning` is `null` otherwise.

| Status | Code | When |
|---|---|---|
| 409 | `CONVERSATION_CLOSED` | booking not `CONFIRMED` / `IN_PROGRESS` (`details.executionStatus`) |
| 404 | `CONVERSATION_NOT_FOUND` | not a participant |
| 400 | `VALIDATION_ERROR` | empty / > 2000 characters / other type |
| 400 | `IMAGE_KEY_INVALID` | `imageKey` not issued to this account by image-upload-url |
| 400 | `IMAGE_NOT_UPLOADED` / `IMAGE_TOO_LARGE` / `IMAGE_UNREADABLE` | nothing uploaded / > 10 MB / not a decodable photo |
| 503 | `STORAGE_UNAVAILABLE` | object storage not configured |

### Photos

1. `POST /bookings/:id/messages/image-upload-url` `{ "contentType": "image/jpeg" | "image/png" | "image/webp" }` →
   `201 { objectKey, uploadUrl, expiresInSeconds, contentType }` (chat open, participant). `PUT` the file to `uploadUrl`
   with that `Content-Type`.
2. `POST /bookings/:id/messages` `{ "type": "IMAGE", "imageKey": objectKey }`.

The server re-encodes the photo (orientation applied, ≤ 1600 px, JPEG, **no EXIF / GPS / device data** — a phone photo
taken at the patient's home carries its location) and the message points to that clean copy. The raw upload is never
served. An `IMAGE` message has `content: "📷 Hình ảnh"` and `imageUrl` (presigned GET, 10 minutes — reload the
conversation for a fresh one). Photos are not text-scanned (no OCR); Admin sees them in the evidence view.

## In-app call (WebRTC audio) — participant

No phone number is ever dialled or shown: the two apps open a peer-to-peer WebRTC audio call and exchange the set-up
messages through `/ws/chat`; the server only relays them to the **other participant** (never to Admin watchers).

1. `GET /bookings/:id/call-config` → `{ "iceServers": [RTCIceServer…], "ringTimeoutSec": 45 }` (chat open).
   `iceServers` comes from env `WEBRTC_ICE_SERVERS` (production needs a TURN server); `ringTimeoutSec` from
   `system_configs.CHAT_CALL_RING_TIMEOUT_SECONDS` (45, proposed — pending PO).
2. Over the socket (client → server), `callId` = a uuid chosen by the caller:
   `{ "type": "CALL_SIGNAL", "callId", "kind": "RING" }` → callee: `ACCEPT` | `DECLINE` | `BUSY` →
   `OFFER` / `ANSWER` (`payload`: `{ type, sdp }`) and `ICE_CANDIDATE` (`payload`: candidate) both ways → `HANGUP`.
   `payload` ≤ 16 KB. The other side receives
   `{ "type": "CALL_SIGNAL", "conversationId", "callId", "kind", "fromRole", "payload"?, "at" }`.
3. Refusals come back on the sender's socket: `{ "type": "CALL_ERROR", "callId", "code", "message" }` —
   `CONVERSATION_CLOSED` (RING / ACCEPT / OFFER / ANSWER / ICE after the shift; `HANGUP` / `DECLINE` / `BUSY` are always
   relayed), `CONVERSATION_NOT_FOUND` (Admin or a stranger), `BAD_SIGNAL`, `SIGNAL_TOO_LARGE`, `NOT_SUPPORTED`
   (anything other than `CALL_SIGNAL`), `BAD_MESSAGE` (not JSON).
4. No answer within `ringTimeoutSec` → the caller sends `HANGUP` and logs `MISSED`. When the call ends, **the caller**
   logs it once with `POST /bookings/:id/calls` (below) — that log is the evidence kept in the conversation.

## `POST /bookings/:id/calls` — participant

`{ "durationSec": 192, "outcome": "COMPLETED" | "MISSED" | "DECLINED" }` → `201` a `VOICE_CALL_LOG` message
(`content`: "Cuộc gọi trong ứng dụng · 3 phút 12 giây" / "Cuộc gọi nhỡ" / "Cuộc gọi bị từ chối"). Same open rule.

## `POST /conversations/:id/read` — participant

`{ "lastMessageId": "<uuid>" }` → `{ "success": true }`. Marks every message **received** by the caller up to that one
(`readAt`). Unknown message → `404 MESSAGE_NOT_FOUND`.

## `GET /admin/bookings/:id/conversation` — ADMIN

Full evidence view (`AdminConversationDto`): every message with `senderName`, `receiverRole`, `callDurationSec`,
`flagReasons`, plus `flaggedCount`. **Each read writes `audit_logs` `VIEW_CHAT_HISTORY`** (actor, booking, IP).

## WebSocket `GET /ws/chat?conversationId=<bookingId>&access_token=<JWT>`

Also `Sec-WebSocket-Protocol: bearer, <JWT>`. Customer, assigned nurse or Admin (`401` / `403` / `400` otherwise).
Server → client: `{ "type": "NEW_MESSAGE", "message": ChatMessageDto }`,
`{ "type": "READ", "conversationId", "readerRole", "upTo" }`, and the call events above (`CALL_SIGNAL`, `CALL_ERROR`).
Client → server: `CALL_SIGNAL` only. Text and photos always go through `POST …/messages` (scan + store first). When the receiver is not connected to the conversation, a `NEW_MESSAGE` notification is sent
(in-app + push, `data.conversationId`).

## For the apps

- nurse-web `chat.api.ts` already matches (`conversationId` = `bookingId`); show `warning.message` to the sender.
- `counterpartPhoneMasked` is now digit-free; the mock's `09•• ••• 123` should change.
- Photos: image-upload-url → PUT → `POST …/messages { type: "IMAGE", imageKey }`; render `imageUrl`.
- Call button (`chat-action-btn--phone`): `GET …/call-config`, then `RTCPeerConnection` + `CALL_SIGNAL` over the
  same `/ws/chat` socket; never `tel:` links.
