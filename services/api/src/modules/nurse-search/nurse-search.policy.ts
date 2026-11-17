/**
 * nurse-search policy — PURE rules (no DB, no clock). BE-3 · Phase 2 · FR-SEARCH-01.
 *
 * Search must give the same answer as matching (Phase 2 exit criterion 3), so the gate is NOT re-written here:
 * it calls matching-radar's eligibilityBlocker / depositAllows / distanceKm and tier-lifecycle's isTier2ValidOn.
 * This file only adds what is specific to search: the optional filters, the card, sorting and paging.
 */
import { NurseTier, PaymentMethod } from '@healthcare-system/shared';
import { vnDate } from '../availability-engine/availability-engine.policy';
import { depositAllows, distanceKm, eligibilityBlocker } from '../matching-radar/matching-radar.policy';
import type { DepositRule } from '../matching-radar/matching-radar.types';
import { isTier2ValidOn } from '../tier-lifecycle/tier-lifecycle.policy';
import type { NurseCardDto, NurseSearchRow, SearchServiceRow, SearchSort } from './nurse-search.types';

export interface SearchFilters {
  care: { lat: number; lng: number };
  radiusKm: number;
  start: Date;
  tier?: NurseTier;
  paymentMethod?: PaymentMethod;
}

/** Tier that counts on the shift date: Tier 2 only while the GPHN is still valid that day. */
export function effectiveTier(row: NurseSearchRow, shiftStart: Date): NurseTier {
  return isTier2ValidOn(
    { tier: row.tier, gphnNumber: row.gphn_number, gphnExpiryDate: row.gphn_expiry_date },
    vnDate(shiftStart.getTime()),
  )
    ? NurseTier.TIER_2_SPECIALIST
    : NurseTier.TIER_1_BASIC;
}

/**
 * The card for one candidate, or null when she must not be shown.
 *
 * Deposit (ADR-0004 D2): when the patient has not chosen a payment method yet, the most permissive one
 * (BANK_TRANSFER) is used for the gate, and `cashAllowed` tells the client whether cash would also work.
 * When the patient did choose, the gate uses exactly that method — same call as matching makes at claim time.
 */
export function toCard(
  row: NurseSearchRow,
  service: Pick<SearchServiceRow, 'is_invasive' | 'required_tier'>,
  f: SearchFilters,
  rule: DepositRule,
  nowMs: number,
): NurseCardDto | null {
  const km = distanceKm(row, f.care);
  if (km === null || km > f.radiusKm) return null;

  const gateMethod = f.paymentMethod ?? PaymentMethod.BANK_TRANSFER;
  const blocker = eligibilityBlocker(
    row,
    { is_invasive: service.is_invasive, required_tier: service.required_tier, payment_method: gateMethod },
    f.start,
    rule,
    nowMs,
  );
  if (blocker !== null) return null;

  const tier = effectiveTier(row, f.start);
  if (f.tier && f.tier !== tier) return null;

  return {
    nurseId: row.user_id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    gender: row.gender,
    tier,
    isRetiredMedicalStaff: row.is_retired_medical_staff,
    yearsOfExperience: Number(row.years_of_exp),
    ratingAvg: Number(row.rating_avg),
    reviewCount: Number(row.review_count),
    distanceKm: Math.round(km * 10) / 10,
    cashAllowed: depositAllows(row, PaymentMethod.CASH, rule, nowMs),
  };
}

/** Stable order: the chosen key, then rating, then distance, then id (so paging never repeats or skips). */
export function sortCards(cards: NurseCardDto[], sort: SearchSort): NurseCardDto[] {
  const byId = (a: NurseCardDto, b: NurseCardDto) => (a.nurseId < b.nurseId ? -1 : a.nurseId > b.nurseId ? 1 : 0);
  const keys: Record<SearchSort, (a: NurseCardDto, b: NurseCardDto) => number> = {
    distance: (a, b) => a.distanceKm - b.distanceKm || b.ratingAvg - a.ratingAvg,
    rating: (a, b) => b.ratingAvg - a.ratingAvg || b.reviewCount - a.reviewCount || a.distanceKm - b.distanceKm,
    experience: (a, b) => b.yearsOfExperience - a.yearsOfExperience || b.ratingAvg - a.ratingAvg || a.distanceKm - b.distanceKm,
  };
  return [...cards].sort((a, b) => keys[sort](a, b) || byId(a, b));
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  return items.slice((page - 1) * pageSize, page * pageSize);
}

/** A service can be searched for only if it is active and not prohibited (BR: prohibited services are never bookable). */
export function serviceSearchable(s: Pick<SearchServiceRow, 'is_active' | 'is_prohibited'>): boolean {
  return s.is_active && !s.is_prohibited;
}
