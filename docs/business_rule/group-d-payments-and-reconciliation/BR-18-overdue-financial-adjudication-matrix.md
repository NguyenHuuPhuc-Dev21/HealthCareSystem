# BR-18: Overdue Financial Adjudication Matrix (Table F)

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-10 (Manual nurse offset $\le 30\%$), Q-12 (Cash dispute default), Q-44 (F1b escalation to Platform Admin)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Eliminating Indefinite Deadlocks:** Financial disputes and pending approvals cannot remain open indefinitely. Every overdue administrative action must possess a deterministic, automated fallback.
2. **Equitable Default Allocations:**
   - *Standard Patients:* Fallback decisions favor the patient; the hospital absorbs costs while preserving nurse compensation.
   - *Abusive Patients (BR-19):* Decisions escalate to Platform Admin; unadjudicated timeouts favor the hospital/nurse.
   - *Audit Trail:* Every automated fallback creates a new immutable ledger entry recording the governing Rule Code (`Fx`), timestamp, and rule citation.

---

## 2. Master Overdue Adjudication Table (Rules F1a–F9)

| Rule ID | Dispute / Scenario | Responsible Decider | Notification SLA / Overdue Deadline | Default Action for Standard Patients | Action for Patients with Abuse Flag (BR-19) | Financial Cost Bearer | Mapped Flow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **F1a** | Disputed itemized fee line — **Unpaid** (on-site, prior to payment) | Hospital Admin (Accounting) | Remind: 48h<br>Overdue: 5 days | **Auto-waive** disputed line | Platform Admin decides in 3 business days; overdue $ightarrow$ maintain charge | Hospital absorbs; Nurse retains compensation | Flow 08 |
| **F1b** | Disputed itemized fee line — **Paid** (filed within 24h of payment) | Hospital Admin (Accounting); approval $ightarrow$ manual refund (UC90) + credit note | Remind: 48h<br>Overdue: 5 days | **Do NOT auto-waive** — escalate to Platform Admin to decide in 3 business days (Q-44); Admin overdue $ightarrow$ maintain charge | Platform Admin decides in 3 business days; overdue $ightarrow$ maintain charge | Per ruling: Hospital absorbs refund; Nurse retains compensation | Flow 08 |
| **F2** | Patient requests exception for deposit refund | Hospital Admin (Accounting) | Remind: 24h<br>Overdue: 48h | **Auto-approve** requested refund amount | Platform Admin decides in 3 business days; overdue $ightarrow$ maintain BR-04 % | Hospital absorbs nurse travel compensation | Flow 09 |
| **F3** | Complaint against nurse conduct (Investigation + Indemnity) | Hospital Admin (HR / Quality) | Remind: 3 business days<br>Overdue: 5 business days | **Platform Admin arbitrates**, concluding in 3 business days | Handled same as standard patient | Per ruling: Hospital or Nurse (Nurse share manually offset $\le 30\%$/period, Q-10) | Flow 12 (Manual refund UC90) |
| **F4** | Re-adjudication / Appeal | Platform Admin (if 1st ruling was Hospital) / Chief Hospital Admin / Rotational Admin | Overdue: 5 business days | **Maintain initial ruling**; record in monthly SLA report | Handled same as standard patient | Per initial ruling | Flow 12 |
| **F5** | Cash discrepancy dispute (Nurse and patient report different sums) | Hospital Admin (Accounting) | Overdue: 24h $ightarrow$ alert Admin | *Pending finalization (Q-12)* — cash excluded from Pilot Q-23 | — | — | Flow 08 |
| **F6** | Hospital confirmation of nurse absence / shift abandonment | Hospital Admin (Dispatch) | Remind: 24h<br>Overdue: 72h | **Do NOT record violation** against nurse | — | No financial transaction | Flow 06 |
| **F7** | Monthly reconciliation discrepancy justification | Hospital Admin (Accounting) | Overdue: 7 days | **Accept reconciliation figures** as declared | — | Hospital absorbs difference | Flow 11 |
| **F8** | Manual refund on payment gateway failure | Hospital Admin (Accounting) | Overdue: 3 business days | Alert Admin; refund hold preserved for patient | — | Hospital executes payment | Flow 09; post-payment in 08, 12, 15 |
| **F9** | Confirmation of reason & fees upon mid-session abort | Hospital Admin (Dispatch) | Remind: 12h<br>Overdue: 24h | **Maintain provisional fee** (Admin may only maintain or reduce); overdue retains fee | Platform Admin decides in 3 business days; overdue $ightarrow$ retain nurse-selected fee | Per reason (BR-16); reduction $ightarrow$ manual refund (UC90) | Flow 15 |

---

## 3. Core Architectural Notes on F1a vs. F1b (Q-44)

The baseline strictly differentiates financial disputes by settlement status:
- **Branch F1a (Unpaid Fee Lines):** The patient has not yet surrendered funds. Auto-waiving an unpaid line on administrative timeout carries minimal financial and legal risk.
- **Branch F1b (Paid Fee Lines):** Money has already been collected and remitted to the hospital account. The system **never automatically generates outbound cash refunds in code** without an authenticated administrative decision. Overdue F1b complaints escalate to Platform Admin arbitration.

---

## 4. Traceability & Dependencies

- **Use Cases:** UC36, UC53, UC90, UC100
- **Activity Flows:** Flow 06, Flow 08, Flow 09, Flow 11, Flow 12, Flow 15
- **Governing Decisions:** Q-10, Q-12, Q-44
