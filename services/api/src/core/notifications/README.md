# core/notifications (BE-3)

Multi-channel dispatcher for FR-NOTIF-01 with the 60-second SMS fallback (TC-NFR-01).

```ts
const notifications = createNotificationService({
  db: pool,                         // pg.Pool
  push: new MockPushProvider(),     // swap for the FCM adapter
  sms: new MockSmsProvider(),       // swap for the SMS/ZNS adapter
  realtime: wsGateway,              // shared WebSocket gateway
  scheduler: jobs,                  // core/jobs (BE-2)
});

await notifications.dispatch({
  userId, bookingId,
  title: 'Cảnh báo SOS',
  priority: NotificationPriority.HIGH,   // HIGH => 60 s fallback job
});

await notifications.acknowledge(notificationId, userId); // from the app when the alert is opened
```

| Behaviour | Where |
|---|---|
| One `notifications` row per channel (`IN_APP`, `PUSH_FCM`), `delivery_status` SENT/FAILED | `dispatch()` |
| HIGH priority schedules `notifications.urgent-sms-fallback` on the shared queue, key `notif-fallback:<id>`, runAt = now + 60 s. No `setTimeout`. | `dispatch()` |
| Fallback sends exactly one `SMS_FALLBACK` when `acked_at` is still NULL, safe under re-runs and concurrent workers (row lock) | `runUrgentFallback()` |
| Only the owner can acknowledge; acknowledging twice keeps the first `acked_at` | `acknowledge()` |

Notes for the team:

- **BE-2 (core/jobs):** this module uses `registerHandler(name, handler)` and `scheduleJob(name, payload, runAt, idempotencyKey)`, the agreed internal contract implemented on `feat/be2-core-jobs`. Pass the `jobs` instance from core/jobs as `scheduler`.
- **BE-1 (migrations):** the SMS row is linked to its source alert by owner + booking + title. A `parent_notification_id` column in a future migration would make the link explicit.
- Push payloads must not carry clinical detail beyond need-to-know (test strategy, Tier 4).

Tests: `test/integration/core-notifications.test.ts` (fake clock, real PostgreSQL).
