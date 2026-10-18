# Security Policy Group 9 — Logging, Observability & Incident Response

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-09, BR-11, BR-18, BR-21, BR-23, UC17, UC140, Decision Q-14) |
| **Applicable Scope** | Immutable Audit Trails, Security Information and Event Management (SIEM), Breach Notification, Incident Handling |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Regulatory Mandate** | 72-Hour Breach Notification Obligation under Vietnam Decree 13/2023/ND-CP |

---

## Logging, Observability & Incident Response Rules

### SEC-9.1 [P0] Immutable Append-Only Audit Logging
Every high-impact or sensitive operational event must generate an immutable, append-only audit record:
- User authentication events (successful logins, failed attempts, 2FA challenges, password resets).
- Administrative permission grants, role adjustments, and account suspensions.
- Patient clinical record views and care report accesses (recording Actor ID, Target Patient ID, Timestamp, Action).
- Financial ledger adjustments, manual refund approvals, and settlement modifications.
- Hospital facility configuration alterations (pricing changes, revenue split modifications).
- SaaS Platform Administrator actions conducted within tenant environments.

*Audit logs must be protected against modification and deletion even by standard database administrators, and all timestamps must synchronize via Network Time Protocol (NTP).*

### SEC-9.2 [P0] Automated Real-Time Threat & Anomaly Alerting
The observability monitoring system must trigger instantaneous, high-priority operational alerts upon detecting:
- Repeated authentication and OTP verification failures from a common user, IP, or subnet.
- Sequential resource ID probing (e.g., bursts of HTTP `403 Forbidden` or `404 Not Found` indicating active BOLA/IDOR scans).
- Blocked cross-tenant access attempts.
- Anomalous bulk data export requests.
- Unauthorized modifications to hospital billing configurations or payment gateway credentials.
- **Safety Critical:** Any emergency SOS alert remaining unacknowledged by the hospital triage team for **> 5 minutes** (**BR-23**).

### SEC-9.3 [P1] Formal Incident Response Playbook & 72-Hour Breach Notification
- Maintain a documented, operational Incident Response Playbook identifying incident commanders, escalation paths, and severity classifications.
- Pre-scripted containment runbooks must be available for execution:
  - Emergency account lockdown and mass session invalidation.
  - Automated credential revocation and forced password reset pipelines.
  - Pre-approved communication templates for notifying affected hospitals and patients.
- **Statutory 72-Hour Notification Rule:** In the event of a confirmed personal data breach affecting patient health data, the legal and security teams must execute the statutory notification procedure to competent regulatory authorities within **72 hours** of discovery pursuant to **Decree 13/2023/ND-CP**.

### SEC-9.4 [P1] Centralized, Isolated Log Retention
- Application logs and security audit trails must be forwarded in near real-time to a centralized, access-segregated log repository (e.g., Amazon OpenSearch, Datadog, or write-once cloud storage).
- Log retention periods must comply with the statutory timeline established under **Decision Q-14**.
- Access to audit log stores must be strictly segregated from primary application infrastructure, ensuring that an attacker gaining administrative access to an application server cannot delete or tamper with their forensic trail.
