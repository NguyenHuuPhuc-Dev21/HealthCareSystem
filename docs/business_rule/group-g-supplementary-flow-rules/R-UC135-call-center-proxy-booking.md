# R-UC135: Call-Center Proxy Booking — Scope Note

> **Group:** Group G — Supplementary Activity Flow Rules  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** SRS §2.1 (actors), FR-AUTH-03, FR-PRIV-01, FR-ADMIN-01, NFR-UI-01  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version. **This file is a scope note: the topic it governed is not part of SRS v2.0.**

---

## 1. Scope Status

**Call-center / dispatcher proxy booking is not part of SRS v2.0.** SRS v2.0 defines exactly three actor groups (SRS §2.1) — Patient/Family (customer), Nurse Tier 1 / Tier 2, and Medical Admin/Operator — and **no Dispatcher or call-center role exists**. The Admin's functional scope (FR-ADMIN-01) covers credential approval, catalog & config management, user status management, dispute adjudication, and financial reconciliation; it does **not** include creating bookings on behalf of customers.

The hospital baseline's UC135 (a hospital dispatcher drafting a booking, the patient confirming consent and paying a 30% deposit through an emailed link) is **superseded in full** — there are no hospital dispatchers, no emailed consent links, and no 30% deposit in this model.

---

## 2. How Booking Works in SRS v2.0 (The Live Model)

- **Self-service only:** Bookings are created by the customer in the **Patient Web / Mobile App** (`POST /api/v1/bookings`, role PATIENT), including the Decree 13/2023 health-data consent (FR-PRIV-01) and, for home care, the customer's own CCCD eKYC (FR-AUTH-03).
- **Relatives book for the patient under their own account:** The customer actor in SRS v2.0 is "Patient / Family" — a family member holds the account, creates the **patient profile** for the person receiving care (FR-AUTH-03), gives data-processing consent as the patient or legal guardian (FR-PRIV-01), pays, and manages the booking. This — not a call center — is SRS v2.0's answer to patients who cannot use the app themselves.
- **Accessibility support is a UI concern, not a proxy channel:** Elder-Friendly UI standards (large fonts, WCAG AA contrast, ≥48dp touch targets) apply to the Nurse apps in the MVP and extend to the Patient App in Phase 2 (NFR-UI-01).

---

## 3. Open Items

- Any assisted-booking channel (call center, partner-desk, or Admin-created bookings) would require a new SRS change request defining the actor, consent capture, and payment flow — **[Not specified in SRS v2.0 — open item]**.

---

## 4. Traceability & Dependencies

- **SRS References:** SRS §2.1 (actors); FR-AUTH-03, FR-PRIV-01, FR-ADMIN-01; NFR-UI-01
- **APIs:** `POST /api/v1/bookings` (PATIENT role only)
- **Related Rules:** BR-04 (payment model — no deposit links), BR-19 (customer account & consent context)
