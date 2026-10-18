# System Requirements Specifications (SRS)

> **Specification Baseline:** `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23) + `luong_hoat_dong_v8.14.drawio` (17 Activity Flows)  
> **Pilot Scope (Decision Q-23):** Single hospital, advance booking only, online payment gateway only, rule-based symptom screening with clinical review, SOS escalation within 5 minutes.  
> **Status:** Proposal — Pending PO Sign-off  
> **Original Vietnamese Baseline:** Preserved in [`archive/functional-and-non-functional.vi.md`](archive/functional-and-non-functional.vi.md)

---

## 1. Document Index

The system requirements are organized into two dedicated specifications:

| Specification Document | Description | Scope / Modules |
|---|---|---|
| [**`functional-requirements.md`**](functional-requirements.md) | **Functional Requirements Specification (FRS)** | 11 core functional modules (FR-01 to FR-11) covering identity, booking, dispatch, home visits, payments, disputes, SOS, and administration. |
| [**`non-functional-requirements.md`**](non-functional-requirements.md) | **Non-Functional Requirements Specification (NFRS)** | 9 quality attribute categories (NFR-01 to NFR-09) covering performance, availability, security, privacy (Decree 13), financial precision, scalability, usability, field resilience, and maintainability. |

---

## 2. Directory Structure

```
docs/requirement/
├── README.md                           # Master Catalog & Overview (this file)
├── functional-requirements.md          # Complete Functional Requirements Specification (EN)
├── non-functional-requirements.md      # Complete Non-Functional Requirements Specification (EN)
└── archive/
    └── functional-and-non-functional.vi.md  # Original combined Vietnamese baseline document
```

---

## 3. Precedence & Governance

When code and documentation disagree, the specifications govern:
1. **Business Rules** (`use_case_v8.1.drawio`, BR-01–BR-23)
2. **Activity Flows** (`luong_hoat_dong_v8.14.drawio`, Flows 01–17)
3. **Requirements Specifications** (`functional-requirements.md`, `non-functional-requirements.md`)
