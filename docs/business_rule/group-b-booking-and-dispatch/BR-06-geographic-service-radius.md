# BR-06: Geographic Service Radius & Distance Limits

> **Group:** Group B — Booking & Dispatch  
> **Source Baseline:** `use_case_v8.1.drawio` (Pages 12, 14) + `luong_hoat_dong_v8.14.drawio`  
> **Status:** Baseline Frozen

---

## 1. Context & Business Intent

1. **Travel Time Realism:** Nurse dispatch requires timely physical arrival. Service boundaries must be governed by travel radius and transit time rather than administrative borders.
2. **Ignoring Obsolete Provincial Boundaries:** Following administrative provincial mergers, individual provinces span hundreds of kilometers. Using provincial boundaries causes dispatch failures; physical distance from the hospital facility is the only valid metric.

---

## 2. Rule Specifications

### 2.1 Configurable Service Radius
- The patient's requested care address must reside within the designated operational radius of the selected hospital branch.
- Default threshold: **15 km radius or 45 minutes travel time** (configurable per hospital facility).

### 2.2 Physical Location over Registered Domicile
- Service availability is determined strictly by the real-time physical address entered for the care visit.
- Legal hometown, birthplace, or registered permanent residency is ignored.
- *Canonical Baseline Example:* A patient originally from Quang Tri currently residing in Da Nang can successfully book services from a Da Nang hospital facility. However, a patient who had surgery in Da Nang and returned home to Quang Tri cannot dispatch nurses from the Da Nang facility.

---

## 3. Traceability & Dependencies

- **Use Cases:** UC27, UC108
- **Activity Flows:** Flow 04 (Advance Booking), Flow 05 (On-Demand Dispatch)
