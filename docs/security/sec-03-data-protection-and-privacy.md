# Security Policy Group 3 — Data Protection & Privacy (Decree 13/2023/ND-CP)

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-12, BR-17, BR-20, UC2, UC3, UC4, UC61–UC65, UC106) |
| **Applicable Scope** | Sensitive Personal Data Protection, Patient Health Records, Masking, Legal Consent, Data Erasure |
| **Legal Mandate** | Vietnam Decree 13/2023/ND-CP on Personal Data Protection (Health & Medical Data = **Sensitive Personal Data**) |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |

---

## Data Protection & Privacy Rules

### SEC-3.1 [P0] Mandatory Pre-Implementation Data Classification
All data managed across the platform must be formally classified prior to writing application code. Every engineering pull request introducing new fields or entities must declare the sensitivity tier touched:
1. **Tier 1: Sensitive Personal Data (Highest Protection Level):**
   - Patient clinical symptoms, preliminary triage evaluations, attending doctor notes, and home-care session reports (**Decree 13/2023/ND-CP**).
   - Requires field-level access control, strict purpose binding, immutable access logging, and signed URL file distribution.
2. **Tier 2: High Sensitivity Data:**
   - Identity attributes (full legal names, dates of birth, residential addresses) and financial transaction records (deposit history, bank account details).
3. **Tier 3: Standard Operational Data:**
   - Hospital facility addresses, catalog pricing, shift schedules, and non-sensitive system configurations.

### SEC-3.2 [P0] Cryptographic Protection in Transit and at Rest
- **In Transit:** Mandatory **TLS 1.2+** across all external client-to-server and internal service-to-service communication. Strict HTTPS and HTTP Strict Transport Security (HSTS) with a minimum `max-age` of 1 year.
- **At Rest:** Transparent Data Encryption (AES-256) enabled across all database storage volumes, read replicas, and cloud object storage buckets.
- **Application-Layer Field Encryption [P1]:** Highly sensitive clinical narratives (e.g., patient care reports and triage symptom details) should evaluate application-layer envelope encryption using rotating customer-managed or tenant-isolated keys.

### SEC-3.3 [P0] Display Masking & Private Communication Channels
- **Data Minimization in Displays:** Phone numbers and email addresses must be partially masked on screens where full visibility is unnecessary (e.g., rendering `098***1234` or `p***@example.com`).
- **Private In-App Nurse-Patient Channels (UC133):** Direct coordination between patient and assigned nurse must occur exclusively via masked in-app VoIP or chat channels. Personal mobile phone numbers must **never** be exposed in any mobile view, web view, or API payload.

### SEC-3.4 [P0] Defense Against Excessive Data Exposure (Payload Minimization)
- API serializers must strictly filter response payloads to include only the exact fields required for that specific authenticated role and screen context.
- **Nurse Payloads:** Mobile payloads dispatched to nurses must exclude patient billing details, deposit amounts, and payment transaction identifiers.
- **Listings & Summaries:** Patient listing screens and search views must exclude granular clinical narrative text and prior visit medical histories.

### SEC-3.5 [P0] Prohibition of Sensitive Data in Application Logs
- Application loggers must **never** write Protected Health Information (PHI), symptoms, clinical care notes, OTP codes, session tokens, passwords, or credit card attributes to log files or standard output.
- Logs must record entity identifiers and event codes only (e.g., logging `PATIENT_CONSENT_GRANTED for patient_id: 123` or `FACTOR_MATCHED: email_confirmed`, rather than logging the actual values).

### SEC-3.6 [P0] Consent as a Mandatory Legal Precondition
- Per **BR-17**, personal and health data may be processed strictly within the active scope of a legally binding consent record.
- **Consent Withdrawal (UC106):** When a patient or adult relative revokes consent, the system must immediately block all dependent processing pipelines. Revocation must propagate synchronously to application caches, queued background jobs, analytical reporting pipelines, and exported datasets.

### SEC-3.7 [P1] Enforced Data Retention & Right to Erasure
- Every category of data must have a defined statutory retention window pursuant to **Decision Q-14**. Upon expiration, records must be permanently purged or irreversibly anonymized.
- **Data Erasure (Right to Be Forgotten, BR-12):** Valid erasure requests must execute within **72 hours** after verifying operational constraints (no active visits, no open debts, no unresolved clinical complaints).
- Deletion policies must systematically cascade to backup storage archives in accordance with published backup lifecycle commitments.

### SEC-3.8 [P1] Compliance Dossiers Under Decree 13/2023/ND-CP
- The platform operations team must maintain and formally file a **Data Protection Impact Assessment (DPIA)** dossier with the relevant regulatory authorities before official public launch.
- A formal **Cross-Border Data Transfer Assessment** must be completed if any sub-processors (e.g., cloud hosting, email delivery gateways, or analytics vendors) store or process data outside Vietnam.
- Implement an automated security incident workflow capable of fulfilling statutory requirements to formally notify competent authorities within **72 hours** of detecting a personal data breach.

### SEC-3.9 [P1] Controlled Data Export & Bulk Printing Protections
- Bulk export of patient rosters, medical encounter histories, or financial ledgers is restricted to authorized administrative personnel and requires dedicated permission flags.
- All export and bulk printing operations generate high-priority audit log records.
- Exported files must be stored in private buckets accessible only via temporary pre-signed URLs (validity ≤ 15 minutes) and must never be distributed as unencrypted email attachments.
