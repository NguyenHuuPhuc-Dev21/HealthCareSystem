# BR-21: Nurse Credentialing, Tier Assignment & GPHN Lifecycle

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §1.3, §2.3, §4.1 (FR-AUTH-01, FR-AUTH-02), §7, §8  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Supersession Note:** There is no hospital in this model. Credentialing is a **single-platform process**: the nurse submits documents, and a platform **Admin** verifies them and assigns the tier. The former two-step "hospital confirms, platform reviews" protocol and the CCHN terminology are replaced by the GPHN (Giấy phép hành nghề) model of the Luật Khám bệnh, chữa bệnh 2023.

---

## 1. Context & Business Intent

1. **Legal Basis for Invasive Work:** Under the Luật Khám bệnh, chữa bệnh 2023 (REF-LAW-01), only practitioners holding a **valid, in-scope GPHN** may perform invasive services. The platform must therefore verify credentials before any nurse enters a matching pool, and must hard-gate invasive services by tier (BR-09 §2.5).
2. **Two Nurse Populations:** The marketplace onboards (1) retired / freelance doctors and nurses, and (2) fresh medical/nursing graduates. Tier — not seniority or retirement status — decides which services each may perform.

---

## 2. Rule Specifications

### 2.1 eKYC Submission (FR-AUTH-01)
- The nurse submits onboarding documents via **Nurse Web Portal or Nurse Mobile App** (`POST /api/v1/auth/nurse-onboarding`):
  - Phone number (OTP-verified, BR-20).
  - CCCD — both sides.
  - Live portrait photo.
  - Medical / nursing graduation degree.
  - GPHN (if any): GPHN number, issue date, **expiry date (`gphn_expiry_date`)**, issuing authority, and scope of practice.
  - Retirement decision (quyết định nghỉ hưu) — supplementary document, if any.
- On new registration the profile is stored in `PENDING_VERIFICATION`. A credential uploaded later by an already-active nurse (e.g., a renewed GPHN) is stored as a credential record in `PENDING` review state.
- Documents are stored as `nurse_credentials` records with `doc_type` ∈ `CCCD` | `DEGREE` | `GPHN` | `RETIREMENT_DECISION` and `verification_status` ∈ `PENDING` | `APPROVED` | `REJECTED`.

### 2.2 Admin Review & Tier Assignment (FR-AUTH-02)
- An Admin reviews the dossier on the Admin Portal (`PATCH /api/v1/admin/nurses/:id/verify`). Every decision records **`reviewed_by`** (FK to the Admin's `users.id`), `reviewed_at`, and — on rejection — `rejection_reason`.
- Tier assignment:
  - **Valid degree, no GPHN** → `TIER_1_BASIC` — non-invasive services only (`is_invasive = false`).
  - **Valid GPHN, in force and in scope** → `TIER_2_SPECIALIST` — all services within the licensed scope, including conditional invasive services.
- **Retirement decision rule:** a retirement decision is **never** a basis for Tier 2. It only earns the profile the experience badge "Chuyên gia hưu trí giàu kinh nghiệm" (retired medical expert). A dossier containing only a retirement decision and no valid GPHN is assigned `TIER_1_BASIC` (RTM TC-AUTH-01).
- On approval the profile transitions `PENDING_VERIFICATION → ACTIVE` (§2.4).

### 2.3 GPHN Update & Re-Verification Flow (FR-AUTH-01, FR-AUTH-02)
- When a GPHN is renewed, the nurse uploads the new GPHN via Nurse Web/App (`PUT /api/v1/nurse/credentials/gphn`). The new credential enters `PENDING` review.
- When an Admin approves the new GPHN, the system **automatically re-upgrades** the nurse to `TIER_2_SPECIALIST`.
- Until approval completes, the nurse remains at the tier determined by the previous GPHN state (§2.5).

### 2.4 Nurse Profile Lifecycle (SRS §2.3)
`nurse_profiles.profile_status` — the **single source of truth** for job eligibility (BR-09 §2.8):
- `PENDING_VERIFICATION → ACTIVE`: Admin approves eKYC & credentials and assigns the tier.
- `ACTIVE → SUSPENDED`: automatically when TrustScore < 60, when `deposit_balance` < 300,000 VNĐ after an SLA penalty deduction, or when a cash-job commission remains unpaid more than 24 hours after check-out (BR-14).
- `SUSPENDED → ACTIVE`: when the nurse tops the deposit back up / pays the outstanding commission in full / completes retraining and an Admin reviews and unlocks the profile.
- `ACTIVE | SUSPENDED → BANNED`: no-show, forged degree/GPHN, or serious professional-ethics violations.

### 2.5 Automatic Demotion on GPHN Expiry (FR-AUTH-02)
- A **daily cronjob** checks `gphn_expiry_date` for all Tier 2 nurses.
- When the GPHN expires and no renewed GPHN has been approved, the system **automatically demotes** the nurse from `TIER_2_SPECIALIST` to `TIER_1_BASIC`. The profile **stays ACTIVE** — the nurse may continue taking non-invasive jobs.
- Invasive bookings already `CONFIRMED` whose service date falls **after** the GPHN expiry date are **automatically cancelled without penalty** to the nurse and re-matched to another Tier 2 nurse.
- [Not specified in SRS v2.0 — open item] Pre-expiry reminder schedule for nurses (the old baseline's 30-day reminder) is not specified in SRS v2.0.

### 2.6 Job-Acceptance Eligibility (Summary)
A nurse may accept a job only when **all** of the following hold:
1. `profile_status` = `ACTIVE`.
2. Deposit gate satisfied: `deposit_balance` ≥ 300,000 VNĐ (BR-14).
3. For invasive services: tier = `TIER_2_SPECIALIST` with a valid, in-scope GPHN (BR-09 §2.5).

### 2.7 Audit Logging
- GPHN approvals are recorded in `audit_logs` with action type `APPROVE_GPHN` (BR-09 §2.9), and every credential decision carries `reviewed_by` / `reviewed_at` on the credential record itself.

---

## 3. Traceability & Dependencies

- **SRS References:** §0.3 REF-LAW-01 / REF-LAW-02, §1.3 (TIER_1_BASIC / TIER_2_SPECIALIST definitions), §2.3 (Nurse profile lifecycle), §3 RISK-01, §4.1 FR-AUTH-01 / FR-AUTH-02, §7 (`nurse_profiles`, `nurse_credentials`), §8 (onboarding / verify / GPHN endpoints), §10 RTM TC-AUTH-01..03 / TC-DB-01
- **API Endpoints:** `POST /api/v1/auth/nurse-onboarding`, `PATCH /api/v1/admin/nurses/:id/verify`, `PUT /api/v1/nurse/credentials/gphn`
- **Related Rules:** BR-09 (tier hard-gating, audit), BR-14 (deposit gate & suspension triggers), BR-20 (phone + OTP identity)
