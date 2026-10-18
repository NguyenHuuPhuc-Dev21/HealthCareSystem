# BR-15: Medical Orders & In-Session Clinical Add-Ons

> **Group:** Group C — Care Visit Execution  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-13 (Approved home-care service catalog pending hospital legal sign-off)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Strict Medical Legality:** Invasive procedures (IV infusions, injections, complex surgical debridement) require verified medical orders from a licensed physician.
2. **Transparent In-Session Scope Management:** Unforeseen medical supplies or procedural adjustments on-site must follow clinical safety tiers and explicit patient consent.

---

## 2. Rule Specifications

### 2.1 Hospital Service Catalog Flags (Q-13)
Every line item in the hospital service catalog carries two mandatory legal flags:
- `Permitted for Home Care` (`Duoc_phep_lam_tai_nha`): Boolean.
- `Requires Medical Order` (`Can_y_lenh`): Boolean.
- Catalog items and clinical boundaries are approved by hospital leadership and legal counsel.

### 2.2 Pre-Booking Prescription Verification
- For services where `Requires Medical Order = True`:
  - The patient must upload an active, valid medical order/prescription during booking (UC136).
  - An on-duty hospital physician reviews the order within **30 minutes** (UC137).
  - If invalid or expired: Booking is rejected, and an in-hospital outpatient consultation is recommended.
- On-demand booking is restricted to services not requiring prescriptions, unless a pre-verified order is already attached to the patient profile.

### 2.3 Three-Tier Classification for In-Session Add-Ons (Flow 07C)
When clinical circumstances necessitate additional items during a visit, they are categorized into three distinct tiers:
- **Tier A (Permitted Nursing Scope):** Standard supplies and minor procedures within independent nursing competence aligning with the care plan. The nurse verifies checklist contraindications and records usage.
- **Tier B (Requires Clinical Evaluation / Physician Order):** Procedures requiring medical oversight. An authorized physician or clinical coordinator must approve electronically within **10 minutes** (UC137); prohibited prior to verified approval.
- **Tier C (Life-Threatening / Emergency Signs):** All approval workflows halt immediately; the system initiates the Emergency SOS procedure (BR-23).

### 2.4 Patient Financial Consent & Prohibited AI Authority
- Any billable add-on item must receive explicit patient confirmation on their mobile app **prior to administration**.
- **AI is strictly prohibited** from authorizing medications, validating prescriptions, or determining clinical procedure legality.

### 2.5 Clinical Refusal Rights on Site
- The visiting nurse is legally entitled and required to refuse procedure execution if on-site clinical assessment reveals that the patient's physiological condition is contra-indicated for the ordered procedure (routes to Flow 15, reason: "Due to patient clinical condition").

---

## 3. Traceability & Dependencies

- **Use Cases:** UC18, UC91, UC136, UC137, UC140
- **Activity Flows:** Flow 04 (Booking), Flow 07C (In-Session Add-Ons)
- **Governing Decisions:** Q-13 (Legal home-care procedure catalog)
