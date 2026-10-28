# BR-19: Customer Trust & Anti-Gaming Controls

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-RATE-01, FR-SHIFT-02, FR-DISP-01, FR-ADMIN-01, FR-AUTH-03, SRS §4.2/FR-BOOK-01 (heavy-patient surcharge), §5.2 applicability note, RISK-06  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Trust Runs in Both Directions:** Nurses are rated and sanctioned under BR-02; customers are not anonymous one-shot buyers either. SRS v2.0 gives nurses a rating voice over customers, makes the customer's condition declaration a binding input to pricing and safety, and gives Admin account-level sanctions over fraudulent customers.
2. **Scope Honesty:** SRS v2.0 defines **no** customer abuse score, no abuse flag, and no automatic anti-gaming thresholds. This rule specifies exactly the customer-trust mechanisms the SRS does define, and marks the rest as open items (§2.3) rather than carrying over the hospital baseline's 90-day abuse-score machinery.

---

## 2. Rule Specifications

### 2.1 What SRS v2.0 Defines

- **Two-sided ratings (FR-RATE-01):** At `COMPLETED`, the nurse also rates the customer (1–5 stars plus a note on the customer's cooperation), symmetric to the customer's rating of the nurse. Ratings from both sides stay **hidden until both sides have submitted or 7 days have passed** since shift end (`reviews.is_visible`), preventing retaliatory rating.
- **Binding condition declaration (FR-AUTH-03, FR-SHIFT-02):** The customer declares the patient's condition in the patient profile (weight, mobility status, medical history, infectious status). This declaration drives pricing (e.g., heavy-patient surcharge `SURCHARGE_HEAVY_PATIENT = 15%` when weight ≥ 80 kg or `mobility_status = BEDRIDDEN`) and the nurse's safety assessment.
- **Misreporting consequences (FR-SHIFT-02, FR-DISP-01):** If the on-site check (first 30 minutes after check-in) finds the declaration false, the nurse may demand a **surcharge correction** or **refuse/stop the shift with no penalty**, with the mismatch flagged on the shift record (BR-16 §2.3). "Customer misreported the patient's condition" is an explicit dispute ground; an upheld dispute applies the outcomes of BR-18 §2.2.
- **Admin account sanctions (FR-ADMIN-01):** Admin manages customer accounts with the same status ladder as nurses (`users.status`: ACTIVE / SUSPENDED / BANNED). **Verified customer fraud** — including deliberate condition misreporting to obtain cheaper or unsafe care — is sanctioned at account level, up to **BANNED**.
- **Cancellation history (SRS §5.2 note):** For cash bookings, where no cancellation fee can be collected through the system, the cancellation is recorded in the **customer's cancellation history**; transfer-booking cancellations are priced by §5.2 rows 1–3 (BR-04 §2.4).
- **Identity assurance (FR-AUTH-03, CT-14):** Home-care bookings require the customer to complete CCCD eKYC, so the account behind a booking is a verified identity — the structural anti-fraud control that replaces the old flagging regime. (At-hospital bookings require phone verification only.)

### 2.2 Interaction With Adjudication

There are no administrator-timeout defaults in SRS v2.0 for a customer flag to reverse (see BR-18 §2.6). Customer misconduct affects money only through (a) the deterministic SLA matrix, (b) surcharge correction for misreported conditions, and (c) Admin dispute rulings and account sanctions. Nothing in this rule blocks a customer from booking by default; restrictions arise only from an Admin status decision.

### 2.3 Not Specified in SRS v2.0 (Open Items)

The following hospital-baseline mechanisms are **not** carried over, and no equivalent exists in SRS v2.0 — each is **[Not specified in SRS v2.0 — open item]**:

- A numeric **customer TrustScore** with thresholds (TrustScore in SRS v2.0 exists only on `nurse_profiles`).
- An **abuse score / abuse flag** formula (e.g., the old 90-day rolling window, old Q-42), its notification/rebuttal process, and its visibility rules.
- **Automatic** booking blocks or adjudication-default changes triggered by repeat customer cancellations or disputes.
- Display rules for a customer's received ratings to nurses before acceptance, beyond the review records themselves.

---

## 3. Traceability & Dependencies

- **SRS References:** FR-RATE-01, FR-SHIFT-02, FR-DISP-01, FR-ADMIN-01, FR-AUTH-03; SRS §5.1 (`SURCHARGE_HEAVY_PATIENT`), §5.2 (applicability note), §7 (`reviews`, `users.status`)
- **APIs:** `POST /api/v1/bookings/:id/reviews`
- **Related Rules:** BR-02 (nurse-side sanctions), BR-11 (disputes), BR-16 (mismatch stop), BR-18 (adjudication outcomes), BR-05 (leakage controls, RISK-06)
