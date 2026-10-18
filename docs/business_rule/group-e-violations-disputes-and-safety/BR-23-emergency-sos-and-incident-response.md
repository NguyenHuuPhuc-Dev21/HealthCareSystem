# BR-23: Emergency SOS Signal & Incident Response

> **Group:** Group E — Violations, Disputes & Safety  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Key Decisions:** Q-48 (Hospital backup emergency contacts configuration)  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Immediate Distress Activation:** When life-threatening medical emergencies or violent domestic incidents occur, help must be summonable with a single tap, without procedural friction.
2. **Accountability via 5-Minute Escalation:** Emergency broadcasts without strict personal ownership fail; on-duty clinical responders must acknowledge alerts within 5 minutes or face automatic escalation.

---

## 2. Rule Specifications

### 2.1 Unilateral Distress Activation Triggers
- **Patient or Present Family Member:** Can press the dedicated SOS button at **any time** (UC140), without waiting for AI screening or physician clearance.
- **Visiting Nurse:** Can press SOS inside the Nurse App during a visit (UC92).
- **Automated System Triggers:**
  - Symptom screening indicating acute emergency (Flows 04, 05, 07A).
  - High-risk physician triage escalation (Flow 13).
  - In-session add-on Tier C life-safety signs (Flow 07C).

### 2.2 National Emergency 115 Protocol (No Auto-Calling in MVP)
- The user interface immediately displays prominent **115 national emergency guidance** and launches the device's native telephone dialer with `115` pre-filled.
- **The platform DOES NOT make automated telephonic calls to 115 in the MVP.** Automated dialing requires dedicated emergency service integrations and location-handover protocols, deferred beyond Pilot Q-23.

### 2.3 5-Minute Hospital Escalation Protocol (Q-48)
- The incident dispatches urgent priority push alerts to the hospital's designated on-duty response desk (On-Duty Physician, Hospital Dispatcher, Assigned Nurse).
- **If unacknowledged within 5 minutes:** The system automatically escalates the alert to the hospital's secondary emergency contact registry (Q-48).

### 2.4 Transition to Emergency Early Termination
- If an SOS is triggered during an active visit, the session transitions immediately to Flow 15 under the **Medical Emergency** classification.
- **On-site financial collection is strictly prohibited.**

### 2.5 Immutable Incident Logging
- The incident log records: trigger timestamp, initiator ID, geocoded coordinates, notification timestamps, responder acknowledgements, and final resolution notes.
- Sensitive unstructured clinical history is excluded from the alert notification payload.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC20, UC92, UC134, UC140
- **Activity Flows:** Flow 15 (Emergency Termination), Flow 17 (Emergency SOS)
- **Governing Decisions:** Q-48 (Secondary emergency escalation channels)
