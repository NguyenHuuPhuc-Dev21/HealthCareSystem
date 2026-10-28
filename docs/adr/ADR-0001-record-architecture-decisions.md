# ADR 0001: Record Architecture Decisions

## Status
Accepted — **Revised per SRS v2.0 (Updated, 28/10/2026)**; supersedes the hospital-baseline version of this record.

## Context
HealthCareSystem is an **on-demand nursing marketplace**: a single platform that connects patients/families with independent caregivers — retired or freelance doctors/nurses holding a valid practice licence (GPHN), and newly graduated nursing students — for home-care and at-hospital shifts. The governing specification is the SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026).

The earlier project incarnation was a multi-tenant hospital SaaS (hospital tenants, hospital administrators, email-only identity). That model has been **abandoned**: there are no hospital tenants, no tenant data segregation, and no hospital-operated administration. Architectural decisions must therefore be recorded against the marketplace model, and we need a standard mechanism to document significant decisions, trade-offs, and design rationales as the platform evolves from MVP (Phase 1) to Phase 2.

## Decision
We will use Architecture Decision Records (ADRs) formatted in markdown within `docs/adr/`. Each record follows the standard format:
- Title with sequence number (`ADR-NNNN-<title>.md`)
- Status (Proposed, Accepted, Deprecated, Superseded)
- Context
- Decision
- Consequences (Positive and Negative)

This record also fixes the platform's foundational architecture decisions, taken from SRS v2.0:

1. **Single-platform marketplace architecture.** One operator runs one platform; authorization isolates users by role (Customer / Nurse / Admin / Super Admin), ownership, and assignment — not by tenant. The backend is a modular monolith exposing the SRS §8 REST API (`/api/v1/`), with PostgreSQL as the system of record and a 3-axis booking state machine (execution / payment / dispute).
2. **Client surfaces and stack.** React for the three web surfaces — Patient Web, Admin Web Portal, and the Nurse Web Portal (added in v2.0 alongside the mobile app) — plus a Nurse Mobile App (check-in GPS/selfie, radar dispatch, elder-friendly UI) and the Patient Mobile App. **Node.js + TypeScript end-to-end**, PostgreSQL, **Redis + job queue** (matching rounds, timers, settlement, notifications), **FCM/APNs push** with SMS fallback, and **private object storage (S3/MinIO) with short-lived signed URLs** for all sensitive files.
3. **Phone + OTP identity.** Customers and nurses authenticate by phone number + OTP; legal identity is established separately by eKYC (CCCD, credential verification, Admin-approved GPHN with `reviewed_by`). The Admin Portal additionally requires mandatory 2FA. Email is a profile attribute, not an identity factor.
4. **Configuration-driven business parameters.** All money/safety numbers (commission 15%, deposit 300,000 VND, surcharges, timeouts, settlement cooling 24 h) live in the `system_configs` table and are changed by audited Admin operations — never hard-coded.
5. **Simulated escrow for the MVP.** Prepaid (bank-transfer) funds are held in an internal ledger over a sandbox gateway (PayOS/VNPay/VietQR); cash jobs settle by the nurse self-paying the 15% commission. Commercial operation must move held funds to a State-Bank-licensed payment intermediary (SRS §1.3).

## Consequences
- Architectural history and rationale are tracked in version control alongside code and the governing SRS.
- New engineers can trace why constraints such as the SQL-first database layer (ADR-0002), tier hard-gating, or phone+OTP identity were chosen — and can see that hospital-tenancy and email-only decisions from the previous model are explicitly superseded, not silently dropped.
- Each future change to the decisions above (e.g., moving from simulated to licensed escrow, adding Phase 2 contract bookings) requires a new ADR referencing this one.
