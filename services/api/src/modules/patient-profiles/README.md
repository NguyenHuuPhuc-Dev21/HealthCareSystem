# Module `patient-profiles` (BE-2 / Dev B · Phase 1)

Customer eKYC and care-recipient profiles, plus the guard `bookings` will call in Phase 3.

- **SRS:** FR-AUTH-03, FR-PRIV-01 §1 · **Rules / stories:** BR-14 §2.1–2.2, BR-17 · US-HP-06 AC-01..03 · RTM TC-KYC-01
- **API contract:** [`docs/api/patient-profiles.api.md`](../../../../../docs/api/patient-profiles.api.md)

## Files
| File | Role |
|---|---|
| `patient-profiles.policy.ts` | **pure** rules: location-based eKYC gate, who may submit eKYC, CCCD masking, DOB checks |
| `patient-profiles.service.ts` | eKYC submit/review, profile create/read/update, `assertCanBookForProfile` guard, wiring |
| `patient-profiles.repo.ts` | SQL — `PgPatientProfilesRepo` (PATCH writes only whitelisted columns) |
| `patient-profiles.routes.ts` / `.schema.ts` / `.types.ts` | HTTP, strict validation, DTOs |

## Rules
- **No consent, no profile.** `captureConsent` (BE-3) runs first; anything but `true` → 400 `CONSENT_REQUIRED`, nothing written.
  Consent timestamp is server time; IP and `X-Device-Id` are stored with it.
- **eKYC gate by location.** HOME care needs the customer's `users.kyc_status = VERIFIED`; HOSPITAL care does not.
  The gate is enforced when a **booking** is created (`assertCanBookForProfile`), not when a profile is saved.
- eKYC files go through BE-1's upload pipeline (`kyc-cccd`, `kyc-selfie`, magic-byte check); the DB keeps only object keys
  in `users.kyc_documents`. Admins get 10-minute links. One CCCD number = one account (`uq_users_cccd_number` → 409).
- Admin decision: APPROVED → VERIFIED; REJECTED → back to UNVERIFIED with a reason. `reviewedBy`/`reviewedAt` stored,
  `REVIEW_CUSTOMER_KYC` audited in the same transaction (no CCCD number in the audit row).
- Ownership: every PATIENT route uses `customer_id = req.user.id AND deleted_at IS NULL`; otherwise 403 (no existence leak).
- While consent is withdrawn the profile cannot be edited (403 `CONSENT_REQUIRED`).
- No DELETE here: erasure/anonymization is BE-3's `privacy-requests` flow, so retention rules stay in one place.
- Lists never include `medicalHistory`; nothing medical or identity-related is written to application logs.

## Tests
- `test/unit/patient-profiles.test.ts` — policy, schema, service with an in-memory repo, booking guard.
- `test/integration/patient-profiles.test.ts` — real PostgreSQL: consent columns, PATCH whitelist, eKYC + audit, TC-KYC-01.

## Notes for the team
- **BE-2 `bookings` (Phase 3):** call `assertCanBookForProfile(tx, customerId, patientProfileId)` inside the booking
  transaction; it also returns `weightKg` / `mobilityStatus` for the heavy-patient surcharge.
- **BE-3:** re-consent after withdrawal (TC-USHP03-03) has no endpoint yet — privacy-consent owns it.
- **BE-1:** reuses `NurseOnboardingService.requestUploadUrls` / `verifyUploadedFile` for the customer's CCCD + selfie.
- **Open (OD-10):** eKYC vendor/method; MVP is manual Admin review.
