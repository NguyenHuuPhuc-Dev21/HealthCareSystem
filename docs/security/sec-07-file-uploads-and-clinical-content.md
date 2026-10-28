# Security Policy Group 7 — File Uploads & Clinical Content

| Policy Metadata | Details |
|---|---|
| **Governing Baseline** | SRS HealthCareSystem — On-Demand Nursing, **Version 2.0 (Updated, 28/10/2026)** (FR-AUTH-01, FR-BOOK-02, FR-SHIFT-01, FR-DISP-01, NFR-SEC-01) |
| **Status** | Revised per SRS v2.0 — supersedes the hospital-baseline version |
| **Applicable Scope** | CCCD Images, GPHN Scans & Credential Documents, Portraits & Check-in Selfies, Doctor's-Order (Y lệnh) Images, Dispute Evidence, Care-Record Attachments |
| **Priority Classification** | **[P0]** Mandatory MVP Blocker · **[P1]** Mandatory Commercial Go-Live · **[P2]** Continuous Hardening |
| **Core Vulnerability Target** | Malicious file uploads, Unrestricted File Upload (RCE), Stored XSS in clinical forms, metadata leakage, fake check-in imagery. |

---

## File Upload & Clinical Content Rules

### SEC-7.1 [P0] Multi-Tiered File Upload Verification Pipeline
All inbound uploads must pass a multi-stage validation pipeline. The platform's upload classes are: nurse onboarding documents (CCCD both sides, degree, GPHN scan, retirement decision, live portrait — FR-AUTH-01), customer CCCD eKYC images (FR-AUTH-03), doctor's-order images attached to invasive bookings (FR-BOOK-02), check-in live selfies (FR-SHIFT-01), dispute evidence (maximum 5 images/videos — FR-DISP-01), and in-app chat images (FR-CHAT-01).
1. **Strict File Type Whitelist:** Validate by both declared MIME type and file magic bytes (images `jpeg`/`png`; documents additionally `application/pdf` for credential files). Executable and scriptable formats (`.exe`, `.sh`, `.php`, `.js`, `.html`, SVG with script content) are rejected outright.
2. **File Size Constraints:** Enforce per-class size limits (e.g., maximum 10 MB per image) *(numeric limits are a retained engineering standard — not specified in SRS v2.0)*.
3. **Automated Malware Scanning:** Files are scanned by an anti-malware engine (e.g., ClamAV or a cloud scanner) before they become viewable by any other user or Admin; unscanned or infected files stay quarantined *(retained engineering standard — not specified in SRS v2.0)*.
4. **Isolated Storage & Randomized Identifiers:** Files are stored in **private** object storage (S3/MinIO) under cryptographically random UUID object keys, never under user-supplied filenames, and never in a publicly listable bucket (NFR-SEC-01).
5. **Authenticated Access via Signed URLs:** Files are **never** accessible via public or guessable URLs. Downloads are served only via pre-signed URLs with **10-minute** validity (NFR-SEC-01), issued after the SEC-2.1 authorization check for that viewer and purpose — e.g., a doctor's-order image to the assigned Tier-2 nurse (within the SEC-2.4 window), a GPHN scan to the verifying Admin, dispute evidence to the assigned dispute handler.

### SEC-7.2 [P0] Live-Capture-Only Check-in Selfies (Anti-Spoofing)
- The check-in selfie must be captured **live through the in-app camera**: selecting an image from the device gallery is blocked, and basic liveness interaction (e.g., slight head turn / blink) is required (FR-SHIFT-01, RISK-05).
- The backend stamps the stored selfie with the **server timestamp and GPS coordinates** as an evidentiary watermark/record (`shift_logs.checkin_selfie_url`, `is_mock_location_detected`). Deep AI liveness/eKYC is a commercial-phase upgrade recorded in NFR-SEC-01; the MVP control set (mock-location block + live capture + server stamp) must not be weakened in the interim.
- The customer receives the check-in selfie for visual confirmation (FR-SHIFT-01); distribution beyond the booking parties and dispute handlers is prohibited.

### SEC-7.3 [P0] Structured Clinical Content & Stored XSS Prevention
- Clinical content is structured, not free-form HTML: shift logs use versioned JSONB schemas (`vital_signs_log`, `care_activities_log`, `emergency_incident_log` in `shift_logs`), and care activities follow the booking's service definition.
- Free-text inputs (care notes, dispute descriptions, review comments, chat messages) must forbid raw HTML/script; all client surfaces apply strict contextual output encoding when rendering them (SEC-4.2).

### SEC-7.4 [P1] EXIF & Embedded Metadata Handling
- For ordinary clinical and care images shared between users (e.g., wound-progress photos in chat or care records), embedded EXIF metadata (GPS coordinates, device identifiers) must be stripped on ingestion before redistribution *(retained engineering standard — not specified in SRS v2.0)*.
- **Evidentiary exception:** Check-in selfies and doctor's-order images are evidence: their capture context (server timestamp, coordinates, booking linkage) is preserved in the structured database record (`shift_logs`, `bookings.prescription_image_url`) rather than relying on file EXIF, and the original file is retained unmodified in private storage for dispute and legal review.
