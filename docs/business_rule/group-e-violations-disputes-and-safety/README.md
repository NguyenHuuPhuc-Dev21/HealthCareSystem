# Group E — Violations, Disputes & Safety Governance

This group specifies sanction rules, shift cancellation penalties, the dispute workflow, customer-side trust controls, and the emergency SOS protocol for the on-demand nursing marketplace under SRS v2.0. Sanctions are executed against marketplace accounts (nurse profiles and customer accounts) by the platform Admin — there are no hospital employers, hospital HR processes, or hospital response desks in this model.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability (SRS v2.0) |
| :--- | :--- | :--- | :--- |
| **BR-02** | [Shift Cancellation & Major Operational Infractions](BR-02-shift-cancellation-and-major-infractions.md) | §5.2 cancellation tiers for both sides, no-show BANNED on first offence, TrustScore < 60 suspension, major-infraction bans. | SRS §5.2 rows 6–8 · FR-RATE-01 · SRS §2.3 |
| **BR-11** | [Complaints, Dispute Resolution & Incident Escalation](BR-11-complaints-disputes-and-incidents.md) | FR-DISP-01 dispute workflow: 24h window, escrow freeze, evidence set, Admin adjudication outcomes; incident handling. | FR-DISP-01, FR-DISP-02 · FR-CHAT-01 · SRS §2.2 |
| **BR-19** | [Customer Trust & Anti-Gaming Controls](BR-19-patient-abuse-flagging.md) | Two-sided ratings, condition-declaration duty and misreporting consequences, Admin account sanctions; SRS gaps flagged. | FR-RATE-01, FR-SHIFT-02, FR-ADMIN-01 |
| **BR-23** | [Emergency SOS Signal & Incident Response](BR-23-emergency-sos-and-incident-response.md) | In-shift SOS: call 115 first, simultaneous alert with live location to family & Admin, incident logging and closure. | FR-SHIFT-05 · FR-NOTIF-01 · RISK-03 |
