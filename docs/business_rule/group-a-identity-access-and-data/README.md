# Group A — Identity, Accounts & Personal Data Governance

> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

This group specifies foundational security, privacy, and account governance business rules for the HealthCareSystem on-demand nursing marketplace: phone + OTP identity, nurse credentialing and tier lifecycle, backend authorization, health-data consent, and retention/erasure under Nghị định 13/2023/NĐ-CP.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | SRS v2.0 Traceability |
| :--- | :--- | :--- | :--- |
| **BR-20** | [Phone + OTP Identity and Communication Channels](BR-20-email-only-identity-and-communication.md) | Phone number as the account identifier with OTP sign-in; mandatory 2FA for Admins; CCCD eKYC; in-app chat/calls with fully masked phone numbers; push + SMS/ZNS fallback notifications. *(File name retained; supersedes the former email-only rule.)* | §4.1 FR-AUTH-01 / FR-AUTH-03 · §4.6 FR-NOTIF-01 / FR-CHAT-01 · §8 |
| **BR-21** | [Nurse Credentialing, Tier Assignment & GPHN Lifecycle](BR-21-two-step-staff-credentialing.md) | eKYC submission (CCCD, portrait, degree, GPHN); Admin review with `reviewed_by`; TIER_1_BASIC / TIER_2_SPECIALIST assignment; retirement decision is an experience badge only; GPHN expiry → auto-demote, renewal → auto re-upgrade. | §1.3 · §2.3 · §4.1 FR-AUTH-01 / FR-AUTH-02 |
| **BR-09** | [Backend Data Authorization & Least Privilege Principle](BR-09-backend-data-authorization.md) | Role × booking-relationship × lifecycle × tier authorization; tier hard-gating of invasive services (HTTP 403); medical-record access window CONFIRMED → check-out +12h; Admin-only functions; presigned URLs (10 min) for CCCD/GPHN/y lệnh/selfie images; `profile_status` as single source of truth. | §2.1–§2.3 · §4.1 FR-PRIV-01 · §8 · NFR-SEC-01 |
| **BR-17** | [Consent Lifecycle & Withdrawal](BR-17-consent-lifecycle-and-withdrawal.md) | Per-profile health-data consent by patient/legal guardian under NĐ 13/2023, recorded with timestamp + IP/Device ID; consent to share records with the assigned nurse inside the access window; consent is a booking precondition. | §4.1 FR-PRIV-01 / FR-AUTH-03 · §7 · §8 |
| **BR-12** | [Data Retention & Erasure](BR-12-data-retention-and-erasure.md) | Medical records retained max 24 months; deletion/anonymization right per NĐ 13/2023; immutable wallet ledger & audit logs; deposit withdrawable only on account closure after 7 dispute-free days. | §2.3 · §3 RISK-03 · §4.1 FR-PRIV-01 · §7 |
