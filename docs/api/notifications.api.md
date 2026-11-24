# notifications API (BE-3 · Phase 6 · FR-NOTIF-01, TC-NFR-01)

In-app notification centre for every signed-in user (nurse, customer, admin), a WebSocket for new
notifications, and the 60-second SMS fallback for urgent alerts. Base path `/api/v1`, Bearer token.

## 1. Endpoints

| Method | Path | Body / query | Response `data` |
|---|---|---|---|
| GET | `/notifications` | `cursor?`, `limit?` (1–50, default 20), `unreadOnly?=true` | `{ items: NotificationDto[], nextCursor: string \| null, totalUnread: number }` |
| GET | `/notifications/unread-count` | — | `{ totalUnread }` |
| POST | `/notifications/:id/read` | — | `{ success: true }` · 404 `NOTIFICATION_NOT_FOUND` (also for someone else's) |
| POST | `/notifications/:id/ack` | — | same as `read` (mobile app acknowledging a push) |
| POST | `/notifications/read-all` | — | `{ success: true, updated }` |

`NotificationDto` (`packages/shared/src/contracts/notification.contracts.ts`):

```json
{ "id": "uuid", "type": "DISPUTE_OPENED", "priority": "HIGH", "title": "…", "body": "…",
  "data": { "disputeId": "…", "bookingId": "…", "bookingCode": "HC-…" },
  "readAt": null, "createdAt": "2026-11-24T08:00:00.000Z" }
```

- Newest first; `nextCursor` is opaque — pass it back as `cursor`. `400 INVALID_CURSOR` for a bad one.
- `data` holds routing ids only, never clinical detail.
- **Read = acknowledged.** Reading the in-app row also acknowledges the push row of the same event, so the
  SMS fallback is not sent. `read-all` does the same for everything.

## 2. WebSocket

```
ws(s)://<host>/ws/notifications?access_token=<JWT>      (also /api/v1/ws/notifications)
or  new WebSocket(url, ['bearer', jwt])
```

Server → client only: `{ "type": "NEW_NOTIFICATION", "notification": NotificationDto }`.
Missing / invalid token → HTTP 401 before the upgrade. The server pings every 30 s.

**FE-2 (nurse-web) — two small changes to go live:**
1. `subscribeNotifications`: append `?access_token=${localStorage.getItem('access_token')}` to `wsUrl`
   (browsers cannot send an Authorization header on a WebSocket).
2. `vite.config.ts` dev proxy: `'/ws': { target: 'ws://localhost:3000', ws: true }`.

## 3. Types sent by BE-3

| Type | To | Priority | When |
|---|---|---|---|
| `DISPUTE_OPENED` | the other side | HIGH | a dispute is opened (nurse also gets it when the customer rebuts) |
| `DISPUTE_UPDATED` | customer who opened | NORMAL | the nurse submitted a rebuttal |
| `DISPUTE_RESOLVED` | both sides | NORMAL | Admin decision (also a rejected penalty appeal) |
| `DEPOSIT_PENALTY` | nurse | NORMAL | deposit damages from a dispute |
| `PENALTY_REVERSED` | nurse | NORMAL | penalty appeal upheld |
| `SETTLEMENT_DONE` | nurse | NORMAL | shift / cancellation share paid out |
| `DEPOSIT_WITHHELD` | nurse | NORMAL | part of a payout kept to fill the deposit (ADR-0004) |
| `WITHDRAWAL_UPDATE` | nurse | NORMAL | withdrawal paid or rejected |
| `DEPOSIT_REFUND_STATUS` | nurse | NORMAL | closure refund WAITING_HOLD / READY / REFUNDED / REJECTED |
| `COMMISSION_OVERDUE` | nurse | HIGH | suspended for an overdue cash commission |
| `BOOKING_EXPIRED` | customer | NORMAL | booking expired (booking-expiry) |

Other modules send through the same notifier (see `services/api/src/modules/notifications/README.md`).

## 4. SMS fallback (TC-NFR-01)

Every HIGH notice schedules `notifications.urgent-sms-fallback` on the shared queue at +60 s. If the event
is still unacknowledged then, exactly one `SMS_FALLBACK` row is written and sent (safe under retries and
concurrent workers). FCM and the SMS/ZNS gateway are simulated in the MVP (logged, phone masked); the rows
are the same as with the real adapters.
