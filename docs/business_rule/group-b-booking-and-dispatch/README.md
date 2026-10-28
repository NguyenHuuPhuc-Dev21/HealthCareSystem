# Group B — Booking & Dispatch Governance

> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

This group specifies booking windows, geographic radius, matching mechanisms, and the prerequisite gates and debt blocks for the HealthCareSystem on-demand nursing marketplace. There are no hospital operating hours and no hospital facilities: matching is driven by nurse-declared availability, GPS radius waves, tier gating, and the upfront deposit.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | SRS v2.0 Traceability |
| :--- | :--- | :--- | :--- |
| **BR-03** | [Booking Windows, Shift Types & Night Hours](BR-03-operating-hours-and-slot-windows.md) | Task-based + shift-based (4h/8h/12h/24h) bookings; night hours 22:00–06:00 at +20% on the base price; 15-minute payment hold (DRAFT → EXPIRED); urgency split at 6 hours; nurse-declared availability with 60-minute travel buffer. | §1.2 · §4.2 FR-SCHED-01 · §4.3 FR-BOOK-01 / FR-BOOK-03 · §5.1 |
| **BR-06** | [Geographic Service Radius & Distance Limits](BR-06-geographic-service-radius.md) | Radar radius waves 5 km → 10 km measured from the care location to the nurse's GPS position; PostGIS spatial filtering; distinction from the 200 m check-in radius. | §4.3 FR-BOOK-03 · §7 · §9.3 |
| **BR-14** | [Booking Prerequisites & Debt Blocks](BR-14-booking-prerequisites-and-debt-blocks.md) | Customer gates: CCCD eKYC for home care, NĐ 13/2023 consent, y lệnh + Admin review for invasive bookings, prohibited services unbookable. Nurse gates: 300,000 VNĐ upfront deposit; SUSPENDED on unpaid cash commission > 24h, deposit shortfall, or TrustScore < 60. | §2.3 · §4.1 FR-AUTH-03 / FR-PRIV-01 · §4.3 FR-BOOK-02 / FR-BOOK-03 · §4.5 FR-PAY-02 / FR-PAY-03 |
| **BR-13** | [Advance Booking, Direct Selection & Shift Extension](BR-13-advance-booking-and-rescheduling.md) | Advance bookings (> 6h) on the Job Board; direct nurse selection with a 15-minute response window; in-app shift extension in 1-hour multiples (FR-SHIFT-03); no self-service rescheduling in SRS v2.0 — changes resolve via the §5.2 cancellation matrix. | §4.2 FR-SEARCH-01 · §4.3 FR-BOOK-03 · §4.4 FR-SHIFT-03 · §5.2 |
| **BR-08** | [Matching Engine — Radar Dispatch & Job Board](BR-08-fast-match-engine.md) | Two separated mechanisms (FR-BOOK-03): Radar push waves for urgent bookings, Job Board broadcast for advance bookings; hard eligibility filters (status, tier, deposit, availability); first-come claim via Redis Lock / SELECT FOR UPDATE; schedule-conflict exclusion with 60-minute buffer. | §4.2 FR-SCHED-01 · §4.3 FR-BOOK-03 · NFR-SEC-01 |
| **BR-01** | [Matching, Assignment & Minor Infractions](BR-01-auto-assignment-and-minor-infractions.md) | Voluntary first-come claiming on Radar / Job Board / direct request; TrustScore discipline (−5 / −20 / −25, +2 recovery, < 60 → SUSPENDED); no-show escalated out of this rule to immediate BANNED. | §2.3 · §4.3 FR-BOOK-03 · §4.6 FR-RATE-01 · §5.2 |
