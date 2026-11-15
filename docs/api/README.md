# API Contracts & Interface Documentation

> **Specification Baseline:** SRS — HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**, §8 (Core REST API Endpoints) and §9 (External Integrations)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version  
> **Base path:** `/api/v1` — **Roles:** `PATIENT` (Customer), `NURSE` (Tier 1 / Tier 2), `ADMIN`, `GATEWAY` (payment gateway webhook caller)

This catalogue lists the core endpoints defined by SRS v2.0 §8, grouped by domain. Sign-in for Patient and Nurse accounts is by **phone number + OTP**; Admin sign-in additionally requires mandatory 2FA. `nurse_profiles.profile_status` is the single source of truth the API uses to decide a nurse's job eligibility.

---

## 1. Authentication & Onboarding

| Method & Endpoint | Role | Description |
|---|---|---|
| `POST /api/v1/auth/request-otp` | PATIENT / NURSE | Request an OTP login code sent to the registered phone number. |
| `POST /api/v1/auth/verify-otp` | PATIENT / NURSE | Verify the OTP code and issue the application login session. |
| `POST /api/v1/auth/nurse-onboarding` | NURSE | Submit the eKYC profile on Nurse Web/App: CCCD, graduation degree, GPHN (with expiry date & scope of practice). Profile starts as `PENDING_VERIFICATION` (FR-AUTH-01). |

## 2. Nurse Profile, Credentials & Availability

| Method & Endpoint | Role | Description |
|---|---|---|
| `PATCH /api/v1/admin/nurses/:id/verify` | ADMIN | Approve a nurse's GPHN (stores `reviewed_by = admin_id`) and assign `TIER_1_BASIC` or `TIER_2_SPECIALIST` — including the automatic re-upgrade to `TIER_2_SPECIALIST` when approving a renewed GPHN (FR-AUTH-02). |
| `PUT /api/v1/nurse/credentials/gphn` | NURSE (Web/App) | Nurse uploads a new GPHN after the previous one expired; once an Admin approves it, the nurse is automatically re-upgraded to `TIER_2_SPECIALIST` (FR-AUTH-02). |
| `PUT /api/v1/nurse/availabilities` | NURSE | Nurse updates recurring availability windows and registers time-off days (FR-SCHED-01). |

## 3. Nurse Search

| Method & Endpoint | Role | Description |
|---|---|---|
| `GET /api/v1/nurses/search` | PATIENT | Customer searches and views nurse profiles and reviews before booking (FR-SEARCH-01). Returns only `ACTIVE` nurses with matching availability and sufficient tier. |

## 4. Bookings & Shift Execution

| Method & Endpoint | Role | Description |
|---|---|---|
| `POST /api/v1/bookings` | PATIENT | Create a booking: validates Decree 13/2023 data consent, validates customer eKYC (mandatory for home-care), records `payment_method (BANK_TRANSFER \| CASH)`, and computes the price from `system_configs` (FR-BOOK-01). |
| `POST /api/v1/bookings/:id/check-in` | NURSE | Check-in: verifies the anti-mock-GPS flag, distance ≤ 200 m, uploads the live selfie and confirms the on-site medical-order cross-check (FR-SHIFT-01). |
| `POST /api/v1/bookings/:id/reject-invalid-prescription` | NURSE (Tier 2) | Nurse rejects a shift on site because the medical order is forged / the medication does not match, without penalty (FR-BOOK-02). |
| `POST /api/v1/bookings/:id/check-out` | NURSE | Check-out and submission of the minimum shift report; records `checkout_time`, starts the 24-hour dispute window and the 12-hour medical-record access closure timer (FR-SHIFT-04). |
| `POST /api/v1/bookings/:id/extend` | PATIENT | Customer requests a shift extension in 1-hour blocks; the system checks the nurse's next-shift schedule (FR-SHIFT-03). |

## 5. Chat & Calls

FR-CHAT-01 requires in-app chat/calling with masked phone numbers, opened once a booking is `CONFIRMED`, with message scanning for leaked phone numbers/external links and full history retained in `conversations_messages` as dispute evidence.

- Chat/call endpoints: **[Not specified in SRS v2.0 — open item]** (SRS §8 lists no chat endpoints; see the Open Decisions Register).

## 6. Wallet & Payments

| Method & Endpoint | Role | Description |
|---|---|---|
| `POST /api/v1/payments/escrow-webhook` | GATEWAY | Payment gateway webhook: verifies the **HMAC-SHA256** signature and the `idempotency_key`, locks the prepaid amount into Escrow (`ESCROW_HELD`) and triggers Matching (SRS §9). |
| `POST /api/v1/bookings/:id/commission-payment-link` | NURSE (Web/App) | Generate the VietQR code / Payment Link for the 15% commission of a **cash (CASH)** booking, so the nurse can self-transfer the commission to the system within 24 hours of check-out (FR-PAY-02). The confirming webhook moves the booking to `SETTLED`; the commission is never deducted from the deposit wallet. |
| `POST /api/v1/wallets/withdraw` | NURSE | Nurse creates a withdrawal request from `available_balance` to their bank account (FR-PAY-04). |

## 7. Disputes & Reviews

| Method & Endpoint | Role | Description |
|---|---|---|
| `POST /api/v1/bookings/:id/disputes` | PATIENT / NURSE | Open a dispute within 24 hours after check-out, upload evidence; escrowed funds are frozen immediately (FR-DISP-01). |
| `PATCH /api/v1/admin/disputes/:id/resolve` | ADMIN | Admin adjudicates a dispute: refund 100%, release 100%, or partial release (Phase 2) (FR-DISP-01, FR-DISP-02). |
| `POST /api/v1/bookings/:id/reviews` | PATIENT / NURSE | Two-way review once the shift has ended (`execution_status = COMPLETED`, per FR-RATE-01 — reviews do not wait for money settlement); automatically applies the TrustScore recovery rule. |

## 8. SOS / Emergency

The SOS behaviour is specified functionally (FR-SHIFT-05): the Nurse App opens the 115 dialler immediately and the system pushes an emergency alert (Push + SMS fallback) with GPS coordinates and latest vital signs to the Family and Admin Portal in < 2 seconds (SRS §10, TC-SOS-01).

- A dedicated SOS API endpoint: **[Not specified in SRS v2.0 — open item]** (SRS §8 lists no SOS endpoint; see the Open Decisions Register).

---

## Cross-Cutting Rules (SRS §9)

- **Webhook signature:** every call to `/api/v1/payments/escrow-webhook` must recompute HMAC-SHA256 over the payload with the secret key; a mismatch returns HTTP 401 with no balance change.
- **Idempotency:** the gateway transaction id is stored as `idempotency_key` (UNIQUE in `wallet_transactions`); a redelivered webhook returns HTTP 200 but never credits money twice. The same rule covers the commission-payment webhook for cash bookings.
- **Concurrency:** job acceptance and all wallet balance-changing endpoints must run under ACID transactions with `SELECT ... FOR UPDATE` or a Redis Distributed Lock (NFR-SEC-01.2); Radar Dispatch assigns a booking to the first accepting nurse under lock (FR-BOOK-03).
- **Tier gating:** a Tier 1 nurse accepting an `is_invasive = true` booking receives HTTP 403; `is_prohibited = true` services cannot be booked (SRS §10 acceptance criteria).

## Known Baseline Notes

- SRS §8 describes `POST /api/v1/bookings/:id/reviews` as available "after the shift is SETTLED", while FR-RATE-01 (§4.6) states ratings open immediately at `COMPLETED` without waiting for settlement. This catalogue follows FR-RATE-01; the discrepancy is logged in the Open Decisions Register for the baseline owners to reconcile.

## Per-Module Contract Files

In addition to this catalogue, each domain module in `services/api/src/modules/<module-name>/` maintains its detailed contract definition here:

- `<module-name>.api.md` — Route definitions, request schemas, response formats, and error codes.
