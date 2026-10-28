# Group C — Care Visit Execution Governance

This group specifies on-site shift execution rules for the on-demand nursing marketplace: geofenced check-in with anti-spoofing controls, medical-order (y lệnh) verification, in-session shift extension, early termination, and the mandatory care report submitted at check-out. All rules in this group are governed by the SRS v2.0 marketplace model — there are no hospital tenants, no hospital dispatch desks, and no physician-staffed review queues.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability (SRS v2.0) |
| :--- | :--- | :--- | :--- |
| **BR-07** | [Geofenced Check-In & Shift Abandonment](BR-07-departure-geofenced-checkin-and-abandonment.md) | GPS ≤ 200 m + anti-mock-location + live selfie check-in, first-30-minute on-site duties, nurse no-show handling. | FR-SHIFT-01, FR-SHIFT-02 · SRS §5.1, §5.2 row 8 |
| **BR-15** | [Medical Orders & In-Session Add-Ons](BR-15-medical-orders-and-in-session-addons.md) | Two-layer y lệnh verification for invasive services, prohibited-service blocking, in-session additions as shift extension. | FR-BOOK-02, FR-SHIFT-03 · SRS §4.2, RISK-01, RISK-02 |
| **BR-22** | [Mandatory Clinical Care Report](BR-22-mandatory-clinical-care-report.md) | Realtime care log during the shift and the mandatory minimal care report at check-out as the completion/settlement gate. | FR-SHIFT-02, FR-SHIFT-04 · SRS §2.2, §7 (`shift_logs`) |
| **BR-16** | [Mid-Session Abort & Early Termination](BR-16-mid-session-abort-and-partial-billing.md) | Customer early stop after check-in, task-based early completion, condition-mismatch refusal, emergency stop; no partial settlement in MVP. | FR-SHIFT-02, FR-SHIFT-04, FR-SHIFT-05 · SRS §5.2 rows 4–5 |
