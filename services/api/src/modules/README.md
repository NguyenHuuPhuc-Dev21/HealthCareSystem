# Backend Business Modules (`services/api/src/modules/`)

> **Baseline:** SRS HealthCareSystem On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)**.  
> **Module Architecture:** Flat structure in `modules/`, named by **discrete business capability** (English, kebab-case, singular).  
> **Creation Policy:** Just-in-time creation upon the start of each phase. Do not scaffold empty directories ahead of time.

## Standard 8-File Architecture per Module

Every module adheres to this 8-file layout:

```
<module-name>/
├── README.md                  # Mission, authoritative FR/CT codes, open items
├── <module-name>.routes.ts    # Route definitions & middleware bindings (no business logic)
├── <module-name>.service.ts   # Pure business logic (sole location for business decisions)
├── <module-name>.repo.ts      # Parameterized database access (sole database interaction point)
├── <module-name>.policy.ts    # Authorization policy (tier hard-gate, record-access window)
├── <module-name>.jobs.ts      # Background timers registered with core/jobs (if temporal)
├── <module-name>.types.ts     # DTOs and internal types (status enums imported from packages/shared)
└── <module-name>.schema.ts    # Request validation schema (whitelist validation)
```

## 36 Business Modules by Phase

| Phase | Module Name | Owner | Authoritative SRS Focus |
|---|---|---|---|
| **Phase 1 (AUTH)** | `accounts-otp` | BE-1 | Phone + SMS OTP login, rate limiting, Admin 2FA |
| | `nurse-onboarding` | BE-1 | FR-AUTH-01 eKYC wizard, document upload |
| | `credential-review` | BE-1 | FR-AUTH-02 Admin verification, Tier assignment |
| | `tier-lifecycle` | BE-2 | Daily GPHN expiry sweep, auto-demote/re-upgrade |
| | `patient-profiles` | BE-2 | FR-AUTH-03 Patient data + Customer eKYC gate |
| | `privacy-consent` | BE-3 | FR-PRIV-01 Decree 13 consent, 12h record access window |
| **Phase 2 (SCHED)** | `nurse-availabilities` | BE-2 | FR-SCHED-01 Recurring windows & time-off exceptions |
| | `availability-engine` | BE-2 | FR-SCHED-01 Effective availability with 60m buffer |
| | `nurse-search` | BE-3 | FR-SEARCH-01 Spatial search with Tier & status filters |
| **Phase 3 (BOOK)** | `prescription-gate` | BE-1 | FR-BOOK-02 Invasive service prescription controls |
| | `pricing-engine` | BE-2 | FR-BOOK-01 Dynamic pricing (base + night + holiday + heavy) |
| | `bookings` | BE-2 | FR-BOOK-01 Creation, 15m payment hold, validation |
| | `matching-radar` | BE-2 | FR-BOOK-03 Urgent matching (5 km → 10 km) via Redis lock |
| | `job-board` | BE-3 | FR-BOOK-03 Advance bookings & direct invite fallback |
| | `booking-expiry` | BE-3 | FR-BOOK-03 Payment timeout & unmatched expiry jobs |
| **Phase 4 (SHIFT)** | `shift-extend` | BE-1 | FR-SHIFT-03 1-hour block extension flow |
| | `prescription-rejection`| BE-1 | FR-BOOK-02 On-site invalid prescription refusal |
| | `check-in` | BE-2 | FR-SHIFT-01 Anti-mock GPS <= 200m + camera selfie |
| | `shift-logs` | BE-2 | FR-SHIFT-02 Structured clinical vitals & care logging |
| | `check-out` | BE-2 | FR-SHIFT-04 Minimal care report, start 24h/12h clocks |
| | `sos` | BE-3 | FR-SHIFT-05 Emergency 115 + concurrent push/SMS |
| **Phase 5 (PAY)** | `cancellation-policy` | BE-1 | §5.2 SLA matrix policy table (9 scenarios) |
| | `deposits` | BE-2 | FR-PAY-03 Upfront 300k deposit (penalties only) |
| | `cash-commission` | BE-2 | FR-PAY-02 Cash 15% self-remittance, overdue suspension |
| | `wallets-ledger` | BE-3 | Append-only wallet_transactions with idempotency_key |
| | `gateway-webhooks` | BE-3 | FR-PAY-01 HMAC-SHA256 verification & deduplication |
| | `settlements` | BE-3 | FR-PAY-02 24h cooling escrow release (85/15) |
| | `withdrawals` | BE-3 | FR-PAY-04 Earnings withdrawal request & approval |
| **Phase 6 (POST)** | `reviews-trustscore` | BE-1 | FR-RATE-01 Blind 2-way rating, TrustScore updates |
| | `chat` | BE-2 | FR-CHAT-01 Masked in-app chat & call logging |
| | `disputes` | BE-3 | FR-DISP-01 24h dispute filing, escrow freeze |
| | `notifications` | BE-3 | FR-NOTIF-01 FCM high-priority + 60s SMS fallback |
| **Phase 7 (ADMIN)** | `admin-catalog` | BE-1 | FR-ADMIN-01 Service catalog CRUD & Tier tags |
| | `admin-configs` | BE-1 | Dynamic system_configs editing without code change |
| | `admin-users` | BE-2 | User lifecycle & profile_status control |
| | `admin-finance` | BE-3 | CT-15 Financial reconciliation reporting |

*Note: Phase 2 scope (`contract-bidding`, `contract-lifecycle`, `partial-settlement`) is excluded from MVP.*

