# BR-09: Backend Data Authorization & Least Privilege Principle

> **Group:** Group A — Identity, Accounts & Personal Data  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 13, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-20 (Decided: Cross-hospital patient record sharing is unsupported)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Security Beyond UI Obfuscation:** Front-end button hiding or client-side checks are completely untrusted. All authorization checks must be enforced at the backend controller and database query layers.
2. **Medical Privacy & Tenant Isolation:** Protect Patient Health Information (PHI) under strict hospital multi-tenant isolation and enforce the principle of least privilege.

---

## 2. Rule Specifications

### 2.1 Access Control Matrix Formulation
- Access Permissions = `System Role` × `Hospital Tenant ID`.
- Hospital Administrators assign granular operational sub-roles within their respective hospital boundary.

### 2.2 Backend Four-Pillar Authorization Check
Every incoming data request must be validated against four mandatory contextual pillars at the backend API layer before query execution:
1. **User Role:** Authenticated role and sub-role.
2. **Relationship with Patient:** Account ownership, legal representation, or active assignment.
3. **Specific Visit / Shift Scope:** The target shift or record identifier.
4. **Business Lifecycle Status:** Current order status (e.g., active care session vs. closed visit).

### 2.3 Role-Specific Data Access Boundaries
- **Patients:** View exclusively their own profile and profiles of family members created under their account.
- **Nurses:** View only patient information strictly necessary for their assigned care visit, and only during the active window of that shift.
- **Hospital Administrators:** Access data strictly within their hospital tenant boundary.
- **SaaS Platform Administrators:** Access aggregated operational and billing metrics; **strictly prohibited from viewing clinical PHI by default**.
- **Doctors:** Access longitudinal care histories of patients treated within their own hospital, from initial assignment until follow-up conclusion or consent revocation.

### 2.4 Cross-Hospital Data Sharing Restriction (Q-20)
- Cross-hospital access to patient medical histories—**even with explicit patient consent—is strictly unsupported** in the baseline architecture (Decision Q-20). Each hospital's clinical records remain completely siloed.

### 2.5 Immutable Audit Logging
- Every read, update, export, or deletion of patient health records generates an immutable audit log entry recording: actor ID, role, timestamp, target profile ID, action type, and IP address.
- Sensitive credentials (passwords, auth tokens) and excess unstructured PHI are strictly excluded from audit log payloads.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC16, UC17, UC58, UC59, UC102
- **Activity Flows:** Applied across all operational flows (01–17)
- **Governing Decisions:** Q-20 (Cross-hospital data sharing strictly disabled)
