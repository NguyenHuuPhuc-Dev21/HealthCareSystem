# BR-05: Platform Commission & Cash Handling

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Scope Notice:** Cash transactions are excluded from Pilot Q-23 (online gateway only); cash rules apply when cash collection opens.  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Non-Custodial Financial Architecture:** The SaaS platform operates as a software intermediary and **never acts as a payment escrow or money-transmitter**. The hospital contracts directly with licensed payment gateways.
2. **Strict Cash Remittance Controls:** Prevent nurse embezzlement or loss of cash collected in the field through strict remittance deadlines and audit reconciliations.

---

## 2. Rule Specifications

### 2.1 Non-Custodial Fund Flow
- The hospital registers directly with payment gateway providers and holds the merchant account.
- Patient payments flow directly into the hospital's commercial bank account. **The SaaS platform never holds, intercepts, or escrows transaction funds**.

### 2.2 SaaS Platform Service Commission
- Platform fees are billed as a **percentage (%) per completed visit** (including cash-settled visits), calculated against total visit gross billings including add-ons.
- Contracts may include fixed monthly platform subscription fees.

### 2.3 Field Cash Collection & 48h Remittance Window
- For cash-settled visits, collection amounts are confirmed by nurse entry and verified by patient signature/app confirmation.
- The visiting nurse must remit all collected cash to the hospital treasury within **48 hours**.
- If overdue (> 48 hours): An automated alert is issued, and the nurse's account is temporarily suspended from receiving cash-eligible shifts.

### 2.4 Monthly Platform Commission Invoicing & Reconciliation
- At month-end, the platform reconciles completed visits against payment gateway webhooks and treasury cash receipts.
- A platform commission invoice is issued to the hospital.
- If a data discrepancy arises: The hospital has a **7-day reconciliation window** to provide accounting explanations (BR-18 F7), supported by bank statements (UC111).

---

## 3. Traceability & Dependencies

- **Use Cases:** UC46–UC48, UC95, UC110, UC111, UC124, UC125
- **Activity Flows:** Flow 10 (Platform Billing), Flow 11 (Monthly Reconciliation)
