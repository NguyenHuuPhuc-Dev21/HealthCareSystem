# Group G — Supplementary Activity Flow Rules

This group captures supplementary operational rules that sit outside the main BR groups. Under SRS v2.0 both rules in this group changed fundamentally: account lockout is now governed by the SRS account/profile status lifecycles (not by a sign-in failure counter), and call-center proxy booking does not exist in the SRS v2.0 self-service model.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability (SRS v2.0) |
| :--- | :--- | :--- | :--- |
| **R-L03** | [Account Status & Lockout Policy](R-L03-account-lockout-policy.md) | `profile_status` lifecycle as the single source of truth; suspension triggers (TrustScore < 60, deposit below minimum, unpaid cash commission > 24h); OTP attempt limits not specified. | SRS §2.3 · FR-RATE-01 · FR-PAY-02 · FR-PAY-03 |
| **R-UC135** | [Call-Center Proxy Booking — Scope Note](R-UC135-call-center-proxy-booking.md) | Not in SRS v2.0: bookings are self-service via Patient Web/App; relatives book for a patient under their own customer account. | SRS §2.1 · FR-AUTH-03 · FR-ADMIN-01 |
