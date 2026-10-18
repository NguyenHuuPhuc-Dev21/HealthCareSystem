# BR-20: Identity & Communication Exclusively via Email

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-51 (Decided: Email-only, no SMS, no CCCD)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Elderly-Friendly Onboarding:** Requiring multiple identifiers (phone numbers, national ID/CCCD) causes significant friction and drop-off among elderly patients and caretakers.
2. **Minimizing High-Risk Sensitive Data:** The platform does not collect national ID cards (CCCD) or verify legal age, avoiding unnecessary data liability while maintaining sufficient identity assurance via verified email.
3. **Separation of Authentication vs. On-Site Check-In:** Account authentication codes are sent via email, whereas on-site session verification codes are displayed dynamically inside the mobile app to verify physical presence.

---

## 2. Rule Specifications

### 2.1 Account Authentication & Zero-SMS Policy
- User registration and sign-in are conducted strictly via **Email + Password**.
- All account-level verification codes (registration verification, password reset, re-authentication for consent revocation or data erasure) are delivered exclusively to the registered email address.
- Validity windows:
  - Routine account OTPs: **5 minutes**.
  - Password reset links/OTPs: **15 minutes**.
- **SMS is strictly prohibited across the platform** (Decision Q-51).

### 2.2 Mandatory Two-Factor Authentication (2FA) for Staff
- Two-factor authentication (2FA) is **mandatory** for all internal and healthcare professional accounts:
  - Nurses
  - Doctors
  - Hospital Administrators
  - SaaS Platform Administrators
- The second factor is delivered via email OTP or supported time-based authenticator apps (TOTP per UC83).
- **Patient accounts are exempt** from mandatory 2FA to prevent usability barriers for elderly care recipients.

### 2.3 Strict Exclusion of National ID Cards (CCCD)
- The platform does not collect national ID numbers (CCCD), identity card photos, or biometric data from patients, relatives, or staff.
- The platform does not verify age or legal biological relationships. Dependent family profiles are created under the sole attestation and legal responsibility of the account owner.
- Physical identity documents and civil credentials of hospital medical staff are verified and retained offline by the hospital's human resources department.

### 2.4 In-Session Dynamic Verification Codes vs. Account OTPs
- All codes utilized during on-site visit execution (nurse check-in, billing summary confirmation, in-session add-ons, session termination) are **dynamic codes generated and rendered in real time within the patient's mobile app**.
- These in-session codes are **fundamentally distinct from account OTPs** and are **never sent via email**. This ensures that check-in verification cannot be spoofed remotely by dispatchers or coordinators.

### 2.5 In-App Communication Channels
- All direct communication between Patients and Nurses occurs strictly via authenticated **in-app chat and VoIP calling** (UC133).
- Phone numbers are never exposed, required, or collected for communication.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC1, UC14, UC40, UC61, UC82, UC83, UC106, UC133
- **Activity Flows:** Flow 01 (Staff Registration), Flow 02 (Patient Registration), Flow 03 (Authentication)
- **Governing Decisions:** Q-51 (Email-only channel, zero SMS, no CCCD collection)
