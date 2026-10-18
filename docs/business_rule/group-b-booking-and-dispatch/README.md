# Group B — Booking & Dispatch Governance

This group specifies scheduling rules, operational hours, geographic constraints, capacity controls, and nurse matching engines for the Home-Care Nursing Platform.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability |
| :--- | :--- | :--- | :--- |
| **BR-03** | [Operating Hours & Service Windows](BR-03-operating-hours-and-slot-windows.md) | Standard operational windows (17:00–21:30), slot duration calculations, off-hours restrictions. | UC9, UC19, UC24, UC109 · Flows 04, 05 |
| **BR-06** | [Geographic Service Radius & Distance Limits](BR-06-geographic-service-radius.md) | Travel distance (15 km / 45 min), non-provincial radius validation, actual location over domicile. | UC27, UC108 · Flows 04, 05 |
| **BR-14** | [Booking Prerequisites & Debt Restrictions](BR-14-booking-prerequisites-and-debt-blocks.md) | Debt lock (`Cong_no`), max 3 active bookings per profile, schedule collision buffers. | UC18, UC19, UC120 · Flows 04, 05, 09 |
| **BR-13** | [Advance Booking, Nurse Selection & Rescheduling](BR-13-advance-booking-and-rescheduling.md) | 2h–14d advance window, shift capacity caps, timed reminders, nurse replacement workflows. | UC37, UC45, UC78, UC88, UC112–UC120, UC133 · Flows 04, 06, 09 |
| **BR-08** | [Fast Match Engine for On-Demand Bookings](BR-08-fast-match-engine.md) | Hard eligibility filters, priority scoring, 15-minute matching window (Non-pilot feature). | UC24, UC25, UC30–UC33, UC37, UC85, UC87 · Flow 05 |
| **BR-01** | [Auto-Assignment Order Confirmation & Minor Infractions](BR-01-auto-assignment-and-minor-infractions.md) | No-rejection rule for idle nurses, 5-min acceptance SLA, sliding window violation tracking, zero fines. | UC31–UC33, UC115 · Flows 05, 06 |
