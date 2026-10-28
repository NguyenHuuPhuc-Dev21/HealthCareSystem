# BR-10: Symptom Screening & AI Guardrails — Scope Note

> **Group:** Group F — Symptom Screening & AI  
> **Source Baseline:** SRS HealthCareSystem — On-Demand Nursing, Version 2.0 (Updated, 28/10/2026)  
> **SRS References:** FR-AUTH-03, FR-BOOK-02, FR-SHIFT-02, FR-SHIFT-05, SRS §4.2, RISK-01, RISK-02  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version. **This file is a scope note: the topic it governed is not part of SRS v2.0.**

---

## 1. Scope Status

SRS v2.0 contains **no AI symptom screening, no symptom-based triage classification (of any number of tiers), and no doctor/on-duty-physician triage fallback**. Nothing in SRS v2.0:

- collects symptoms through a screening questionnaire or classifies them before booking;
- blocks or reroutes a booking because of an algorithmic or physician triage decision;
- gives any AI component a role in authorizing care, validating medical orders, or assessing clinical risk.

The hospital baseline's BR-10 in its entirety — the deterministic 4-tier triage model, pre-session symptom updates with safety monotonicity, the physician classification fallback on engine timeout (old Q-21), post-session AI risk analysis, and the AI behavioral guardrails with accuracy criteria (old Q-26) — is **superseded and must not be implemented**. Patient safety in SRS v2.0 is instead enforced by the human- and structure-based mechanisms in §2.

---

## 2. The Live SRS v2.0 Mechanisms (Closest Equivalent Rules)

1. **Customer condition declaration at booking (FR-AUTH-03):** The customer self-declares the patient's condition in the patient profile — medical history, mobility status, weight, infectious status. This declaration is unverified by any screening engine, but it is **binding**: it drives pricing (heavy-patient surcharge) and is checked on site (point 4). Misreporting carries the consequences of BR-19 §2.1 / BR-16 §2.3.
2. **Catalog & tier safety gating (SRS §4.2, RISK-02):** Dangerous services are excluded structurally — prohibited services cannot be booked at all, and invasive services are hard-gated to TIER_2_SPECIALIST nurses with a valid GPHN (see BR-15 §2.1). This replaces triage as the mechanism that keeps unsafe work off the platform.
3. **Human y lệnh verification (FR-BOOK-02, RISK-01):** For invasive services, the safety review of the doctor's order is performed by the **Tier-2 nurse** (image review before acceptance, original-document check on site, penalty-free refusal right). Admin's human role is credential/GPHN verification and tier assignment (FR-AUTH-02). No AI validates orders.
4. **On-site condition verification & mismatch rights (FR-SHIFT-02):** The nurse verifies the declared condition in the first 30 minutes after check-in and may demand a surcharge correction or stop the shift without penalty if reality does not match the declaration (see BR-16 §2.3).
5. **Emergency protocol instead of pre-triage (FR-SHIFT-05, RISK-03):** Deterioration is handled when it happens, by the 115-first SOS protocol (BR-23), not predicted by a screening layer.

---

## 3. Open Items

- Any future introduction of AI-assisted symptom screening, triage, or clinical decision support would require a new SRS change request with its own safety and liability specification — **[Not specified in SRS v2.0 — open item]**.
- Automated symptom-based booking blocking or emergency auto-detection: **[Not specified in SRS v2.0 — open item]** (the only emergency trigger in SRS v2.0 is the manual in-app SOS, BR-23).

---

## 4. Traceability & Dependencies

- **SRS References:** FR-AUTH-03, FR-BOOK-02, FR-SHIFT-02, FR-SHIFT-05; SRS §4.2; RISK-01, RISK-02, RISK-03
- **Related Rules:** BR-15 (catalog gating & y lệnh), BR-16 (mismatch stop), BR-19 (misreporting), BR-23 (emergency protocol)
