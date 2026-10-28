# Security Policy Group 3 — Data Protection & Privacy (Decree 13/2023/ND-CP)

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (FR-PRIV-01, FR-AUTH-01…03, FR-CHAT-01, RISK-03, NFR-SEC-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | Sensitive Personal Data Protection, Health Records, Identity Documents, Chat Logs, Location Data, Masking, Legal Consent, Data Erasure |
| **Legal Mandate** | Vietnam Decree 13/2023/ND-CP on Personal Data Protection (Health & Medical Data = **Sensitive Personal Data**); Law on Medical Examination and Treatment 15/2023/QH15 |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |

---

## Data Protection & Privacy Rules

### SEC-3.1 [P0] Mandatory Data Classification
All data managed across the platform must be formally classified before code is written. Every engineering pull request introducing new fields or entities must declare the class touched:
1. **Class A — Sensitive Personal Data (Highest Protection):**
   - Health data: patient profiles (`patient_profiles`: medical history, mobility status, infectious-disease flag), doctor's-order (y lệnh) images, shift vital-sign and care logs (`shift_logs`), medical-incident logs.
   - Requires purpose binding to a single booking, the SEC-2.4 access window, immutable access logging (`VIEW_MEDICAL_RECORD`), and distribution only via signed URLs.
2. **Class B — Identity & Financial Data (High Sensitivity):**
   - CCCD numbers and CCCD images (both user roles), GPHN scans and credential documents, live portraits/selfies, phone numbers, withdrawal bank account details, wallet balances and transaction history.
3. **Class C — Operational & Evidence Data:**
   - Chat messages and call logs (`conversations_messages`, retained as dispute evidence — FR-CHAT-01), GPS coordinates (`nurse_profiles.current_lat/lng`, check-in/out coordinates), reviews, notifications, `audit_logs`.
4. **Class D — Public / Configuration Data:**
   - Service catalog, public nurse profile cards (name, photo, tier, rating), `system_configs` values.

### SEC-3.2 [P0] Cryptographic Protection in Transit and at Rest
- **In Transit:** Mandatory **TLS 1.3** across all external client-to-server and internal service-to-service communication (SRS §6). Strict HTTPS and HSTS with a minimum `max-age` of 1 year.
- **At Rest:** AES-256 encryption across all database storage volumes, read replicas, backups, and object storage buckets (SRS §6).
- **Credential Material:** Passwords and OTPs are hashed with Argon2id/bcrypt (SEC-1.4) — never encrypted reversibly, never stored in plaintext.
- **Application-Layer Field Encryption [P1]:** Highly sensitive health narratives (care notes, medical history free text) should evaluate application-layer envelope encryption with rotating keys *(retained engineering standard — not specified in SRS v2.0)*.

### SEC-3.3 [P0] Private Storage & Signed URLs for Sensitive Files
- All Class A/B files — CCCD images, GPHN scans, portraits, doctor's-order images, check-in selfies, dispute evidence — are stored **Private** on S3/MinIO and are accessible **only** via pre-signed URLs with a **10-minute** validity (NFR-SEC-01). Public or permanent links are prohibited.
- A signed URL may be issued only after the SEC-2.1 authorization check for that specific file and viewer (e.g., a doctor's-order image is issued to the assigned Tier-2 nurse within the booking context, and to the reviewing Admin during credential verification or dispute handling).

### SEC-3.4 [P0] Masking & Private Communication Channels
- **Phone numbers are never exposed between customers and nurses.** All coordination happens through in-app chat/calls with fully masked numbers (FR-CHAT-01); real numbers must not appear in any screen, API payload, push notification, or SMS fallback message.
- The chat system scans message content for phone numbers and external contact links: on detection it warns the sender and writes a log entry (FR-CHAT-01, RISK-06). Chat/call history is retained as dispute evidence (see SEC-3.7).
- Display masking applies elsewhere too: CCCD numbers and bank account numbers render partially masked (e.g., `*******1234`) in Admin and self-service views where full visibility is unnecessary *(retained engineering standard — not specified in SRS v2.0)*.

### SEC-3.5 [P0] Defense Against Excessive Data Exposure (Payload Minimization)
- API serializers must filter response payloads to exactly the fields required for that role and screen:
  - **Nurse search cards** (FR-SEARCH-01): name, avatar, tier, experience, ratings only — never GPHN numbers, CCCD data, or contact details.
  - **Nurse booking payloads:** care-relevant patient data only within the SEC-2.4 window; never the customer's payment details or wallet data.
  - **Customer payloads:** never the nurse's deposit balance, wallet internals, or credential documents — only verification status and tier.

### SEC-3.6 [P0] Prohibition of Sensitive Data in Application Logs
- Application loggers must **never** write health data (symptoms, care notes, vital signs), chat content, OTP codes, session tokens, passwords, GPHN/CCCD numbers, or payment card attributes to log files or standard output.
- Logs record identifiers and event codes only (e.g., `VIEW_MEDICAL_RECORD booking_id: … actor_id: …`, rather than the record's contents). The forensic record for sensitive access is `audit_logs` (SEC-9.1), not the application log stream.

### SEC-3.7 [P0] Consent as a Mandatory Legal Precondition (FR-PRIV-01)
- Health data may be processed only within an active consent record: the patient (or legal guardian) must accept the sensitive-data processing terms; the system records `data_consent_accepted`, `consent_timestamp`, and the requester's IP/Device ID on the patient profile. A patient profile cannot be saved without consent (TC-PRIV-01), and booking creation re-checks consent (SRS §8, `POST /bookings`).
- Consent is purpose-bound to care delivery for bookings of that patient profile; it does not authorize marketing use, third-party sharing, or indefinite record visibility (SEC-2.4 window still applies).
- Consent withdrawal must block further processing of the profile for new bookings and trigger the erasure/anonymization path of SEC-3.8 *(withdrawal mechanics beyond the SRS deletion request are a retained engineering standard)*.

### SEC-3.8 [P1] Retention, Erasure & Anonymization
- **Health records:** retained for a maximum of **24 months** for lookup/legal purposes (FR-PRIV-01); on expiry they must be purged or irreversibly anonymized.
- **Erasure requests:** The platform must support 'Request deletion / anonymization of personal data' under Decree 13/2023 (FR-PRIV-01). Patient profiles support soft deletion (`patient_profiles.deleted_at`) with anonymization of identifying fields; every execution writes an `audit_logs` row (`action_type = DELETE_PATIENT_DATA`).
- **Operational constraints:** Erasure is deferred — never silently dropped — while a booking is active, a dispute is `OPEN`/`UNDER_REVIEW`, or money is still owed/held for that user; the requester is informed of the deferral reason *(constraint handling is a retained engineering standard — not specified in SRS v2.0)*.
- **Evidence carve-out:** Chat logs, shift logs, wallet ledger entries, and `audit_logs` are retained as dispute/legal evidence under their own retention rules; anonymization replaces identifying content where the law requires it without breaking ledger integrity (SEC-5.5).
- Deletion must cascade to object storage (CCCD/GPHN/order images) and, on the published backup lifecycle, to backups (SEC-8.7).

### SEC-3.9 [P1] Compliance Dossiers Under Decree 13/2023/ND-CP
- The operations team must prepare and file a **Data Protection Impact Assessment (DPIA)** dossier for sensitive health-data processing before public launch.
- A **Cross-Border Data Transfer Assessment** must be completed if any sub-processor (cloud hosting, FCM, SMS/ZNS gateway, maps provider) stores or processes data outside Vietnam.
- The incident workflow must be able to notify competent authorities within **72 hours** of detecting a personal data breach (SEC-9.3).

### SEC-3.10 [P1] Controlled Data Export & Reporting Protections
- Financial/operational report export (FR-ADMIN-01: escrow totals, commission totals, payouts, refunds, pending withdrawals) is restricted to Admin accounts, and every export generates an `audit_logs` record.
- Exported files are delivered only via private storage with short-lived signed URLs (≤ 10 minutes, SEC-3.3), never as unencrypted email attachments *(retained engineering standard — not specified in SRS v2.0)*.
