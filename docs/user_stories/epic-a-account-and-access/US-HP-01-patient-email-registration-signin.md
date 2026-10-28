# User Story US-HP-01: Customer Registration & Sign-In with Phone Number + OTP

> **Epic:** EPIC A — Account & Access Management  
> **Bounded Context:** `Identity & Consent`  
> **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-01`
- **Story Title:** Customer Registration & Sign-In with Phone Number + OTP
- **Bounded Context:** `Identity & Consent`
- **Primary Persona:** Customer (Patient / Family Member)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Traceability:** FR-AUTH-03 · SRS §8 APIs `POST /api/v1/auth/request-otp`, `POST /api/v1/auth/verify-otp` · SRS §2.1 (Actors)

---

## 💡 Real-World Context & Problem Statement

1. **The phone number is the single identity anchor for every actor:** In SRS v2.0 the marketplace has no hospital tenants and no staff-issued accounts. Customers, nurses and Admins all authenticate on the same identity foundation, and the `users.phone` field is unique across the platform. Sign-in for customers and nurses is phone number + OTP — there is no email-based registration or sign-in channel in the new model.
2. **Identity verification is deliberately split from sign-in:** Signing in with an OTP proves control of the phone number only. The stronger identity check (eKYC with CCCD) is enforced separately, at the point of risk: a customer must complete eKYC before booking home-care at a private home (see US-HP-06), while booking care at a hospital location requires phone verification only.

---

## 📖 User Story Statement

> As a **Customer (Patient or Family Member)**,  
> I want to register and sign in using my phone number and a one-time password (OTP) sent to that number,  
> So that I can access the marketplace quickly and securely, without maintaining a separate password-based account.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Registration & Sign-In via Phone + OTP
- **Given** an unregistered user on the Patient Web or Mobile App,
- **When** they enter their phone number and request an OTP (`POST /api/v1/auth/request-otp`), then submit the received code (`POST /api/v1/auth/verify-otp`),
- **Then** the system creates the account with role `PATIENT` (first sign-in) or opens a session for the existing account, keyed by the unique phone number.

### AC-02: Single Identity per Phone Number
- **Given** a phone number already registered on the platform,
- **When** the same number is used to register again,
- **Then** the system does not create a duplicate account; the user is signed in to the existing account bound to that number (`users.phone` is UNIQUE).

### AC-03: No Email-Based Channel for Customers
- **Given** any customer registration or sign-in interface,
- **When** a user interacts with the form,
- **Then** the only credential requested is the phone number plus OTP; no email/password registration or sign-in flow is offered to customers or nurses (Admin Portal access is covered separately in US-HP-05).

### AC-04: eKYC Gate Is Separate from Sign-In
- **Given** a customer who has signed in with phone + OTP but has not completed eKYC,
- **When** they browse services and nurse profiles,
- **Then** browsing and sign-in are allowed, but creating a booking for care at a private home is blocked until eKYC is completed (FR-AUTH-03; see US-HP-06).

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP01-01` | Register a new customer via phone + OTP | Functional | Account created with role `PATIENT` after successful OTP verification |
| `TC-USHP01-02` | Re-register with an already-used phone number | Functional / Data | No duplicate account; user signed in to the account bound to that unique phone number |
| `TC-USHP01-03` | Sign in with an incorrect or expired OTP | Security | Sign-in rejected; no session issued |
| `TC-USHP01-04` | Unverified customer attempts a home-care booking | Functional / AuthZ | Booking blocked with a prompt to complete eKYC (FR-AUTH-03) |

> **Open item:** OTP length, expiry window and resend/rate limits are [Not specified in SRS v2.0 — open item].
