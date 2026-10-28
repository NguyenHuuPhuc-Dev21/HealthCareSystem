# BR-09: Backend Data Authorization & Least Privilege Principle

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** SRS HealthCareSystem On-Demand Nursing — Version 2.0 (Updated, 28/10/2026), §2.1, §2.3, §4.1 (FR-AUTH-02, FR-PRIV-01), §7, §8, NFR-SEC-01  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 1. Context & Business Intent

1. **Security Beyond UI Obfuscation:** Front-end button hiding or client-side checks are completely untrusted. All authorization checks must be enforced at the backend controller and database query layers.
2. **Marketplace Privacy Model:** HealthCareSystem is a marketplace connecting Customers (patients / family members) with independent Nurses — retired doctors/nurses and fresh graduates. There are **no hospital tenants**. Authorization is therefore based on account role, booking relationship, booking lifecycle status, and nurse tier — not on any tenant boundary.

---

## 2. Rule Specifications

### 2.1 Access Control Matrix Formulation
- Access Permissions = `System Role` × `Booking Relationship` × `Booking Lifecycle Status` × `Nurse Tier (for service gating)`.
- The `users` table defines exactly three roles (SRS §7): `PATIENT` (Customer), `NURSE`, `ADMIN`.
- [Not specified in SRS v2.0 — open item] SRS v2.0 defines a single `ADMIN` role; a separate Super Admin tier with distinct privileges is not specified.

### 2.2 Backend Authorization Check
Every incoming data request must be validated against the following mandatory contextual checks at the backend API layer before query execution:
1. **User Role:** Authenticated role (`PATIENT` | `NURSE` | `ADMIN`).
2. **Relationship to the Booking / Patient Profile:** Account ownership (Customer side), active assignment (Nurse side), or Admin function.
3. **Specific Booking Scope:** The target booking identifier; nurse access attaches to one specific booking only.
4. **Business Lifecycle Status:** The booking's `execution_status` on the 3-axis state machine (SRS §2.2) — in particular whether the medical-record access window is open (see §2.4).
5. **Tier Gate (Nurse side):** For services with `is_invasive = true`, the nurse's tier and GPHN validity (see §2.5).

### 2.3 Role-Specific Data Access Boundaries
- **Customers (PATIENT):** View and manage exclusively their own account, their own patient profiles, and their own bookings.
- **Nurses (NURSE):** View only the patient information strictly necessary for a booking assigned to them, and only inside the access window defined in §2.4. Nurse-facing search/matching data is governed by BR-08 and FR-SEARCH-01.
- **Admins (ADMIN):** Perform the platform's privileged functions (§2.6) and may access booking evidence (GPS logs, check-in/check-out timestamps, shift logs, chat history) when adjudicating disputes (FR-DISP-01). When handling a dispute, an Admin may re-grant a nurse time-limited access to a booking's records; the re-grant is recorded in the audit log (FR-PRIV-01).

### 2.4 Medical-Record Access Window (FR-PRIV-01)
- A nurse may view the assigned booking's medical record and doctor's order (y lệnh) image **only while that booking is in `execution_status` = CONFIRMED or IN_PROGRESS** and the nurse is the assigned nurse of that booking.
- Access is **automatically revoked 12 hours after check-out** (`checkout_time` + 12h). After revocation, any nurse API call to view that booking's medical record / y lệnh returns **HTTP 403**.
- Inside the 24-hour dispute window, evidence is produced from system logs; nurse self-service record access is not extended by an open dispute (Admin re-grant per §2.3 is the only exception).

### 2.5 Tier Hard-Gating for Invasive Services (FR-AUTH-02, SRS §4.2)
- Services carry the flags `is_invasive` and `is_prohibited` and a `required_tier` in `service_categories` (SRS §7).
- **Group 2 — Conditional invasive services** (`is_invasive = true`): claimable/acceptable **only** by `TIER_2_SPECIALIST` nurses holding a valid, in-scope GPHN (Giấy phép hành nghề). The backend enforces this on the claim/accept API: a `TIER_1_BASIC` nurse calling the accept API for a booking with `is_invasive = true` receives **HTTP 403 Forbidden** (RTM TC-AUTH).
- **Group 3 — Absolutely prohibited services** (`is_prohibited = true`): the backend blocks booking creation entirely; no role can create or accept such a booking.
- **Group 1 — Non-invasive services** (`is_invasive = false`): open to both tiers.
- GPHN expiry automatically demotes a nurse to `TIER_1_BASIC` (BR-21); the tier gate therefore re-evaluates against the current tier on every claim.

### 2.6 Admin-Only Functions
The following functions are restricted to `ADMIN`:
- Verify / approve nurse credentials and GPHN, assign or re-assign tiers — `PATCH /api/v1/admin/nurses/:id/verify` (the decision is recorded via `nurse_credentials.reviewed_by`).
- Resolve disputes — `PATCH /api/v1/admin/disputes/:id/resolve` (FR-DISP-01).
- Manage the service catalog (including toggling `is_invasive`) and update `system_configs` parameters (FR-ADMIN-01).
- Lock / unlock user accounts (`ACTIVE` / `SUSPENDED` / `BANNED`) (FR-ADMIN-01).
- Approve withdrawal requests and produce financial reconciliation reports (FR-ADMIN-01, FR-PAY-04).

### 2.7 Protected Document Access — Signed URLs (NFR-SEC-01)
- All sensitive images — CCCD, GPHN, doctor's order (y lệnh), and check-in selfies — are stored **Private** on S3/MinIO.
- They are served **only via Presigned URLs with a 10-minute validity**. No public or permanent URLs are issued for these objects.

### 2.8 Single Source of Truth for Job Eligibility (SRS §2.3, §7)
- `nurse_profiles.profile_status` is the **single source of truth** the API uses to decide a nurse's job-acceptance eligibility (values: `PENDING_VERIFICATION` | `ACTIVE` | `SUSPENDED` | `BANNED`). No other status field may gate job acceptance.

### 2.9 Immutable Audit Logging (SRS §7 — `audit_logs`)
- Security-relevant actions generate an append-only audit log entry recording: actor ID, action type, target table / ID, old value, new value, IP address, and timestamp.
- Audited action types include: `VIEW_MEDICAL_RECORD`, `APPROVE_GPHN`, `RESOLVE_DISPUTE`, `UPDATE_CONFIG`, `DELETE_PATIENT_DATA`.
- Sensitive credentials (passwords, OTPs, auth tokens) are strictly excluded from audit log payloads.

---

## 3. Traceability & Dependencies

- **SRS References:** §2.1 (Actors), §2.2 (3-Axis Booking State Machine), §2.3 (Nurse & Wallet State Machines), §4.1 FR-AUTH-02 / FR-PRIV-01, §4.2 (Service catalog — 3 groups), §4.6 FR-ADMIN-01 / FR-CHAT-01, §7 (`users`, `nurse_profiles`, `service_categories`, `audit_logs`), §8 (API spec), §10 RTM TC-AUTH / TC-PRIV-01 / TC-DB-01
- **API Endpoints:** `PATCH /api/v1/admin/nurses/:id/verify`, `PATCH /api/v1/admin/disputes/:id/resolve`
- **Related Rules:** BR-14 (booking prerequisites & blocks), BR-20 (phone + OTP identity), BR-21 (nurse credentialing & tier lifecycle)
