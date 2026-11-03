/**
 * privacy-consent policy — the medical-record access window (FR-PRIV-01 §2–3, US-HP-18).
 * PURE function: no DB, no clock, no config. The caller passes the facts, the
 * RECORD_ACCESS_EXPIRY_HOURS value and "now", so every boundary is unit-testable.
 *
 * Allowed only when ALL hold:
 *   a) the asking nurse is the booking's assigned nurse            else NOT_ASSIGNED
 *   b) the patient profile still has consent and is not deleted     else CONSENT_WITHDRAWN
 *   c) one of:
 *      - booking CONFIRMED or IN_PROGRESS                            → ACTIVE_BOOKING
 *      - booking COMPLETED and now < checkout_time + expiryHours     → POST_CHECKOUT_WINDOW
 *      - an unexpired Admin re-grant for this nurse                  → ADMIN_GRANT
 *                                                                    else WINDOW_CLOSED
 */
import type {
  RecordAccessDecision,
  RecordAccessFacts,
  RecordAccessOutcome,
} from "./privacy-consent.types";

const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  "CONFIRMED",
  "IN_PROGRESS",
]);
const HOUR_MS = 60 * 60 * 1000;

export function decideRecordAccess(
  facts: RecordAccessFacts,
  nurseId: string,
  expiryHours: number,
  now: Date,
): RecordAccessOutcome {
  if (!facts.assignedNurseId || facts.assignedNurseId !== nurseId) {
    return { allowed: false, reason: "NOT_ASSIGNED" };
  }
  if (!facts.consentActive || facts.profileDeleted) {
    return { allowed: false, reason: "CONSENT_WITHDRAWN" };
  }
  if (ACTIVE_STATUSES.has(facts.executionStatus)) {
    return {
      allowed: true,
      patientProfileId: facts.patientProfileId,
      basis: "ACTIVE_BOOKING",
      accessUntil: null,
    };
  }

  const candidates: RecordAccessDecision[] = [];
  if (facts.executionStatus === "COMPLETED" && facts.checkoutTime) {
    const windowEnd = new Date(
      facts.checkoutTime.getTime() + expiryHours * HOUR_MS,
    );
    if (now.getTime() < windowEnd.getTime()) {
      candidates.push({
        patientProfileId: facts.patientProfileId,
        basis: "POST_CHECKOUT_WINDOW",
        accessUntil: windowEnd,
      });
    }
  }
  if (facts.grantUntil && now.getTime() < facts.grantUntil.getTime()) {
    candidates.push({
      patientProfileId: facts.patientProfileId,
      basis: "ADMIN_GRANT",
      accessUntil: facts.grantUntil,
    });
  }
  if (candidates.length === 0)
    return { allowed: false, reason: "WINDOW_CLOSED" };

  // Both open (window + grant): report the one that lasts longer.
  const best = candidates.reduce((a, b) =>
    b.accessUntil!.getTime() > a.accessUntil!.getTime() ? b : a,
  );
  return { allowed: true, ...best };
}
