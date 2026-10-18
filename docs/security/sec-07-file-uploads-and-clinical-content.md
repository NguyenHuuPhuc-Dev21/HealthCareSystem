# Security Policy Group 7 — File Uploads & Clinical Form Content

| Policy Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_diagram.drawio` + `workflow_diagram.drawio` (BR-15, BR-22, UC41, UC43, UC136, Decision Q-49) |
| **Applicable Scope** | Medical Prescription Attachments, Clinical Care Reports, Refund Vouchers, Photo Evidence |
| **Priority Classification** | **[P0]** Mandatory Pilot Blocker · **[P1]** Mandatory Production Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | Malicious file uploads, Unrestricted File Upload (RCE), Stored XSS in medical forms, EXIF metadata leakage. |

---

## File Upload & Clinical Content Rules

### SEC-7.1 [P0] Multi-Tiered File Upload Verification Pipeline
All inbound file uploads (e.g., patient clinical prescriptions under **UC136**, financial dispute vouchers under **BR-18**, staff qualification certificates under **BR-21**) must pass through a multi-stage validation pipeline:
1. **Strict File Type Whitelist:** Validate allowed file types by checking both MIME type headers and file magic bytes (e.g., strictly allowing `image/jpeg`, `image/png`, and `application/pdf`). Executable files (`.exe`, `.sh`, `.php`, `.js`) and scriptable formats are rejected outright.
2. **File Size Constraints:** Enforce strict file size limits (e.g., maximum 10 MB per attachment).
3. **Automated Malware Scanning:** Files must be scanned asynchronously by an anti-malware engine (e.g., ClamAV or cloud security scanner) prior to being made available for download.
4. **Isolated Storage & Randomized Identifiers:** Files must be stored completely outside the public web server root (in private cloud object storage buckets) and renamed using cryptographically secure random UUIDs.
5. **Authenticated Access via Signed URLs:** Uploaded medical and financial documents must **never** be accessible via public, guessable URLs. File downloads must be served strictly via time-bounded pre-signed URLs (validity ≤ 15 minutes) issued only after server-side four-factor authorization verification (**BR-09**).

### SEC-7.2 [P0] Structured Clinical Forms & Stored XSS Prevention
- Clinical assessment forms and care reports (Decision **Q-49**) must be defined as versioned, strongly typed JSON schemas rather than arbitrary unstructured HTML/rich text.
- Free-text narrative inputs (such as nurse clinical notes or patient observations) must strictly forbid raw HTML markup or embedded scripts.
- When rendering clinical notes across client interfaces (nurse mobile application, hospital admin web portal, patient portal), the consuming clients must apply strict contextual output encoding to eliminate Stored Cross-Site Scripting (Stored XSS) vectors.

### SEC-7.3 [P1] Automatic Stripping of Embedded EXIF Location Metadata
- Clinical photos captured in-session (such as wound dressing progress or physical check-in backup verification) must be automatically stripped of embedded EXIF metadata (specifically GPS coordinates and device hardware identifiers) upon ingestion.
- *Exception:* If GPS coordinates are an explicit, legally mandated evidentiary requirement for the home visit, the location coordinates must be extracted by the backend, validated, and persisted separately in the structured visit audit table rather than remaining embedded within the distributed image binary.
