# Module `nurse-onboarding` (BE-1 / Dev A · Phase 1)

Nurse eKYC dossier: CCCD (both sides), live portrait, degree, optional GPHN and retirement decision.

- **SRS:** FR-AUTH-01 · §8 `POST /api/v1/auth/nurse-onboarding` · §7 `nurse_profiles`, `nurse_credentials`
- **Rules / stories:** BR-21 §2.1 · US-HP-04 AC-01 · SEC-7.1 (uploads) · NFR-SEC-01 (private storage)
- **API contract:** [`docs/api/nurse-onboarding.api.md`](../../../../../docs/api/nurse-onboarding.api.md)
- **Migration:** `0005_nurse_credential_details.sql` (GPHN number / issuing authority / scope / CCCD side on `nurse_credentials`)

## What it does
1. `POST /nurse/onboarding/upload-urls` — presigned PUT URLs; keys generated server-side (`<category>/<userId>/<uuid>.<ext>`).
2. `POST /auth/nurse-onboarding` — verifies every file (owner, purpose/category, exists, ≤ 10 MB, **real type by magic bytes**),
   then in **one transaction**: create + lock `nurse_profiles` (`PENDING_VERIFICATION`), set `users.cccd_number`,
   `gender`, `kyc_documents`, `kyc_status = PENDING`, insert `nurse_credentials` rows (`PENDING`).
3. `GET /nurse/onboarding` — status and per-document review result.

## Rules
- Tier is **not** decided here. `credential-review` (next module) assigns it and copies the **approved** GPHN
  number/expiry/scope into `nurse_profiles` — so the daily tier sweep (BE-2) only ever reads approved data.
- Expired GPHN or future issue dates are rejected. A retirement decision is stored but never unlocks Tier 2.
- One open dossier at a time; resubmission allowed after rejection. ACTIVE/SUSPENDED → use GPHN renewal; BANNED → 403.
- CCCD number unique across accounts (`uq_users_cccd_number` → `409 CCCD_ALREADY_REGISTERED`).

## Open items
- **Malware scanning** of uploads (SEC-7.1 #3) — not built; files stay private and are only viewed by Admins via presigned URLs.
- **Live capture** of the portrait is enforced in the app (FE-2); the server cannot prove it (deep liveness = commercial phase).
- **Orphan uploads** (files uploaded but never submitted) are not cleaned up yet — a storage lifecycle rule can expire them.
- Patient eKYC (FR-AUTH-03) is BE-2's `patient-profiles`; it can reuse `kyc-cccd` / `kyc-selfie` and `detectContentType`.
