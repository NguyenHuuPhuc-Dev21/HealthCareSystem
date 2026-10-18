# Group A — Identity, Accounts & Personal Data Governance

This group specifies foundational security, privacy, and account governance business rules for the Home-Care Nursing Platform.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability |
| :--- | :--- | :--- | :--- |
| **BR-20** | [Email-Only Identity & Communication](BR-20-email-only-identity-and-communication.md) | Single account identifier (email), 2FA for staff, dynamic in-app verification codes, zero SMS/CCCD. | UC1, UC14, UC40, UC61, UC82, UC83, UC106, UC133 · Flows 02, 03 |
| **BR-21** | [Two-Step Staff Profile Credentialing & Verification](BR-21-two-step-staff-credentialing.md) | 2-step clinical credential confirmation, practice license lifecycle tracking, daily expiry scanning. | UC5–UC8, UC10–UC12, UC69, UC81, UC139 · Flow 01 |
| **BR-09** | [Backend Data Authorization & Least Privilege Principle](BR-09-backend-data-authorization.md) | Multi-tenant backend RBAC/ABAC query filtering, no default PHI access for SaaS Admin. | UC16, UC17, UC58, UC59, UC102 · All Flows |
| **BR-17** | [Data Processing Consent Lifecycle](BR-17-consent-lifecycle-and-withdrawal.md) | Relative consent via email link, representation attestation, consent revocation & new terms handling. | UC2, UC4, UC106, UC129, UC138 · Flows 02, 03, 14 |
| **BR-12** | [Data Erasure & Statutory Retention Restrictions](BR-12-data-retention-and-erasure.md) | 72h erasure SLA, clinical/financial statutory retention holds, audit logging. | UC61–UC65, UC104–UC106 · Flow 14 |
