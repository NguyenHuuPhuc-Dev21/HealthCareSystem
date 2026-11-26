# Emergency (SOS) Response

> FR-SHIFT-05 · module `sos` (BE-3) · API `docs/api/sos.api.md` · alert `SOS_UNACKNOWLEDGED` (`monitoring-and-alerts.md`).
> The app **assists**; it never replaces the 115 emergency call.

## On site (always first)

The nurse / person present calls **115** and starts first aid. The app's SOS button opens the device dialer on 115
with no network dependency, then sends the alert.

## Platform side

1. The alert (notification type `SOS`, priority HIGH) goes to the family and every Admin: in-app + push, with GPS
   and the latest vitals; unacknowledged after 60 s → **one SMS fallback** (TC-NFR-01, core/notifications).
2. `SOS_UNACKNOWLEDGED` ALERT (no acknowledgement after 2 min) → the on-call Admin **calls the family and the nurse
   now** (phones in the Admin user detail). Do not wait for the next sweep.
3. Check delivery:

```sql
SELECT n.user_id, n.channel, n.delivery_status, n.acked_at, n.created_at
  FROM notifications n WHERE n.type = 'SOS' AND n.created_at > now() - interval '1 hour' ORDER BY n.created_at;
```

   A FAILED SMS row → provider problem (`URGENT_DELIVERY_FAILURES`); keep calling.
4. Open alerts: `GET /api/v1/admin/sos-alerts` (oldest ACTIVE first); acknowledge
   (`POST /api/v1/sos-alerts/:id/acknowledge`) once someone is handling it.
5. The nurse writes what happened (`POST /api/v1/sos-alerts/:id/report` — 115 called, hospital); every event lands in
   `shift_logs.emergency_incident_log` (`GET /api/v1/admin/sos-alerts/:id` shows it).
6. Close with the outcome (`POST /api/v1/admin/sos-alerts/:id/close {outcome, note}`, audited
   `CLOSE_SOS_INCIDENT`): `TRANSFERRED_TO_HOSPITAL`, `RESOLVED_ON_SITE` or `FALSE_ALARM`. Keep all logs for review.

## Money afterwards

Transfer to ICU / emergency → SLA row 5: 100% refund of the unused amount; fixed `ICU_TRAVEL_SUPPORT` (50,000 VND) to
the nurse if she travelled (`wallets-ledger` travel-support sweep). Verify one `REFUND` and one `TRAVEL_SUPPORT` row.
