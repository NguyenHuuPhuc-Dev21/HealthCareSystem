# Security Policy Group 9 — Logging, Observability & Incident Response

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (§7 `audit_logs`, FR-PRIV-01, FR-SHIFT-05, FR-NOTIF-01, FR-ADMIN-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | `audit_logs` Audit Trail, Security Monitoring & Alerting, SOS Observability, Breach Notification, Incident Handling |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Regulatory Mandate** | 72-Hour Breach Notification Obligation under Vietnam Decree 13/2023/ND-CP |

---

## Logging, Observability & Incident Response Rules

### SEC-9.1 [P0] Audit Logging via `audit_logs`
Every high-impact or sensitive event must generate a record in the `audit_logs` table (SRS §7, table 16: `actor_id`, `action_type`, `target_table`, `target_id`, `old_value`, `new_value`, `ip_address`, `created_at`). Mandatory coverage:
- **Medical-record access:** every view of a patient record or doctor's-order image (`VIEW_MEDICAL_RECORD`), including Admin re-grants of record access during dispute handling (FR-PRIV-01).
- **Credential & tier decisions:** GPHN approvals/rejections (`APPROVE_GPHN`, with `nurse_credentials.reviewed_by` identifying the Admin), tier assignments, automatic GPHN-expiry demotions and re-promotions.
- **Dispute decisions:** dispute resolution outcomes (`RESOLVE_DISPUTE`, `disputes.resolved_by`) and the money movements they trigger.
- **Configuration changes:** every `system_configs` create/update (`UPDATE_CONFIG`) with old and new values — config changes reprice the whole platform (SEC-0.7).
- **Patient-data deletion:** erasure/anonymization executions (`DELETE_PATIENT_DATA`, SEC-3.8).
- **Money movements:** settlement releases, penalty deductions, urgent-bonus credits, refunds, withdrawal approvals — each reconcilable against `wallet_transactions` (SEC-5.5).
- **Account lifecycle & authentication:** SUSPENDED/BANNED transitions (with trigger reason, e.g., no-show, TrustScore < 60, unpaid commission), Admin Portal logins with IP/Device ID (SEC-1.5), and phone-number re-bindings (SEC-1.9).

`audit_logs` is append-only: rows must not be updatable or deletable by application roles, and timestamps synchronize via NTP. Application logs complement — never duplicate — this trail and obey SEC-3.6 (no sensitive content).

### SEC-9.2 [P0] Automated Real-Time Threat & Anomaly Alerting
The monitoring system must trigger instantaneous, high-priority operational alerts upon detecting:
- Repeated OTP request/verification failures or abnormal OTP dispatch volume for a phone number, IP, or subnet (takeover and SMS-toll-fraud signals — SEC-1.8).
- Sequential resource ID probing (bursts of HTTP `403`/`404` indicating active BOLA/IDOR scanning — SEC-2.5).
- Payment webhook signature verification failures (HTTP `401` bursts — possible forgery attempts, SEC-5.3).
- Unauthorized or unexpected changes to `system_configs`, gateway credentials, or service-catalog invasive/prohibited flags.
- Mock-location check-in rejections clustering on one nurse account (fraud pattern, RISK-05).
- Ledger/reconciliation discrepancies and stalled money-moving workers (SEC-5.10, SEC-6.7).
- **Safety Critical:** SOS alerts are delivered to the family and Admin Portal with live location in under 2 seconds (TC-SOS-01); any SOS that remains unacknowledged by an operator must escalate automatically *(escalation timing is a retained engineering standard — not specified in SRS v2.0; the previous baseline used 5 minutes)*.

### SEC-9.3 [P1] Formal Incident Response Playbook & 72-Hour Breach Notification
- Maintain a documented Incident Response Playbook identifying incident commanders, escalation paths, and severity classifications.
- Pre-scripted containment runbooks must be available for:
  - Emergency account lockdown (SUSPEND/BAN) and mass session invalidation.
  - Gateway secret / signing-key revocation and rotation (SEC-8.2).
  - Freezing a wallet (`wallets.wallet_status = FROZEN`) and halting settlement workers during a financial-integrity incident.
  - Pre-approved communication templates for notifying affected customers and nurses.
- **Statutory 72-Hour Notification Rule:** In the event of a confirmed personal data breach affecting health data, the legal and security teams must execute the statutory notification procedure to competent regulatory authorities within **72 hours** of discovery pursuant to **Decree 13/2023/ND-CP**.

### SEC-9.4 [P1] Centralized, Isolated Log Retention
- Application logs and the `audit_logs` trail must be forwarded in near real-time to a centralized, access-segregated log repository (e.g., OpenSearch, Datadog, or write-once cloud storage), so an attacker with application-server access cannot erase their forensic trail.
- Retention follows the data classes of SEC-3.1 and the SRS recovery objectives (log RPO ≤ 24 hours, NFR-AVAIL-01); `audit_logs` and financial evidence are retained at least as long as the underlying records they evidence (health records: 24 months, SEC-3.8) *(specific log-retention periods beyond the SRS are a retained engineering standard — not specified in SRS v2.0)*.
- Chat/call logs retained as dispute evidence (FR-CHAT-01) are access-controlled operational records: readable only by the booking parties and, for disputes, the handling Admin — never by general log viewers.
