# Security Policy Group 5 — Payments, Deposits & Gateway Webhooks

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-04, BR-05, BR-18, UC45–UC48, UC90, UC121) |
| **Applicable Scope** | Payment Gateway Integrations, Deposit Holds, Refunds, Webhooks, Financial Ledgers, Reconciliation |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Compliance Scope** | PCI-DSS Scope Minimization (Zero Cardholder Data Environment) & Anti-Fraud Controls |

---

## Payments & Financial Integrity Rules

### SEC-5.1 [P0] Zero Cardholder Data Environment (PCI Scope Minimization)
- The home-care platform must maintain a **zero cardholder data footprint**: all payment card and banking interactions are hosted exclusively within the certified payment gateway’s iframe, redirect checkout, or client-side SDK.
- The platform’s servers and databases store only non-sensitive gateway transaction tokens, settlement references, amounts, and the masked last 4 card digits (if returned by the gateway).
- Logging, persisting, or transmitting Primary Account Numbers (PAN), CVV/CVC codes, or card expiration dates across the platform infrastructure is strictly prohibited.

### SEC-5.2 [P0] Server-Authoritative Financial Computation
- All payment amounts—including the mandatory 30% advance deposit (minimum 50,000 VND), in-session add-on item charges, and final balance settlements—must be computed exclusively by backend calculation services based on hospital configuration tables and validated clinical records.
- Any payment amount submitted directly by the client browser or mobile app is treated as an untrusted assertion and must be cross-checked against backend calculations; discrepancies result in immediate transaction rejection.

### SEC-5.3 [P0] Cryptographic Webhook Verification & Anti-Replay Safeguards
- Inbound payment notifications from payment gateway partners must be accepted strictly via authenticated webhooks protected by HMAC-SHA256 cryptographic signatures.
- Signatures must be verified against shared secrets stored in the cloud secret manager prior to executing any database state changes.
- Inbound webhooks must implement strict anti-replay validation using unique transaction reference IDs and timestamp validation windows (rejecting requests with timestamp deviations > 5 minutes).
- Webhook endpoints must reject any request originating from unverified IP ranges or failing signature verification.

### SEC-5.4 [P0] Idempotency Across All Financial Transactions
- All deposit authorizations, post-visit charge settlements, and refund requests must enforce strict **idempotency keys** (UUIDv4 generated per business intent).
- In the event of network retries, duplicate webhook deliveries, or multiple user clicks, the system must guarantee that exactly one financial transaction is executed.
- Refund operations (**UC90**) must execute exactly once per authorized refund decision record, backed by unique database-level constraints.

### SEC-5.5 [P0] Immutable Double-Entry Append-Only Financial Ledger
- All monetary movements (deposits collected, refunds disbursed, platform commission deductions, nurse earnings allocations) must be recorded in an immutable, append-only financial ledger.
- In-place updating (`UPDATE`) or row deletion (`DELETE`) of ledger records is strictly blocked at the database engine level via database triggers and user permission grants.
- Financial corrections and dispute resolutions must be executed exclusively via compensating journal entries referencing the original transaction, policy justification, and authorizing personnel.

### SEC-5.6 [P0] Segregation of Duties for Financial Approvals
- The platform must enforce strict segregation of duties: the personnel initiating a manual refund order cannot be the sole approver for amounts exceeding defined thresholds.
- Escalated financial dispute resolutions (Workflow F1b per **BR-18**) executed by Platform Administrators must document comprehensive rationale and be cross-linked to user stories **US-HP-28** and **US-HP-34**.

### SEC-5.7 [P1] Automated Gateway Settlement Reconciliation
- Execute automated, scheduled daily reconciliation jobs comparing the internal system ledger against settlement clearing files provided by the payment gateway (**Flow 11**).
- Any detected discrepancies (missing deposits, unrecorded refunds, fee variance) must automatically generate critical operational alerts, log an audit record, and freeze the disputed balance until resolved by finance personnel (**Table F, F7**).
