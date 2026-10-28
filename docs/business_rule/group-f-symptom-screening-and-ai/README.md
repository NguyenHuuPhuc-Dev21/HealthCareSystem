# Group F — Symptom Screening & AI Governance

**Scope notice (SRS v2.0):** This group governed symptom screening, triage classification, and AI guardrails in the hospital baseline. **SRS v2.0 contains no AI symptom screening, no triage tiers, and no doctor-triage fallback.** The single rule in this group is therefore maintained as a scope note (BR-10) recording that status and pointing to the SRS v2.0 mechanisms that actually perform the equivalent safety functions: the customer's binding condition declaration at booking, catalog/tier safety gating, human y lệnh verification by the Tier-2 nurse, the nurse's on-site condition-mismatch rights, and the 115-first emergency protocol.

## Rules in this Group

| Rule ID | Rule Title | Core Architectural Focus | Traceability (SRS v2.0) |
| :--- | :--- | :--- | :--- |
| **BR-10** | [Symptom Screening & AI Guardrails — Scope Note](BR-10-symptom-screening-and-ai-guardrails.md) | Not in SRS v2.0: no AI screening/triage. Live equivalents: condition declaration, service-catalog gating, y lệnh review, mismatch stop/report, emergency protocol. | FR-AUTH-03, FR-BOOK-02, FR-SHIFT-02, FR-SHIFT-05 · SRS §4.2 |
