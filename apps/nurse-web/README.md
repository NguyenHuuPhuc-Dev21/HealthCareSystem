# Nurse Web Portal (`apps/nurse-web`)

> **Baseline:** SRS HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**.  
> **Role Assignment:** FE-2 (Nurse Web Portal & Nurse Mobile App).  
> **Target Audience:** Retired doctors/nurses and fresh nursing graduates managing registrations, weekly recurring schedules, credential uploads (GPHN), income wallets, and cash commission payments on desktop/tablet viewports.  
> **Design Standard:** WCAG 2.1 AA Elder-Friendly standard (Large font 18–20px, high-contrast, oversized touch targets, simple 3-step flows).

## Features & Journeys

| Feature | Phase | Backend Modules | Description |
|---|---|---|---|
| `auth` | 1 | `accounts-otp` | Phone + OTP SMS login. |
| `onboarding` | 1 | `nurse-onboarding` | Wizard: CCCD both sides, live portrait, degree, GPHN, retirement decision. |
| `credentials` | 1 | `credential-review` | View verified credentials, upload renewed GPHN when expired. |
| `availabilities` | 2 | `nurse-availabilities` | Weekly recurring schedule setup and time-off exception dates. |
| `job-board` | 3 | `job-board`, `matching-radar` | Browse advance shifts (> 6h) and direct invitations. |
| `shift` | 4 | `check-in`, `shift-logs`, `check-out` | View assigned shift details, clinical notes, and post-shift reporting. |
| `wallet` | 5 | `wallets-ledger`, `deposits`, `withdrawals` | 3 segregated balances (available, escrow locked, deposit), top-up, withdrawal requests. |
| `commission-payment` | 5 | `cash-commission` | Generate VietQR link for 15% platform commission on cash shifts (24h countdown). |
| `disputes` | 6 | `disputes` | Dispute notification and rebuttal submission with evidence. |
| `reviews` | 6 | `reviews-trustscore` | Post-shift customer rating (blind submission). |
| `trust-score` | 6 | `reviews-trustscore` | Personal TrustScore status, deduction/recovery logs, suspension warning. |
| `notifications` | 6 | `notifications` | Real-time notification center. |
| `chat` | 6 | `chat` | Masked in-app chat with patient/family for active bookings. |

