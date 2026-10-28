# BR-15: Medical Orders & In-Session Add-Ons

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** SRS §4.2 (Service Catalog), FR-BOOK-01, FR-BOOK-02, FR-SHIFT-03, FR-AUTH-02, FR-ADMIN-01, RISK-01, RISK-02  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Strict Medical Legality:** Invasive procedures at home (injections, IV maintenance infusion, complex wound care, catheter care) are lawful only when performed by a nurse with a valid practice license (GPHN) **and** against a genuine, in-date doctor's order (y lệnh). The platform enforces both conditions in the booking flow itself, not by after-the-fact audit.
2. **Controlled In-Session Scope Changes:** The only in-session scope change SRS v2.0 defines is a **time extension** of the running shift (FR-SHIFT-03), repriced from system configs and paid/confirmed before the shift continues. There is no tiered add-on catalog in this model.

---

## 2. Rule Specifications

### 2.1 Service Catalog Gating (SRS §4.2, RISK-02)

Every service in `service_categories` belongs to exactly one of three groups, enforced by the `is_invasive` / `is_prohibited` flags and `required_tier`:

| Group | Flags | Who may perform | Examples |
| :--- | :--- | :--- | :--- |
| **Group 1 — Non-invasive care** | `is_invasive = false` | TIER_1_BASIC and TIER_2_SPECIALIST | Bedside care shifts (4h/8h/12h/24h), hygiene, feeding assistance, medication reminders, non-invasive vital-signs monitoring |
| **Group 2 — Conditional invasive services** | `is_invasive = true` | **TIER_2_SPECIALIST only** (valid GPHN, correct scope) **+ mandatory doctor's order** | Subcutaneous/intramuscular injections per prescription, maintenance IV infusion per order, complex wound dressing & suture removal, catheter care, gastric-tube feeding |
| **Group 3 — Strictly prohibited** | `is_prohibited = true` | **Nobody — booking creation is blocked** | Blood/plasma transfusion at home, IV antibiotics or other high-anaphylaxis-risk drugs not first administered in a facility, any anesthesia/minor surgery at home, issuing new prescriptions or altering a doctor's treatment plan |

- A TIER_1_BASIC nurse calling the accept API for an `is_invasive = true` booking receives **HTTP 403** (SRS §10, TC-AUTH).
- Prohibited services are blocked at the UI and by description-keyword filtering; no booking can be created for them (RISK-02).
- Admin governs the catalog itself — creating/editing/hiding services and toggling `is_invasive` (FR-ADMIN-01) — and governs who may perform invasive work by verifying GPHN credentials and assigning tiers (FR-AUTH-02). Per-booking Admin pre-approval of an individual doctor's order is **not** part of SRS v2.0; order review is assigned to the Tier-2 nurse (§2.2) — **[Not specified in SRS v2.0 — open item]** if an Admin pre-approval layer is later desired.

### 2.2 Two-Layer Doctor's-Order (Y lệnh) Control (FR-BOOK-02, RISK-01)

For every booking with `is_invasive = true`, the order passes three checkpoints:

1. **At booking creation (upload gate):** The customer **must** upload a photo of the doctor's order/prescription — clearly showing the patient name, drug name and dosage, the doctor's signature/stamp, and an issue date **≤ 7 days** old — and enter the order's issue date (`prescription_issued_date`). A booking without the image is rejected with **HTTP 400**.
2. **Before accepting the shift:** The Tier-2 nurse reviews the uploaded order image in the app before tapping "Accept".
3. **On site at check-in (original-document check):** The nurse compares the **paper original** and the actual medication against the uploaded image. If the order is forged, expired, altered, or the medication does not match, the nurse taps **"Reject shift — invalid medical order"** and attaches photo evidence:
   - The booking is cancelled immediately (`execution_status = CANCELLED`).
   - The nurse is **not penalized** — no deposit deduction and no TrustScore deduction.
   - The nurse receives travel-cost compensation for the trip made.

### 2.3 In-Session Additions = Shift Extension Only (FR-SHIFT-03)

The single in-session addition mechanism in SRS v2.0 is extending the running shift:

- **Who/when:** The customer requests the extension **at least 30 minutes before the scheduled end**, in **multiples of 1 hour**, via `POST /api/v1/bookings/:id/extend`.
- **Nurse consent:** The extension proceeds only if the nurse has no conflicting next shift and agrees in the app.
- **Repricing:** The extra time is priced from `system_configs` exactly like the original booking (base rate plus any applicable night/holiday/heavy-patient surcharges per FR-BOOK-01).
- **Payment before continuing:**
  - `BANK_TRANSFER` bookings: the customer prepays the extra amount through the payment gateway into escrow (`ESCROW_HELD`) before the extended time runs.
  - `CASH` bookings: the customer confirms the extra amount in the app; the extra is paid in cash together with the shift total at check-out. (The SRS text spells out the escrow path; the in-app customer confirmation is the cash-path equivalent.)
- Adding a **different service** mid-shift (beyond extending time) is **[Not specified in SRS v2.0 — open item]**. Group 3 (prohibited) services remain absolutely blocked in-session, and any invasive work still requires a valid y lệnh and a TIER_2_SPECIALIST nurse — an extension never widens the clinical scope of the booking.

### 2.4 Clinical Refusal Rights on Site

Beyond the invalid-order refusal in §2.2, the nurse's on-site refusal rights for a patient condition that does not match the booking declaration are governed by BR-16 §2.3 (condition-mismatch stop/report, FR-SHIFT-02). No AI component authorizes, validates, or vetoes any medical order in SRS v2.0 (see BR-10).

---

## 3. Traceability & Dependencies

- **SRS References:** SRS §4.2 service catalog (Groups 1–3); FR-BOOK-01 (pricing), FR-BOOK-02 (order control), FR-SHIFT-03 (extension), FR-AUTH-02 (tier assignment), FR-ADMIN-01 (catalog admin); RISK-01, RISK-02
- **APIs:** `POST /api/v1/bookings` (order-image gate); `POST /api/v1/bookings/:id/reject-invalid-prescription`; `POST /api/v1/bookings/:id/extend`
- **Related Rules:** BR-07 (check-in & on-site verification), BR-16 (condition-mismatch stop), BR-10 (no AI screening/triage in SRS v2.0)
