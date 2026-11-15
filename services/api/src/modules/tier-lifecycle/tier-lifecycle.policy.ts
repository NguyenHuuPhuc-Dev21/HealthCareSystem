/**
 * tier-lifecycle policy — PURE rules (no DB, no clock). BE-2 · Phase 1 · FR-AUTH-02 §2, BR-21 §2.5.
 *
 * One rule decides Tier 2 everywhere: credential-review's computeTier
 * (Tier 2 ⇔ an approved GPHN whose expiry date is AFTER the given day). The sweep, the
 * matcher and nurse-search all go through these helpers, so "approve" and "demote" can
 * never disagree (credential-review README, note for BE-2).
 */
import { NurseTier } from '@healthcare-system/shared';
import { computeTier } from '../credential-review/credential-review.policy';

export interface TierFacts {
  tier: NurseTier;
  gphnNumber: string | null;
  /** YYYY-MM-DD, approved value from nurse_profiles. */
  gphnExpiryDate: string | null;
}

/**
 * True when the profile still says Tier 2 but the GPHN no longer supports it on `today`
 * (YYYY-MM-DD, Vietnam date). A GPHN that expires today is already invalid today.
 */
export function shouldDemote(facts: TierFacts, today: string): boolean {
  return (
    facts.tier === NurseTier.TIER_2_SPECIALIST &&
    computeTier(facts.gphnNumber, facts.gphnExpiryDate, today) !== NurseTier.TIER_2_SPECIALIST
  );
}

/**
 * Tier 2 on a given service date (YYYY-MM-DD, Vietnam date of the shift start).
 * Use this — not the `tier` column alone — wherever Tier 2 matters for a shift in the
 * future: the daily sweep only runs once a day, so between expiry and the next run the
 * column can still say Tier 2. Phase 2/3 callers: nurse-search (BE-3), matching-radar,
 * job-board accept, bookings.
 */
export function isTier2ValidOn(facts: TierFacts, serviceDate: string): boolean {
  return (
    facts.tier === NurseTier.TIER_2_SPECIALIST &&
    computeTier(facts.gphnNumber, facts.gphnExpiryDate, serviceDate) === NurseTier.TIER_2_SPECIALIST
  );
}

/**
 * First Vietnam date on which invasive shifts must be taken away from a demoted nurse.
 * BR-21 §2.5: shifts whose service date falls on/after the GPHN expiry date. A profile
 * that says Tier 2 without any expiry date is inconsistent data — everything from today.
 */
export function releaseFromDate(gphnExpiryDate: string | null, today: string): string {
  return gphnExpiryDate && gphnExpiryDate < today ? gphnExpiryDate : today;
}
