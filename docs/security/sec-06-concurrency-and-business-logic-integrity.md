# Security Policy Group 6 — Concurrency & Business Logic Integrity

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-02, BR-03, BR-07, BR-16, BR-22, BR-23, Flow 06, Flow 07A) |
| **Applicable Scope** | Time-Sensitive State Transitions, Race Conditions, Distributed Job Queues, Concurrency Controls |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | Race conditions (Time-of-Check to Time-of-Use / TOCTOU), double-booking, duplicate refunds, state machine bypass. |

---

## Concurrency & Business Logic Rules

### SEC-6.1 [P0] Server-Authoritative Temporal Windows
All time-sensitive business logic windows must be computed strictly against synchronized server time (UTC) and managed via reliable background job queues with distributed locks:
- **15-Minute Deposit Payment Window:** Unpaid bookings auto-cancelled upon timer expiration.
- **15-Minute Re-Matching Iteration Window (Decision Q-45):** Auto-reassigns candidates sequentially.
- **24-Hour "Pending Payment" Grace Window:** Unsettled balances convert to blocking debt.
- **5-Minute SOS Escalation SLA (BR-23):** Unacknowledged emergency alerts escalate to backup clinical leads.
- **24-Hour Visit Abandonment Cooldown (Decision Q-43):** Automated dispatch suspension release.

*Clients are never permitted to provide or manipulate expiration timestamps.*

### SEC-6.2 [P0] Atomic Resource Contention & Mutex Controls
To prevent race conditions, concurrent operations modifying shared business resources must enforce strict atomicity via database row-level locking (pessimistic `SELECT FOR UPDATE` or optimistic locking with version columns) or distributed mutex locks:
- **Nurse Dispatch Acceptance:** Preventing two nurses from simultaneously accepting the same home-care visit.
- **In-Home Check-In (UC40):** Ensuring check-in coordinates and OTP validation execute atomically.
- **Emergency Session Termination:** Handling simultaneous triggers between emergency symptom updates (Flow 07A) and on-site nurse check-in to prevent dual cancellation or duplicate refund issuance.

### SEC-6.3 [P0] Strict Backend State Machine Validation
- State transitions across Bookings, Visits, Staff Shifts, and Invoices must strictly follow the formal finite state machine defined on page 00c of the baseline activity flow.
- The backend must validate the validity of the current state before permitting a transition to the next state.
- **Prohibition of Lifecycle Jumps:** Out-of-order state transitions (e.g., attempting to advance a visit directly to "Completed" without submitting a mandatory care report under **BR-22**) must be rejected with HTTP `400 Bad Request` and recorded as an anomalous event.

### SEC-6.4 [P1] SOS Channel Abuse Management Without Blocking Emergency Access
- In the event of repeated or suspected false emergency SOS activations, the hospital administrative team may review and flag the patient's account for administrative follow-up.
- **Non-Negotiable Safety Constraint:** The platform must **never block or delay a patient’s ability to trigger real-time emergency SOS** during an active home-care visit.
- Rate limiting and throttling may be applied only to secondary notifications (such as informational SMS or redundant emails), never to the primary emergency incident intake pipeline.

### SEC-6.5 [P1] Hardened Background Job Infrastructure as an Attack Surface
- Background job workers (processing deposit expirations, escalation timers, and financial reconciliation) represent critical attack surfaces and failure vectors.
- All scheduled workers must be idempotent and guarded by distributed locks (e.g., Redis Redlock) to prevent duplicate execution across horizontal application instances.
- Background worker crashes or unhandled exceptions must trigger immediate operational alerts: a silently failing worker could prevent emergency SOS escalation or leave financial balances in an inconsistent state.
