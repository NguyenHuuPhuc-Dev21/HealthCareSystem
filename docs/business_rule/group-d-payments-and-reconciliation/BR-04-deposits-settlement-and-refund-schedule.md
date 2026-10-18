# BR-04: Deposit Requirements, Settlement & Refund Schedule

> **Group:** Group D — Payments, Refunds & Reconciliation  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-03 (Minimum visit fee), Q-09 (Add-on cap), Q-11 (Deposit invoice timing), Q-30 (Disputed line deposit allocation), Q-31 (Emergency visit fee waiver), Q-33 (Two-stage invoice confirmation), Q-38 (On-demand refund table)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Securing Nurse Dispatch:** Requiring an immediate upfront electronic deposit prevents fraudulent bookings and secures nurse scheduling commitments.
2. **Transparent Dispute & Settlement Mechanics:** Establish clear financial rules for final invoice settlement, cancellation penalties, and end-of-period reconciliation audits.

---

## 2. Rule Specifications

### 2.1 30% Upfront Electronic Deposit
- Upon nurse acceptance (advance booking) or clicking "Order Accepted" (on-demand), the patient has **15 minutes** to pay the deposit via the hospital payment gateway.
- Deposit calculation formula:
  $$	ext{Deposit} = \max(30\% 	imes 	ext{Estimated Service Total}, 50,000	ext{ VND})$$
- **Deposits are collected strictly via electronic payment gateways.** Cash deposits are prohibited.
- Invoicing timing for deposits is governed by hospital accounting policy (Q-11).

### 2.2 Two-Stage Final Invoice Confirmation (Q-33)
- **Stage 1 (On-Site Confirmation):** Patient confirms the itemized statement on-site within **15 minutes** (silence defaults to confirmation for immediate gateway/cash collection).
- **Stage 2 (24-Hour Dispute Window):** Patient retains the right to file fee-line disputes within **24 hours** after payment:
  - *Branch F1a (Unpaid Lines):* Overdue adjudication auto-waives the line.
  - *Branch F1b (Paid Lines):* Overdue hospital review escalates to SaaS Platform Admin; never auto-waived in code (Q-44). Approved refunds are issued manually via UC90 with credit vouchers.
- **Cash Collection Safeguard:** Cash collection of remaining balances is permitted **only if the patient explicitly confirms all undisputed line items**.
- **Unsafe Environment / Emergency Stops:** The 15-minute on-site window is waived; the patient confirms and pays via gateway within 24 hours.

### 2.3 Remaining Balance & Debt State (`Cong_no`)
- Balance formula: $	ext{Balance Due} = 	ext{Total Service} + 	ext{Confirmed Add-Ons} - 	ext{Deposit Paid}$.
- Unsettled balances remain in `Pending Payment` (`Cho_thanh_toan`) for up to **24 hours**.
- If unpaid past 24 hours, the order transitions to `Outstanding Debt` (`Cong_no`), triggering automated booking blocks for all account profiles (BR-14).

### 2.4 Allocation of Deposit for Disputed Lines (Q-30)
- When a fee line is disputed, collected deposit funds are allocated **first to cover disputed lines** (up to their exact value) and held in escrow until dispute resolution.
- Any remaining deposit is applied toward undisputed line items.

### 2.5 Cancellation Refund Schedule
#### Advance Bookings:
- Cancellation $> 12	ext{ hours}$ before visit: **100% refund**.
- Cancellation $2	ext{h} – 12	ext{h}$ before visit: **50% refund**.
- Cancellation $< 2	ext{ hours}$ before visit or nurse has departed: **0% refund** (deposit retained to compensate nurse travel and lost scheduling).

#### On-Demand Bookings (Q-38):
- Nurse has NOT clicked "Departed": **100% refund**.
- Nurse has clicked "Departed": **0% refund**.

### 2.6 Departure Definition & Fault Allocation
- "Departed" is legally verified when the nurse clicks "Departed" in the mobile app (enabling location tracking, UC38).
- If the departure deadline ($T_{	ext{depart}}$) passes without the nurse clicking "Departed", the fault lies with the nurse/hospital: the patient can cancel for a **100% refund**.
- Patient absence verified on-site (UC89) yields **0% refund**.
- Service infeasible due to patient clinical condition:
  - Discovered *before departure*: **100% refund**.
  - Discovered *after departure (non-emergency)*: System deducts the minimum home-visit fee (Q-03) and refunds any surplus deposit.
  - Discovered *after departure (acute medical emergency 115)*: **Zero minimum visit fee**; only completed care items billed; hospital absorbs travel costs (Q-31).
- Cancellations resulting from hospital/nurse fault (active reassignment, departure delay, excessive tardiness, shift abandonment, fast match timeout) or emergency symptoms entered by patient **ALWAYS yield a 100% refund**.

### 2.7 End-of-Period Deposit Reconciliation (Flow 11)
Deposit reconciliation categorizes all collected deposits into four balance groups:
1. `Deducted toward completed invoices`
2. `Refunded to patients`
3. `Retained as cancellation forfeitures`
4. `Held in escrow for active disputes`
- The sum of all four categories must reconcile perfectly against total gateway deposits collected; discrepancies trigger formal audit investigations (BR-18 F7).

---

## 3. Traceability & Dependencies

- **Use Cases:** UC34, UC36, UC45, UC90, UC91, UC121–UC123, UC126
- **Activity Flows:** Flow 07B, Flow 08 (Billing), Flow 09 (Cancellation & Refunds), Flow 11 (Reconciliation)
- **Governing Decisions:** Q-03, Q-09, Q-11, Q-30, Q-31, Q-33, Q-38
