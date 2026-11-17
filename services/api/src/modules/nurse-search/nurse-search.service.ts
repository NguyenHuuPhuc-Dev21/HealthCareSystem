/**
 * nurse-search — patients find and view nurses before booking. BE-3 · Phase 2 · FR-SEARCH-01.
 * Contract: docs/api/nurse-search.api.md
 *
 * Pipeline of GET /nurses/search:
 *   1. service must exist, be active and not prohibited          (400 SERVICE_NOT_BOOKABLE)
 *   2. SQL pre-filter inside the bounding box                    (nurse-search.repo)
 *   3. exact gate per nurse: distance, ACTIVE, closure, Tier on the shift date, deposit / grace
 *      — the SAME functions matching uses                         (matching-radar.policy via nurse-search.policy)
 *   4. free for the whole slot incl. the 60-min travel buffer      (availability-engine.findAvailableNurses)
 *   5. sort, page, sign avatar links (10 min)
 * Search is a filter, not a promise: the gate is checked again when the booking is claimed.
 */
import { query, type Queryable } from '../../core/database';
import { getConfigNumber } from '../../core/config';
import { badRequest, notFound } from '../../core/errors';
import { createDownloadUrl, isValidObjectKey } from '../../core/storage';
import type { SystemConfigKey } from '@healthcare-system/shared';
import { MAX_NURSES_PER_CALL, MAX_SLOT_HOURS, findAvailableNurses } from '../availability-engine/availability-engine.service';
import { boundingBox } from '../matching-radar/matching-radar.policy';
import type { DepositRule } from '../matching-radar/matching-radar.types';
import { effectiveTier, paginate, serviceSearchable, sortCards, toCard } from './nurse-search.policy';
import * as repo from './nurse-search.repo';
import type { SearchQuery } from './nurse-search.schema';
import type { NurseCardDto, NurseProfileDto, NurseSearchResult } from './nurse-search.types';

/** How many reviews the profile page shows. */
export const PROFILE_REVIEW_LIMIT = 20;

export interface NurseSearchDeps {
  read: Queryable;
  now?: () => number;
  /** system_configs reader (injected in tests). */
  configNumber?: (key: SystemConfigKey) => Promise<number>;
  /** Turns the stored avatar value into a link the browser can open; null if none. */
  signAvatar?: (stored: string) => Promise<string | null>;
}

/** Avatar stored as a private object key → 10-minute presigned GET; an https URL is passed through. */
export async function defaultSignAvatar(stored: string): Promise<string | null> {
  if (isValidObjectKey(stored)) {
    try {
      return (await createDownloadUrl(stored)).url;
    } catch {
      return null; // a broken avatar must never break search
    }
  }
  return /^https:\/\//i.test(stored) ? stored : null;
}

export class NurseSearchService {
  constructor(private readonly deps: NurseSearchDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private cfg(key: SystemConfigKey): Promise<number> {
    return (this.deps.configNumber ?? getConfigNumber)(key);
  }

  private async avatar(stored: string | null): Promise<string | null> {
    if (!stored) return null;
    return (this.deps.signAvatar ?? defaultSignAvatar)(stored);
  }

  async search(q: SearchQuery): Promise<NurseSearchResult> {
    const nowMs = this.nowMs();
    if (q.start.getTime() <= nowMs) throw badRequest('INVALID_SLOT', 'The shift must start in the future');
    if (q.end.getTime() - q.start.getTime() > MAX_SLOT_HOURS * 3_600_000) {
      throw badRequest('INVALID_SLOT', `A slot cannot be longer than ${MAX_SLOT_HOURS} hours`);
    }

    const service = await repo.getServiceByCode(this.deps.read, q.serviceCode);
    if (!service || !serviceSearchable(service)) {
      throw badRequest('SERVICE_NOT_BOOKABLE', 'This service does not exist or cannot be booked');
    }

    const [minDeposit, graceMaxShifts, maxRadiusKm] = await Promise.all([
      this.cfg('MIN_NURSE_DEPOSIT'),
      this.cfg('DEPOSIT_GRACE_MAX_SHIFTS'),
      this.cfg('RADAR_EXPANDED_RADIUS_KM'),
    ]);
    const rule: DepositRule = { minDeposit, graceMaxShifts };
    const radiusKm = Math.min(q.radiusKm ?? maxRadiusKm, maxRadiusKm);
    const care = { lat: q.lat, lng: q.lng };

    const rows = await repo.findSearchCandidates(this.deps.read, {
      box: boundingBox(care.lat, care.lng, radiusKm),
      care,
      minDeposit,
      gender: q.gender,
      limit: MAX_NURSES_PER_CALL,
    });

    const filters = { care, radiusKm, start: q.start, tier: q.tier, paymentMethod: q.paymentMethod };
    const cards = new Map<string, NurseCardDto>();
    for (const row of rows) {
      const card = toCard(row, service, filters, rule, nowMs);
      if (card) cards.set(card.nurseId, card);
    }

    const free = await findAvailableNurses(this.deps.read, { nurseIds: [...cards.keys()], start: q.start, end: q.end });
    const sorted = sortCards(
      free.map((id) => cards.get(id)!),
      q.sort,
    );
    const page = paginate(sorted, q.page, q.pageSize);
    const items = await Promise.all(page.map(async (c) => ({ ...c, avatarUrl: await this.avatar(c.avatarUrl) })));
    return { items, page: q.page, pageSize: q.pageSize, total: sorted.length };
  }

  /** Public profile of one nurse (card fields + newest verified reviews). No slot check here. */
  async getProfile(nurseId: string): Promise<NurseProfileDto> {
    const row = await repo.getPublicNurse(this.deps.read, nurseId);
    if (!row) throw notFound('NURSE_NOT_FOUND', 'Nurse not found');
    const reviews = await repo.listVisibleReviews(this.deps.read, nurseId, PROFILE_REVIEW_LIMIT);
    return {
      nurseId: row.user_id,
      fullName: row.full_name,
      avatarUrl: await this.avatar(row.avatar_url),
      gender: row.gender,
      tier: effectiveTier(row, new Date(this.nowMs())),
      isRetiredMedicalStaff: row.is_retired_medical_staff,
      yearsOfExperience: Number(row.years_of_exp),
      ratingAvg: Number(row.rating_avg),
      reviewCount: Number(row.review_count),
      reviews: reviews.map((r) => ({ rating: Number(r.rating), comment: r.comment, createdAt: new Date(r.created_at).toISOString() })),
    };
  }
}

let singleton: NurseSearchService | null = null;

export function getNurseSearchService(): NurseSearchService {
  if (!singleton) singleton = new NurseSearchService({ read: { query } });
  return singleton;
}
