# Module `notifications` (BE-3 / Dev C · Phase 6)

FR-NOTIF-01 · TC-NFR-01. Contract: `docs/api/notifications.api.md`. Built on `core/notifications` (Phase 0).

| File | What |
|---|---|
| `notifications.service.ts` | inbox (`NotificationsService`), the process-wide dispatcher, `notifyUser`, `sendNotices`, `legacyNotify` |
| `notifications.notices.ts` | Vietnamese messages of BE-3's dispute / money flows (pure) |
| `notifications.realtime.ts` | `LocalRealtimeHub` + Redis pub/sub so the worker's notices reach the API's sockets |
| `notifications.socket.ts` | `/ws/notifications` (`ws` package), JWT via `?access_token=` or `bearer` subprotocol |
| `notifications.routes.ts` | REST endpoints |
| `notifications.jobs.ts` | registers `notifications.urgent-sms-fallback` in the worker |

Migration `0023_notifications.sql`: `type`, `data`, `read_at`, `event_id` (groups the channel rows of one dispatch).

## Sending from a module

```ts
import { notifyUser, sendNotices } from '../notifications/notifications.service';
// deps: notify?: Notify   — the singleton passes notifyUser, tests pass a spy or nothing
const out = await this.deps.withTx(...);              // 1. commit the business change
await sendNotices(this.deps.notify, [notice, ...]);   // 2. then notify (never fails the request)
```

Always after the transaction: a user must never be told about a change that rolled back.

## Wired

- BE-3: disputes, settlements, withdrawals, deposits (closure refund), cash-commission (overdue), booking-expiry.
- **BE-1 / BE-2:** `shift-extend`, `cancellation-policy`, `prescription-rejection`, `matching-radar`,
  `tier-lifecycle` already accept an optional `notify`. One line in their singleton turns it on, e.g.
  `notify: legacyNotify('EXTENSION_REQUEST')` (types: `NurseNotificationType` in packages/shared). Left to the
  owners so each module chooses its types and priority (`RADAR_URGENT` should be HIGH: `notifyUser({...n, type, priority})`).

## Environment

| Variable | Default | Effect |
|---|---|---|
| `REDIS_URL` | — | realtime events go through Redis pub/sub (needed when the worker sends) |
| `NOTIFICATIONS_REALTIME` | — | `local` = in-process only (single dev process, no Redis) |

FCM / SMS-ZNS are simulated (`LoggingPushProvider`, `LoggingSmsProvider`); a real adapter implements the
`PushProvider` / `SmsProvider` interfaces of core/notifications and is selected in `getNotificationDispatcher`.
