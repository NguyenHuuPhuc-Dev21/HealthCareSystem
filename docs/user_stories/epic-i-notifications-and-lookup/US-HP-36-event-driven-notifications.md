# User Story US-HP-36: Event-Driven Notifications via Email & In-App

> **Epic:** EPIC I — Notifications & Lookup  
> **Bounded Context:** `Notification`  
> **Target Release:** Pilot Q-23 (Release 1)  
> **Status:** Baseline Frozen

---

## 📌 Story Metadata

- **Story ID:** `US-HP-36`
- **Story Title:** Event-Driven Notifications via Email & In-App
- **Bounded Context:** `Notification`
- **Primary Persona:** All Roles (Patient, Family Member, Nurse, Doctor, Admin)
- **Target Release:** Pilot Q-23 (Release 1)
- **Traceability:** UC119 and notification events in Flows 04–15, 17 · BR-20

---

## 💡 Real-World Context & Problem Statement

1. **Asynchronous event-driven workflows require timely notifications:** Nurse matching, reminders, shift cancellations, pending payment requests, and SOS alerts all rely on timely notifications to prevent workflows from stalling.
2. **Channel boundaries strictly restricted to Email and In-App:** In compliance with BR-20 and decision Q-51, the platform sends zero SMS messages—all messaging relies strictly on verified email and authenticated in-app notifications.
3. **Real-time priority channels for SOS emergencies:** SOS alerts must not rely solely on email queues; they must use instantaneous in-app delivery channels to reach on-duty staff within seconds.

---

## 📖 User Story Statement

> As a **System User (Patient, Nurse, or Staff Member)**,  
> I want to receive event-driven notifications via email and/or in-app alerts when business events relevant to me occur,  
> So that I never miss an actionable appointment milestone, schedule change, or critical alert.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Targeted Role-Based Event Notifications
- **Given** a business event requiring notification (matching outcome, UC119 reminder, shift change, payment reminder, SOS),
- **When** the event occurs,
- **Then** the system dispatches notifications to the relevant role(s) via email and/or in-app channels according to notification configuration.

### AC-02: Strict Zero SMS Policy (BR-20)
- **Given** any notification event,
- **When** processed by the notification service,
- **Then** under no circumstances is an SMS message generated or dispatched.

### AC-03: Real-Time In-App Priority Channel for SOS Emergencies
- **Given** an emergency SOS event,
- **When** dispatching alerts to on-duty hospital contacts,
- **Then** the notification uses an immediate real-time in-app channel (not relying solely on email) to satisfy the 5-minute acknowledgement SLA.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP36-01` | Matching outcome notification dispatch | Functional | Correct recipients receive email and in-app notifications |
| `TC-USHP36-02` | Audit notification channels against SMS policy | Compliance / BR-20 | Zero SMS messages sent across all test events |
| `TC-USHP36-03` | Emergency SOS notification delivery | Functional / Safety | Immediate in-app alert delivered to on-duty responder |
