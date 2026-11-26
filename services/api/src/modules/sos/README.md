# Module `sos` (BE-3 / Dev C · Phase 4)

FR-SHIFT-05 · TC-SOS-01 · BR-23. Contract: `docs/api/sos.api.md`. Runbook: `docs/runbooks/sos-response.md`.
Migration `0030_sos.sql` (`sos_alerts`, audit action `CLOSE_SOS_INCIDENT`).

| File | What |
|---|---|
| `sos.policy.ts` | who may raise, vitals from either app, position fallback, the alert text (pure) |
| `sos.repo.ts` | booking lock, `sos_alerts`, `shift_logs.emergency_incident_log` append, lists |
| `sos.service.ts` | raise (one open alert per booking, alert everyone in parallel after commit), acknowledge, report, close |
| `sos.routes.ts` | `/bookings/:id/sos`, `/sos-alerts/*`, `/admin/sos-alerts/*` |

Delivery is `notifications` (HIGH → push + in-app + WebSocket, SMS fallback at 60 s); ops-monitoring watches type `SOS`.
Tests: `test/unit/sos.test.ts`, `test/integration/sos.test.ts`.
