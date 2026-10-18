# Functional Requirements Specification (FRS)
## Hospital Home-Care Nursing Platform

| Metadata | Details |
|---|---|
| **Specification Baseline** | `use_case_v8.1.drawio` (140 UCs, BR-01–BR-23) + `luong_hoat_dong_v8.14.drawio` (Frozen baseline Oct 16, 2026; accompanying consolidated Business Rules document) |
| **Confirmed Tech Stack** | React / React Native (Nurse app), Node.js + TypeScript, PostgreSQL, Cloud Object Storage (Signed URLs), Job Queue, Transactional Email, Push Notifications, Maps API |
| **Document Status** | **Proposal — Pending PO Sign-off.** All FRs are directly derived from the baseline Use Cases (UCs) and Business Rules (BRs) without introducing unapproved scope. |
| **Original Vietnamese Baseline** | Preserved in [`archive/functional-and-non-functional.vi.md`](archive/functional-and-non-functional.vi.md) |

---

### Priority Conventions (MoSCoW — Pilot Scope Decision Q-23)
*Pilot baseline scope: Single hospital tenant, advance bookings only, online payment gateway only, strictly cashless, no instant matching, rule-based AI screening assistance with mandatory on-duty doctor review.*

- **Must** — Critical pilot blocker; the pilot cannot run without this requirement. Directly maps to the 27 Must User Stories (`US-HP`).
- **Should** — Essential immediately post-pilot, or a controlled manual workaround is acceptable during pilot.
- **Could** — Valuable enhancement; does not block any milestone.
- **Won't (Current Release)** — Deliberately excluded from current scope; documented explicitly to prevent uncontrolled implementation.

*Note on Deprecated / Merged Use Cases:* UCs designated as "Merged / Deprecated" in the catalog (UC29, UC70–UC76, UC130–UC132) do not generate functional requirements. UC131 remains intentionally unassigned per the code non-reuse convention.

---

## FR-01 — Account, Identity & Access Control

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-01.1** | User registration and authentication strictly via email and password; account verification code sent via email with a 5-minute validity window (password reset token valid for 15 minutes); self-service forgot/reset password flow via email. | UC1, UC14, UC82; BR-20 | Must |
| **FR-01.2** | Temporary account lock triggered upon 5 consecutive failed attempts combining password and 2FA OTP (shared counter); lock duration is 15 minutes with security alert dispatched to account owner; counter resets upon successful authentication. | UC15; Flow 03 | Must |
| **FR-01.3** | Mandatory Two-Factor Authentication (2FA) for operational and administrative roles: Nurse, Doctor, Hospital Administrator, and Platform Administrator (via email OTP or authenticator app). | UC83; BR-20 | Must |
| **FR-01.4** | Two-step clinical staff onboarding: Hospital creates and submits profile (including Practicing License/CCHN, degrees) → Hospital confirms clinical qualifications (Step 1) → Platform Administrator conducts final compliance review and approves (Step 2); request updates or reject with mandatory audit reason; lifecycle status transitions per BR-21 with automated daily license expiration checks. | UC5–UC8, UC10–UC12, UC139; BR-21 | Must |
| **FR-01.5** | Staff account activation (dispatching credentials securely via email); account suspension or credential update upon resignation, expired practicing license (CCHN), or department transfer. | UC69, UC81; BR-21 | Must |
| **FR-01.6** | Four-factor backend authorization enforcement (`Role × Hospital Tenant × Relationship × Visit/Profile Context × Status`); support sub-roles for Hospital Administration (Dispatch Coordinator, Accountant, HR-QC, Head Administrator). | UC16; BR-09; use_case page 13 | Must |
| **FR-01.7** | Append-only audit logging for every patient record access and sensitive operational action (recording Actor ID, Timestamp, Target Record ID, Action Type, and Context). | UC17; BR-09, BR-21 | Must |
| **FR-01.8** | Tenant onboarding: creation of hospital facility records and provisioning of initial tenant administrator accounts. | UC80 | Must |

---

## FR-02 — Patient Profiles, Consent & Data Privacy

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-02.1** | Patient profile creation; single account can manage multiple dependent/relative profiles; primary account holder self-declares kinship relationship and legal representation commitment (no national ID/CCCD collection). | UC3, UC4; BR-17, BR-20 | Must |
| **FR-02.2** | Granular consent management per patient profile; adult relatives must grant consent independently via email confirmation link; system logs exact terms version accepted. | UC2, UC4; BR-17 | Must |
| **FR-02.3** | Right to withdraw consent at any time (verified via email OTP / link): immediately blocks new booking creation; handles ongoing bookings based on execution state (pre-dispatch → cancel + 100% refund; in-transit/in-session → gracefully complete or terminate session). | UC106, UC129; BR-17 | Must |
| **FR-02.4** | Mandatory re-consent when material changes occur to terms of service (non-consented users restricted to read-only access); non-material updates distributed via notification only. | UC138; BR-17 (Q-47) | Should |
| **FR-02.5** | Right to erasure (Right to Be Forgotten): verified via email OTP, validates operational constraints (active bookings, open disputes, outstanding balances, statutory medical retention rules); executes anonymization/deletion within 72 hours; dispatches milestone deadline alerts; rejects with explicit justification if constrained. | UC61–UC65, UC104, UC105; BR-12 | Must |
| **FR-02.6** | Assign attending physician for follow-up patients; grant and revoke time-bounded history access strictly restricted to the doctor's affiliated hospital tenant. | UC13, UC58, UC59, UC102; BR-09 | Should |

---

## FR-03 — Symptom Screening & Clinical AI Assistance

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-03.1** | Mandatory symptom screening during booking flow, classifying triage into 4 tiers: Low Risk (No Flag) / Early Evaluation Needed / Emergency / Insufficient Information; persisted as reproducible event records per booking (ERD event schema v8.11). | UC21; BR-10 | Must |
| **FR-03.2** | Emergency tier handling: immediately aborts booking creation, displays guidance to dial national emergency service (115), and presents one-tap SOS emergency button. | UC20; BR-10, BR-23 | Must |
| **FR-03.3** | Patient review of screening results with ability to submit supplemental symptoms (prohibited from downgrading risk tier); updates allowed up to T−1h before visit; re-triages using identical logic; escalation to Emergency cancels visit and issues automatic 100% deposit refund. | UC22, UC119; BR-10 | Must |
| **FR-03.4** | Automated fallback on AI timeout, error, or low confidence: escalates to on-duty triage doctor for manual review within 10 minutes; if doctor SLA breaches, provides immediate instructions for patient to contact hospital directly. | UC23; BR-10 (Q-21) | Must |
| **FR-03.5** | Post-visit AI clinical risk analysis based on submitted care reports; dispatches high-risk alerts to assigned physician (emergency findings trigger alerts to both patient and doctor); doctor handles alerts; 3 consecutive AI failures in 30 minutes or manual hospital AI toggle defaults to High Risk. | UC54, UC55, UC68; BR-10; Flow 13 | Should |
| **FR-03.6** | AI clinical boundary constraints: AI never issues definitive medical diagnosis, never prescribes medication, never authorizes invasive procedures, and never approves staff credentials or financial refunds; all AI outputs must disclose purpose, limitations, uncertainty score, and human escalation path. | BR-10 | Must |

---

## FR-04 — Booking, Nurse Matching & Dispatch

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-04.1** | Advance booking creation (earliest T+2h, farthest T+14 days): facility and service selection, automated debt validation, cap of 3 concurrent active bookings, schedule conflict check, and service geofence validation. | UC18, UC27; BR-06, BR-13, BR-14 | Must |
| **FR-04.2** | Browse healthcare facilities, care service catalog, and tiered pricing; configure optional preferences (familiar nurse, gender preference). | UC84, UC85 | Must |
| **FR-04.3** | Nurse discovery and selection based on published open shifts, certified competencies, and ratings; dispatch targeted appointment request; nurse must accept/decline within 30 minutes (time slot held conditionally). | UC28, UC112–UC115; BR-13 | Must |
| **FR-04.4** | Nurse availability schedule management (rolling 14-day window); toggle "Available for Dispatch" status during approved operational operating windows (BR-03). | UC114, UC9; BR-03 | Must |
| **FR-04.5** | Pre-visit reminder and confirmation sequence: T−24h booking reminder; T−3h mandatory nurse re-confirmation (deadline T−2h); T−2h patient symptom update prompt (optional); failure of nurse to re-confirm triggers automated rematching. | UC118, UC119; BR-13 | Must |
| **FR-04.6** | Nurse cancellation handling: system triggers automated rematching governed by remaining lead time; patient options: accept replacement / select alternative / reschedule / cancel with 100% deposit refund; system defaults apply upon SLA breach per BR-13. | UC116, UC117, UC37; BR-13 (Q-19) | Must |
| **FR-04.7** | Manual fallback dispatch: Dispatch Coordinator assigns qualified replacement nurse when automated matching fails or times out. | UC78 | Must |
| **FR-04.8** | Patient-initiated booking cancellation (deposit refund tiered per BR-04 schedule); Hospital Administrator review and approval for exceptional full refund claims. | UC34, UC36; BR-04, F2 | Must |
| **FR-04.9** | Appointment rescheduling: eligible only for deposit-paid orders with > 2h lead time; maximum 2 reschedules per booking while preserving deposit; exception allowed during nurse rematching. | UC120; BR-13 | Should |
| **FR-04.10** | Instant Booking / Fast Auto-Assignment (hard filtering + scoring rank, total elapsed time ≤ 15 min, no rejection button, violation counter per BR-01). | UC19, UC24, UC25, UC30–UC33, UC87; BR-01, BR-08 | **Won't** (Pilot Q-23) |
| **FR-04.11** | Assisted booking via hospital hotline / discharge lounge: Dispatch Coordinator creates booking on patient behalf; patient confirms consent and pays deposit via secure email link. | UC135 | **Won't** (Deferred pending PO review) |
| **FR-04.12** | Prescription-bound medical services: patient must upload valid clinical prescription at booking; on-duty doctor verifies within 30 minutes; invalid prescription blocks booking and directs patient to in-hospital consultation. | UC136, UC137; BR-15 | Must |

---

## FR-05 — Home Care Visit Execution

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-05.1** | Calculate departure deadline and estimated travel time (ETA) based on service tier; nurse shares real-time GPS location from departure until check-in; patient tracks incoming nurse location on map. | UC38, UC39; BR-07 | Must |
| **FR-05.2** | Automated visit abandonment ("no-show") detection (departure overdue by 10 minutes without movement / GPS disabled > 10 minutes) → temporarily locks dispatch eligibility, initiates violation workflow; auto-unlocks after 24h cooldown per Q-43. | UC77; BR-07, BR-02 | Must |
| **FR-05.3** | In-home check-in verification: GPS geofence validation + dynamic in-app check-in code displayed on patient mobile app; fallback mechanism: geofenced timestamped photo + patient verification, followed by 24h hospital post-audit. | UC40; BR-07, BR-20 | Must |
| **FR-05.4** | Visit initiation with mandatory initial clinical assessment form tailored to service type (mandatory even if patient provided no prior symptom updates). | UC41; BR-22 | Must |
| **FR-05.5** | In-visit supplemental add-on items: categorized into Class A (minor supplies) / Class B (technical procedures requiring hospital approval ≤ 10 min) / Class C (acute escalation requiring session stop & SOS); billable add-ons require prior patient confirmation and logging in care report. | UC91; BR-15 | Must |
| **FR-05.6** | Visit conclusion and mandatory care report submission tailored to service type (two-stage status: "Ended" / "Completed"); reminder sent after 2 hours; dispatch eligibility temporarily suspended after 24 hours if report remains incomplete. | UC42, UC43; BR-22 | Must |
| **FR-05.7** | Secure persistence of care report into patient medical record at the executing hospital; viewable strictly per access rights defined in BR-09. | UC44, UC59; BR-09 | Must |
| **FR-05.8** | Mid-session visit termination: capture termination reason, compute fees per BR-16, mandatory termination report, immediate payment collection for accrued fees (except medical emergency / safety threats); Hospital Admin confirms/adjusts within 24 hours; post-audit for "unsafe environment" claims (Q-46); unperformed scope re-issued as zero-deposit child booking. | UC127, UC128; BR-16, F9 | Must |
| **FR-05.9** | Patient absent protocol: nurse reports patient unreachable after 15 minutes of verified on-site arrival; minimum visit fee assessed without penalizing nurse metrics. | UC89; BR-07 | Must |
| **FR-05.10** | In-app secure communication channel (masked in-app chat / VoIP calling) between patient and assigned nurse without exposing personal phone numbers. | UC133; BR-20 | Should |
| **FR-05.11** | End-of-session itemized billing reconciliation: patient explicitly approves non-disputed ledger items (15-minute on-site window / 24 hours for special termination scenarios). | UC93; BR-04 (Q-33) | Must |

---

## FR-06 — Billing, Payment, Refunds & Reconciliation

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-06.1** | Mandatory 30% advance deposit (minimum 50,000 VND) collected exclusively via online payment gateway within a 15-minute lock window; expiration auto-cancels order and releases reserved slot; strictly no cash deposits. | UC45; BR-04 | Must |
| **FR-06.2** | Payment gateway integration with direct settlement into hospital merchant account (SaaS platform never escrows patient funds); cryptographically signed idempotent webhook handling; automatic transaction matching against completed visits. | UC46, UC47, UC48; BR-05 | Must |
| **FR-06.3** | Post-visit remaining balance settlement via gateway; unpaid status enters "Pending Payment" for 24 hours, then escalates to "Outstanding Debt", blocking subsequent bookings. | UC121; BR-04, BR-14 | Must |
| **FR-06.4** | Automated deposit refund processing per BR-04 schedule (>12h advance: 100%, 2–12h: 50%, <2h or nurse en route: 0%; hospital/nurse fault or emergency screening: always 100%); automated refund dispatch without manual approval. | UC90; BR-04 | Must |
| **FR-06.5** | Manual post-settlement refund orders (for itemized disputes, session aborts, gateway anomalies) backed by auditable vouchers; real-time refund status tracking until final settlement. | UC90; BR-18 F1b/F8 | Must |
| **FR-06.6** | Itemized bill line disputes: unpaid dispute lines handled under workflow F1a; settled lines handled under F1b; holdback and allocation of deposit toward disputed lines per Q-30. | UC93; BR-04, BR-18 | Must |
| **FR-06.7** | Electronic invoice (e-Invoice) issuance for patient (total visit value minus deposit) via integrated e-invoice provider; credit notes / adjusted invoices issued upon refund. | UC126; BR-04 (Q-11) | Must |
| **FR-06.8** | End-of-period deposit reconciliation across 4 buckets (Deducted / Refunded / Retained / Disputed Escrow); sum must mathematically match total gross deposits; discrepancies open investigation tickets; manual bank statement upload fallback. | UC48, UC111; BR-04, BR-05, F7 | Must |
| **FR-06.9** | Platform commission fee calculation (% per completed booking); monthly billing and invoice generation to hospital tenants. | UC95; BR-05 | Should |
| **FR-06.10** | Nurse compensation ledger: nurse views detailed earnings breakdown, payout statements, and trust/reliability score. | UC96, UC97 | Should |
| **FR-06.11** | In-home cash collection flow: nurse inputs collected cash amount, patient confirms in-app, nurse remits to treasury within 48h, hospital cashier signs off. | UC122–UC125; BR-05 | **Won't** (Pilot Q-23) |
| **FR-06.12** | Patient transaction portal: view historical bookings, payment receipts, and tax invoices. | UC94 | Must |

---

## FR-07 — Violations, Complaints & Incident Management

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-07.1** | Nurse cancellation violation rules based on lead time (BR-02): automated logging, trust score penalty, reduced payout split for next 3 visits, temporary suspension; single evaluation in Flow 06 including force majeure review; capped at 3 violations per 30-day window; 4th occurrence triggers indefinite suspension pending disciplinary committee. | UC72, UC88; BR-02 | Must |
| **FR-07.2** | Hospital Administrator handles disciplinary actions and formal reviews (platform provides technical locks and audit telemetry only). | UC79; BR-02 | Must |
| **FR-07.3** | Formal complaint filing (deadline: 30 days post-visit; line-item dispute: 24 hours); complaints targeting nurse forwarded verbatim to hospital; SLA tracking with reminders; Platform Admin steps in upon hospital breach (F3). | UC51, UC52, UC53, UC100; BR-11 | Must |
| **FR-07.4** | Severe complaint handling: immediate temporary dispatch suspension of involved nurse; Hospital Admin must confirm or lift within 4 hours. | UC98; BR-11 | Must |
| **FR-07.5** | Single-tier complaint appeal: appeal adjudicator must be independent of initial reviewer per matrix F4; respondent also holds right to appeal. | UC53, UC99; BR-11, F4 | Should |
| **FR-07.6** | Platform-level complaints handled by independent Platform Admin; monthly SLA reporting. | UC99; BR-11 | Should |
| **FR-07.7** | Patient abuse flagging: tracked per user account over a 90-day rolling window; flag/unflag workflow with 7-day notification and rebuttal window; flag escalation requires alternative manager decision upon timeout. | UC36, UC51, UC93; BR-19 | Should |
| **FR-07.8** | Nurse safety report: nurse reports patient misconduct (harassment, unsafe environment) directly via app. | UC101; BR-11 | Should |
| **FR-07.9** | In-home clinical adverse incident reporting: isolated from standard customer complaints; triggers immediate safety response protocol. | UC134; BR-11 | Must |
| **FR-07.10** | Post-visit nurse rating and review (optional; not a prerequisite for filing complaints). | UC50; BR-11 | Could |

---

## FR-08 — Follow-up Consultation & Post-Visit Monitoring

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-08.1** | Automated follow-up recommendation generated from post-visit risk evaluation; patient reviews recommendation and selects hospital facility. | UC56, UC57 | Should |
| **FR-08.2** | Attending physician approves follow-up clinical plan; access to visit history for follow-up strictly restricted to the physician's hospital facility. | UC60, UC59; BR-09 | Should |

---

## FR-09 — SOS & Emergency Response

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-09.1** | Emergency SOS trigger available at all times to Patient / Relative (without waiting for AI or doctor triage); nurse can trigger SOS during visit; emergency entry points: triage screening emergency, Class C clinical escalation, or physician alert. | UC140, UC92; BR-23 | Must |
| **FR-09.2** | Emergency UI immediately displays local emergency guidelines (115) alongside a one-tap phone dialer; the system explicitly disclaims automated 115 calling on user's behalf. | BR-23 | Must |
| **FR-09.3** | Immediate dispatch alert to hospital on-duty emergency team; if unacknowledged after 5 minutes, auto-escalates to backup contact; comprehensive audit log (exact timestamp, initiator identity, location coordinates if authorized, recorded actions). | UC140; BR-23 (Q-48) | Must |
| **FR-09.4** | In-visit SOS activation immediately halts visit execution under medical emergency grounds; strictly prohibits on-site fee collection. | BR-23, BR-16 | Must |

---

## FR-10 — Hospital & Platform Administration, Configuration & Analytics

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-10.1** | Effective-dated hospital configuration: service catalog pricing, geographic service geofences, revenue split ratios, cancellation fee and refund tiers. | UC108; BR-05, BR-06 | Must |
| **FR-10.2** | System parameter configuration: operational operating windows, timeout thresholds, default SLA limits, SOS escalation endpoints and on-duty hospital contacts. | UC109; BR-03, BR-23 | Must |
| **FR-10.3** | Integration of hospital merchant bank accounts with payment gateway partner. | UC110; BR-05 | Must |
| **FR-10.4** | Hospital administrative dashboard; Platform Administrator global multi-tenant dashboard; real-time monitoring of overdue tasks (BR-18 financial queue, 72h data erasure deadline, complaint resolution SLAs). | UC107, UC66, UC103 | Must |
| **FR-10.5** | Nurse clinical performance analytics; hospital revenue and service category financial reports. | UC67, UC49 | Should |
| **FR-10.6** | Configurable clinical care report templates and mandatory field validation per service type (subject to hospital clinical director sign-off). | BR-22 (Q-49) | Must |

---

## FR-11 — Cross-Cutting Notifications & Job Scheduling

| Requirement ID | Requirement Description | Baseline Source | Priority |
|---|---|---|---|
| **FR-11.1** | Notification delivery channels: in-app push notifications and transactional email; **strictly no SMS and no phone number communications**; notification payloads must not leak sensitive protected health information (PHI). | BR-20, BR-23 | Must |
| **FR-11.2** | Centralized business scheduler & background job queue: 15-minute deposit expiration, T−24h/T−3h/T−2h reminders, billing confirmation countdowns, BR-18 SLA timers (48h, 72h, 5 days, 7 days), license expiration scans, and 72h data erasure pipelines. | BR-04, BR-13, BR-18, BR-12, BR-21 | Must |
| **FR-11.3** | Comprehensive escalation logging: every SLA escalation notification (5-minute SOS breach, overdue complaints, financial reconciliation discrepancies) logs transmission and acknowledgment timestamps for audit compliance. | BR-11, BR-18, BR-23 | Must |

---

*Note: In the event of any discrepancies between specifications, the precedence order is: Business Rules (`use_case_v8.1.drawio`) → Activity Flows (`luong_hoat_dong_v8.14.drawio`) → Requirements Specifications.*
