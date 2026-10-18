# Group C — Care Visit Execution Governance

This group specifies on-site clinical execution rules, nurse departure protocols, geofenced verification, clinical prescription handling, care reporting, and early session abort workflows.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability |
| :--- | :--- | :--- | :--- |
| **BR-07** | [Departure, Geofenced Check-In & Shift Abandonment](BR-07-departure-geofenced-checkin-and-abandonment.md) | Departure deadlines, geofence + in-app code validation, tardiness, shift abandonment ("Bom ca"). | UC38, UC40, UC77, UC89 · Flows 06, 07A, 07B |
| **BR-15** | [Medical Orders & In-Session Clinical Add-Ons](BR-15-medical-orders-and-in-session-addons.md) | Prescription validation, Tier A/B/C in-session add-ons, physician authorization, refusal rights. | UC18, UC91, UC136, UC137, UC140 · Flows 04, 07C |
| **BR-22** | [Mandatory Clinical Care Report](BR-22-mandatory-clinical-care-report.md) | Universal mandatory post-visit reporting, service-specific forms, 2h/24h escalation timeouts. | UC41–UC44, UC127 · Flows 07B, 15 |
| **BR-16** | [Mid-Session Abort & Early Termination](BR-16-mid-session-abort-and-partial-billing.md) | Clinical/safety abort conditions, partial item billing, provisional fee freeze, linked child orders. | UC41, UC43, UC92, UC127, UC128 · Flows 15, 06, 08 |
