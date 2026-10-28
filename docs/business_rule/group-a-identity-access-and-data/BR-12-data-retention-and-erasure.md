# BR-12: Data Retention & Erasure

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §0.3 (REF-LAW-03), §2.3, §3 (RISK-03), §4.1 (FR-PRIV-01), §7  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Compliance with Personal Data Law:** Health data is sensitive personal data under **Nghị định 13/2023/NĐ-CP** (REF-LAW-03). Data subjects hold rights to request deletion / anonymization of their personal data (FR-PRIV-01).
2. **Retention for Lookup & Legal Purposes:** Medical / care records must remain retrievable for a bounded period to serve dispute handling and legal obligations, after which the erasure/anonymization right applies.
3. **Immutable Financial & Audit Trails:** The wallet ledger (`wallet_transactions`) is an **immutable ledger** and `audit_logs` are append-only; erasure is reconciled by anonymizing personal identifiers rather than rewriting ledger or audit history.

---

## 2. Rule Specifications

### 2.1 Medical Record Retention (FR-PRIV-01)
- Medical / care records are retained for a **maximum of 24 months** for lookup and legal purposes (FR-PRIV-01).
- Nurse access to a record ends far earlier — **12 hours after check-out** (BR-09 §2.4). Retention governs platform-side storage, not nurse visibility.

### 2.2 Erasure / Anonymization Right (FR-PRIV-01, RISK-03)
- The platform supports the function **"Request deletion / anonymization of personal data"** in accordance with Nghị định 13/2023/NĐ-CP (FR-PRIV-01).
- Patient profiles support soft deletion / anonymization via `patient_profiles.deleted_at` (SRS §7).
- Every deletion of patient data is recorded in `audit_logs` with action type `DELETE_PATIENT_DATA` (actor, target, IP, timestamp).

### 2.3 Account Closure & Deposit Withdrawal Condition (SRS §2.3)
- A nurse's deposit (`deposit_balance`) may be withdrawn **in full only when the nurse stops cooperating and closes the account, after 7 days with no disputes**.
- Until that condition is met, the deposit remains locked as security for SLA penalties (BR-14, FR-PAY-03); account closure does not bypass the 7 dispute-free days condition.

### 2.4 Holds Deferring Erasure / Closure
Erasure or account closure is deferred while any of the following is active:
- An open or under-review dispute (`dispute_status` = `OPEN` / `UNDER_REVIEW`) involving the data subject.
- An unfinished booking (`execution_status` not in `COMPLETED` / `CANCELLED` / `EXPIRED`) or an unsettled payment (`payment_status` not in `SETTLED` / `REFUNDED`).
- For nurses: the 7 dispute-free days condition of §2.3 has not yet elapsed.

### 2.5 Open Items
- [Not specified in SRS v2.0 — open item] Processing SLA for erasure requests (the old hospital-baseline 72-hour SLA and its alert-escalation thresholds are **not** carried over; SRS v2.0 sets no deadline).
- [Not specified in SRS v2.0 — open item] Retention periods for financial records, chat/call logs (`conversations_messages`), and notifications beyond the 24-month medical-record rule.
- [Not specified in SRS v2.0 — open item] The re-authentication method required before an erasure request is executed.

---

## 3. Traceability & Dependencies

- **SRS References:** §0.3 REF-LAW-03 (Nghị định 13/2023/NĐ-CP), §2.3 (Wallet lifecycle — deposit withdrawal), §3 RISK-03, §4.1 FR-PRIV-01, §7 (`patient_profiles.deleted_at`, `wallet_transactions`, `audit_logs`)
- **Related Rules:** BR-09 (record-access window & audit logging), BR-17 (consent lifecycle & withdrawal), BR-21 (credential document storage)
