# R-L03: Account Lockout on Consecutive Failed Sign-In Attempts

> **Group:** Group G — Supplementary Activity Flow Rules  
> **Source Baseline:** `luong_hoat_dong_v8.14.drawio` (Flow 03)  
> **Recommendation:** Formalize into BR-20 in next baseline update.  
> **Status:** Active Flow Rule

---

## 1. Context & Business Intent

1. **Brute-Force & Credential Stuffing Defense:** Prevent automated attackers from compromising patient health portals or staff administration systems through repeated password guessing.
2. **Unified Security Counter:** Protect against attackers attempting to guess two-factor authentication codes after acquiring passwords.

---

## 2. Rule Specifications

### 2.1 Unified Failed Attempt Threshold
- Password verification failures and Two-Factor Authentication (2FA) verification failures share a **single cumulative counter of 5 attempts**.
- Upon the **5th consecutive failure**:
  - The account is **temporarily locked for 15 minutes** (UC15).
  - A security alert notification is dispatched immediately to the registered email address.
- The failure counter resets to zero upon any successful sign-in.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC15
- **Activity Flows:** Flow 03 (Authentication & Session Management)
