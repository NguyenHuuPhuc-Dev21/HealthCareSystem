# User Story US-HP-36: Event-Driven Notifications Across the Booking Lifecycle

> **Epic:** EPIC I — Notifications  
> **Bounded Context:** `Notification`  
> **Target Release:** MVP (Phase 1)  
> **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version

---

## 📌 Story Metadata

- **Story ID:** `US-HP-36`
- **Story Title:** Event-Driven Notifications Across the Booking Lifecycle
- **Bounded Context:** `Notification`
- **Primary Persona:** All Roles (Customer, Nurse, Admin)
- **Target Release:** MVP (Phase 1)
- **Source Baseline:** SRS v2.0 (Updated, 28/10/2026)
- **Status:** Revised per SRS v2.0 — supersedes the hospital-baseline version
- **Traceability:** FR-NOTIF-01 · SRS §9 (FCM & SMS/ZNS gateway integration) · SRS §7 (`notifications`) · NFR-UI-01 (elder-friendly nurse apps)

---

## 💡 Real-World Context & Problem Statement

1. **Every handoff in the marketplace is asynchronous:** A booking waits for payment, a radar dispatch waits for a nurse to accept within minutes, a settlement waits out a 24-hour window, a cash commission waits for the nurse to self-pay. If the relevant party is not notified at the moment an event occurs, the flow stalls or a deadline is missed.
2. **Push alone is not enough for this user base (FR-NOTIF-01):** Many nurses are retired medical staff on older devices who may be offline or miss a push. Urgent events therefore carry an automatic SMS/Zalo ZNS fallback when the push is not acknowledged within 60 seconds; routine events use Push (FCM) + the in-app Notification Center + WebSocket realtime updates. (The new model has no email channel: identity is phone + OTP, and notification channels are those defined in FR-NOTIF-01.)

---

## 📖 User Story Statement

> As a **Customer, Nurse, or Admin**,  
> I want to receive event-driven notifications — push, in-app, and SMS fallback for urgent events — for every lifecycle event that requires my attention or action,  
> So that I never miss a booking, a shift, a deadline, or an emergency.

---

## 🎯 Acceptance Criteria (AC)

### AC-01: Booking & Matching Events
- **Given** the booking lifecycle events — booking created and awaiting payment (with the 15-minute payment deadline), payment held and matching started, radar dispatch offering a new shift to eligible nurses, nurse assigned (`CONFIRMED`), booking `EXPIRED` (unpaid or unmatched) with refund, and booking cancelled (including near-start cancellations that need urgent re-dispatch),
- **When** each event occurs,
- **Then** the affected parties are notified immediately; new-shift radar alerts are sent with FCM priority = high (SRS §9), and a near-start cancellation needing urgent re-dispatch is an SMS-fallback-eligible urgent event (FR-NOTIF-01).

### AC-02: Shift Execution Events
- **Given** the execution events — shift reminder before the start time, nurse checked in, nurse checked out / shift completed, and a shift-extension request awaiting the other party's response,
- **When** each event occurs,
- **Then** the customer and the nurse (as applicable) receive push + in-app notifications, and the customer's app reflects the check-in selfie cross-check and the completion state in realtime via WebSocket.

### AC-03: Money Events — Settlement & Cash Commission
- **Given** the money events — settlement completed (transfer booking: 85% released to the nurse's available balance), refund issued to the customer, and, for cash bookings, the 15% commission payment link issued at check-out with its 24-hour self-payment deadline (including a reminder before the deadline and a suspension notice if it lapses),
- **When** each event occurs,
- **Then** the nurse and/or customer are notified through push + in-app channels, and the nurse-facing flows remain within the elder-friendly limits of NFR-UI-01 (large text, ≤ 3 actions for the commission-payment flow).

### AC-04: Dispute, Rating & Violation Events
- **Given** the post-shift events — dispute opened (with settlement frozen), dispute resolved with its outcome, ratings opened at `COMPLETED` (and revealed when both sides have submitted or 7 days pass), and violation sanctions applied (deposit penalty deducted, TrustScore change, `SUSPENDED`/`BANNED`),
- **When** each event occurs,
- **Then** both parties (and Admin, for disputes) are notified with the outcome and any required action.

### AC-05: SOS — Highest Priority With SMS Fallback
- **Given** an SOS triggered during a shift (US-HP-26),
- **When** the alert is dispatched,
- **Then** it is sent with FCM priority = high to the family and the Admin Portal and delivered in under 2 seconds (SRS §10 TC-SOS-01); if the push is not acknowledged within 60 seconds (or FCM returns an unregistered/invalid token), the background worker automatically sends the SMS/ZNS fallback to the registered phone number (FR-NOTIF-01, SRS §9).

### AC-06: Delivery Is Recorded Per Notification
- **Given** any notification dispatched by the system,
- **When** it is sent,
- **Then** a `notifications` record stores the recipient, booking reference, title/body, channel (`PUSH_FCM` | `IN_APP` | `SMS_FALLBACK`), `delivery_status` (`PENDING` | `SENT` | `FAILED`), and read state, so missed or failed deliveries can be audited and retried.

---

## 🧪 Acceptance Test Cases (Traceability Matrix)

| Test Case ID | Test Objective | Test Type | Expected Result |
| :--- | :--- | :--- | :--- |
| `TC-USHP36-01` | Radar new-shift alert dispatch | Functional | Eligible nurses receive high-priority push; in-app record created |
| `TC-USHP36-02` | Check-in / check-out notifications | Functional | Customer notified at check-in (with selfie cross-check) and at completion |
| `TC-USHP36-03` | Cash-commission deadline notifications | Functional | Link issued at check-out; reminder before 24h; suspension notice if unpaid after 24h |
| `TC-USHP36-04` | SOS alert delivery & fallback (SRS TC-NFR-01) | Functional / Safety | Alert delivered < 2s; SMS fallback sent when push unacknowledged after 60 seconds |
| `TC-USHP36-05` | Settlement & dispute outcome notifications | Functional | Both parties notified of release/refund and of dispute outcomes |
| `TC-USHP36-06` | Delivery audit record | Compliance | `notifications` row with channel and `delivery_status` for every dispatched event |
