# R-UC135: Dispatcher-Assisted Call Center Proxy Booking

> **Group:** Group G — Supplementary Activity Flow Rules  
> **Source Baseline:** `use_case_v8.1.drawio` (Page 3 Notes, UC Catalog) + `luong_hoat_dong_v8.14.drawio` (Page 00c)  
> **Recommendation:** Formalize with dedicated flow diagram in next release.  
> **Status:** Active Operational Rule

---

## 1. Context & Business Intent

1. **Digital Inclusion for Vulnerable Patients:** Elderly patients or post-discharge patients who cannot navigate mobile apps can telephone the hospital call center or visit the hospital discharge desk.
2. **Preserving Informed Consent & Accounting Legality:** Hospital dispatchers must never bypass patient consent or accept informal offline cash deposits.

---

## 2. Rule Specifications

### 2.1 Dispatcher Assisted Booking (UC135)
- A Hospital Administrator operating in the **Dispatcher** role can create a proxy booking on behalf of a patient who contacts the hospital telephone exchange or discharge desk (UC135).

### 2.2 Mandatory Direct Patient Consent & Electronic Deposit
- Once the dispatcher drafts the booking, the system dispatches a **secure link directly to the patient's verified email address**.
- The patient (or legal relative) **must personally click the link to confirm legal consent and pay the required 30% deposit via the gateway**.
- **Zero Offline Bypass:** Under no circumstances are dispatchers permitted to click consent on the patient's behalf or accept offline cash deposits for call center bookings.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC135
- **Activity Flows:** Note on Page 3 and traceability matrix on Page 00c of `luong_hoat_dong_v8.14.drawio`.
