# Group D — Payments, Refunds & Reconciliation Governance

This group specifies financial accounting rules, online deposit requirements, invoice settlement, cancellation refund schedules, platform commission, and the master overdue adjudication decision matrix (Rules F1a–F9).

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability |
| :--- | :--- | :--- | :--- |
| **BR-04** | [Deposit Requirements, Settlement & Refund Schedule](BR-04-deposits-settlement-and-refund-schedule.md) | 30% online deposit (min 50k VND), 24h pending payment, time-tiered cancellation refund tables. | UC34, UC36, UC45, UC90, UC91, UC121–UC123, UC126 · Flows 07B, 08, 09 |
| **BR-05** | [Platform Commission & Cash Handling](BR-05-platform-commission-and-cash-handling.md) | Hospital gateway merchant account, 48h cash remittance, monthly platform commission billing. | UC46–UC48, UC95, UC110, UC111, UC124, UC125 · Flows 10, 11 |
| **BR-18** | [Overdue Financial Adjudication Matrix (Table F)](BR-18-overdue-financial-adjudication-matrix.md) | Master resolution table for expired financial decisions (Rules F1a through F9), SLA timeouts, cost allocation. | UC36, UC53, UC90, UC100 · Flows 06, 08, 09, 11, 12, 15 |
