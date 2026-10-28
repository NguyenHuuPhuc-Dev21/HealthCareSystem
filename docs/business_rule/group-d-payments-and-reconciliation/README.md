# Group D — Payments, Refunds & Reconciliation Governance

This group specifies the money rules of the on-demand nursing marketplace under SRS v2.0: the two payment methods (bank-transfer prepayment held in simulated escrow, and cash paid to the nurse at shift end), the nurse's upfront 300,000 VNĐ deposit wallet (SLA penalties only), the 24-hour settlement cycle, the §5.2 cancellation/refund schedule, the 15% platform commission, and the adjudication outcomes that replace the former hospital F1a–F9 overdue matrix.

> **Model change notice:** In this model the platform **does hold** prepaid customer funds in a simulated escrow ledger for transfer bookings (SRS §1.3). The hospital baseline's non-custodial architecture, its 30% patient deposit, and its F1a–F9 timeout-default matrix are abolished.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability (SRS v2.0) |
| :--- | :--- | :--- | :--- |
| **BR-04** | [Deposit Wallet, Settlement & Refund Schedule](BR-04-deposits-settlement-and-refund-schedule.md) | 100% transfer prepayment into escrow, upfront 300,000 VNĐ nurse deposit (penalties only), 24h settlement (85/15), §5.2 refund schedule. | FR-PAY-01, FR-PAY-02, FR-PAY-03, FR-PAY-04 · SRS §5.1, §5.2 |
| **BR-05** | [Platform Commission & Cash Handling](BR-05-platform-commission-and-cash-handling.md) | 15% commission: deducted at settlement (transfer) vs nurse self-payment via VietQR/Payment Link within 24h (cash); tips excluded; escrow holding stated explicitly. | FR-PAY-01, FR-PAY-02 · RISK-06 · SRS §5.1 |
| **BR-18** | [SLA Penalties & Financial Adjudication Outcomes](BR-18-overdue-financial-adjudication-matrix.md) | §5.2 penalty table, dispute outcomes (RESOLVED_CUSTOMER / RESOLVED_NURSE / Phase-2 partial), PENALTY_DEDUCT and commission-debt handling. | FR-DISP-01, FR-DISP-02, FR-PAY-03 · SRS §5.2 |
