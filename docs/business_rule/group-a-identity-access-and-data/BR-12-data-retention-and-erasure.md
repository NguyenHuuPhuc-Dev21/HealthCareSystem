# BR-12: Data Erasure & Statutory Retention Restrictions

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-14 (Statutory clinical/financial document retention schedules pending legal counsel), Q-34 (Relative erasure via email link)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Compliance with Data Privacy Laws:** Honor the patient's "Right to Erasure" within strict service-level agreements (72 hours).
2. **Harmonization with Medical & Tax Record Laws:** Clinical care documentation and tax invoices must be legally preserved. The system reconciles privacy requests by anonymizing and access-locking statutory records rather than deleting them.

---

## 2. Rule Specifications

### 2.1 Erasure Processing SLA
- Data erasure requests must be fully processed within **72 hours** from the point when all business/legal holds expire.
- Alert escalation thresholds:
  - 24 hours remaining: Automated alert to SaaS Platform Admin.
  - Overdue (> 72 hours): Secondary urgent alert and recorded in the monthly SLA report submitted to the Product Owner.

### 2.2 Statutory Preservation Overrides (Q-14)
- Medical care reports, clinical visit notes, financial vouchers, and tax invoices mandated by law **are access-locked and anonymized, but not deleted**.
- The patient is provided with a transparent breakdown specifying which categories are retained and the governing statutory obligations.

### 2.3 Legal & Operational Holds
Data erasure is automatically deferred if any of the following active holds exist:
- Ongoing or scheduled home-care visits.
- Open disputes or fee-line complaints.
- Outstanding debts (`Cong_no`).
- Pending deposit refunds.
- Active doctor follow-up care plans.

### 2.4 Authorization & Re-Authentication Protocols (Q-34)
- **Account Owners:** May request erasure for their personal account and for dependent profiles created under their representation attestation.
- **Consenting Adult Relatives:** Relatives who consented independently via email link must initiate their erasure request via a secure link sent to their email (Q-34); the account owner can only unlink the profile from their account.
- All erasure requests require explicit re-authentication via an email OTP prior to execution.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC61–UC65, UC104–UC106
- **Activity Flows:** Flow 14 (Data Erasure & Account Deletion)
- **Governing Decisions:** Q-14 (Retention period schedules), Q-34 (Relative erasure link)
