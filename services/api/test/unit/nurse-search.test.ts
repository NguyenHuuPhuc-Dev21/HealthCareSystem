import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { NurseTier, PaymentMethod, ProfileStatus } from '@healthcare-system/shared';
import { errorHandler, setTokenVerifier } from '../../src/core/middleware';
import { defaultSignAvatar } from '../../src/modules/nurse-search/nurse-search.service';
import { effectiveTier, paginate, serviceSearchable, sortCards, toCard } from '../../src/modules/nurse-search/nurse-search.policy';
import { createNurseSearchRouter } from '../../src/modules/nurse-search/nurse-search.routes';
import { searchQuerySchema } from '../../src/modules/nurse-search/nurse-search.schema';
import type { NurseSearchService } from '../../src/modules/nurse-search/nurse-search.service';
import type { NurseCardDto, NurseSearchRow } from '../../src/modules/nurse-search/nurse-search.types';

/**
 * nurse-search — FR-SEARCH-01 (BE-3 · Phase 2). Pure policy + schema + route wiring.
 * "Bây giờ" = Thứ 2 2026-11-16 09:00 giờ VN. Ca tìm kiếm: Thứ 6 2026-11-20 08:00–10:00.
 */
const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
const NOW = vn('2026-11-16', '09:00').getTime();
const START = vn('2026-11-20', '08:00');
const DAY = 86_400_000;
const RULE = { minDeposit: 300_000, graceMaxShifts: 3 };
const CARE = { lat: 10.7769, lng: 106.7009 };
const NEAR = { current_lat: CARE.lat + 0.009, current_lng: CARE.lng }; // ~1 km
const BASIC = { is_invasive: false, required_tier: NurseTier.TIER_1_BASIC };
const INVASIVE = { is_invasive: true, required_tier: NurseTier.TIER_2_SPECIALIST };
const F = { care: CARE, radiusKm: 10, start: START };

function nurse(over: Partial<NurseSearchRow> = {}): NurseSearchRow {
  return {
    user_id: '00000000-0000-4000-8000-000000000001',
    user_status: 'ACTIVE',
    profile_status: ProfileStatus.ACTIVE,
    tier: NurseTier.TIER_1_BASIC,
    gphn_number: null,
    gphn_expiry_date: null,
    ...NEAR,
    deposit_balance: '300000',
    deposit_grace_expires_at: null,
    deposit_grace_shifts_used: 0,
    held_transfer_shifts: '0',
    closure_requested_at: null,
    full_name: 'Nguyễn Thị A',
    avatar_url: null,
    gender: null,
    years_of_exp: 5,
    is_retired_medical_staff: false,
    rating_avg: '4.50',
    review_count: '3',
    ...over,
  };
}
const tier2 = (expiry: string) => ({ tier: NurseTier.TIER_2_SPECIALIST, gphn_number: 'G-1', gphn_expiry_date: expiry });
const grace = (over: Partial<NurseSearchRow> = {}) =>
  nurse({ deposit_balance: '0', deposit_grace_expires_at: new Date(NOW + 10 * DAY), ...over });

describe('nurse-search policy — toCard (same gate as matching)', () => {
  it('builds the public card, rounded distance, numbers parsed; no private fields', () => {
    const card = toCard(nurse(), BASIC, F, RULE, NOW)!;
    expect(card).toEqual({
      nurseId: '00000000-0000-4000-8000-000000000001',
      fullName: 'Nguyễn Thị A',
      avatarUrl: null,
      gender: null,
      tier: NurseTier.TIER_1_BASIC,
      isRetiredMedicalStaff: false,
      yearsOfExperience: 5,
      ratingAvg: 4.5,
      reviewCount: 3,
      distanceKm: 1,
      cashAllowed: true,
    });
    expect(Object.keys(card)).not.toContain('trustScore');
  });

  it('distance: outside the radius or unknown position → hidden', () => {
    expect(toCard(nurse({ current_lat: CARE.lat + 0.2 }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(nurse({ current_lat: null, current_lng: null }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(nurse({ current_lat: CARE.lat + 0.07 }), BASIC, { ...F, radiusKm: 5 }, RULE, NOW)).toBeNull();
  });

  it('not ACTIVE (profile or user) or closing the account → hidden', () => {
    expect(toCard(nurse({ profile_status: ProfileStatus.SUSPENDED }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(nurse({ user_status: 'SUSPENDED' }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(nurse({ closure_requested_at: new Date(NOW) }), BASIC, F, RULE, NOW)).toBeNull();
  });

  it('deposit: full → any method; short with no grace → hidden', () => {
    expect(toCard(nurse(), BASIC, { ...F, paymentMethod: PaymentMethod.CASH }, RULE, NOW)).not.toBeNull();
    expect(toCard(nurse({ deposit_balance: '299999' }), BASIC, F, RULE, NOW)).toBeNull();
  });

  it('grace (ADR-0004 D2): no method → shown with cashAllowed=false; CASH → hidden; BANK_TRANSFER → shown', () => {
    expect(toCard(grace(), BASIC, F, RULE, NOW)).toMatchObject({ cashAllowed: false });
    expect(toCard(grace(), BASIC, { ...F, paymentMethod: PaymentMethod.CASH }, RULE, NOW)).toBeNull();
    expect(toCard(grace(), BASIC, { ...F, paymentMethod: PaymentMethod.BANK_TRANSFER }, RULE, NOW)).not.toBeNull();
  });

  it('grace ends: expired, or completed + held transfer shifts reach the cap → hidden', () => {
    expect(toCard(grace({ deposit_grace_expires_at: new Date(NOW - 1) }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(grace({ deposit_grace_shifts_used: 3 }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(grace({ deposit_grace_shifts_used: 2, held_transfer_shifts: '1' }), BASIC, F, RULE, NOW)).toBeNull();
    expect(toCard(grace({ deposit_grace_shifts_used: 2 }), BASIC, F, RULE, NOW)).not.toBeNull();
  });

  it('invasive service: Tier 1 hidden; Tier 2 shown only if GPHN still valid ON THE SHIFT DATE', () => {
    expect(toCard(nurse(), INVASIVE, F, RULE, NOW)).toBeNull();
    expect(toCard(nurse(tier2('2028-12-31')), INVASIVE, F, RULE, NOW)).toMatchObject({ tier: NurseTier.TIER_2_SPECIALIST });
    // GPHN valid today (16/11) but expires 19/11 (an expiry date is already invalid that day), before the 20/11 shift
    expect(toCard(nurse(tier2('2026-11-19')), INVASIVE, F, RULE, NOW)).toBeNull();
  });

  it('tier filter uses the tier valid on the shift date', () => {
    const t2 = nurse(tier2('2028-12-31'));
    const expiring = nurse(tier2('2026-11-19'));
    expect(toCard(t2, BASIC, { ...F, tier: NurseTier.TIER_2_SPECIALIST }, RULE, NOW)).not.toBeNull();
    expect(toCard(t2, BASIC, { ...F, tier: NurseTier.TIER_1_BASIC }, RULE, NOW)).toBeNull();
    expect(toCard(expiring, BASIC, { ...F, tier: NurseTier.TIER_2_SPECIALIST }, RULE, NOW)).toBeNull();
    expect(toCard(expiring, BASIC, { ...F, tier: NurseTier.TIER_1_BASIC }, RULE, NOW)).toMatchObject({ tier: NurseTier.TIER_1_BASIC });
    expect(effectiveTier(expiring, vn('2026-11-18', '23:00'))).toBe(NurseTier.TIER_2_SPECIALIST);
  });
});

describe('nurse-search policy — sort, page, service', () => {
  const c = (id: string, distanceKm: number, ratingAvg: number, yearsOfExperience: number) =>
    ({ nurseId: id, distanceKm, ratingAvg, yearsOfExperience, reviewCount: 0 }) as NurseCardDto;
  const cards = [c('b', 2, 4.0, 10), c('a', 2, 4.0, 1), c('c', 1, 3.0, 5), c('d', 5, 5.0, 2)];

  it('distance (default) / rating / experience, ties broken by id (stable paging)', () => {
    expect(sortCards(cards, 'distance').map((x) => x.nurseId)).toEqual(['c', 'a', 'b', 'd']);
    expect(sortCards(cards, 'rating').map((x) => x.nurseId)).toEqual(['d', 'a', 'b', 'c']);
    expect(sortCards(cards, 'experience').map((x) => x.nurseId)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('paginate', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(paginate([1, 2, 3], 3, 2)).toEqual([]);
  });

  it('prohibited or inactive services cannot be searched', () => {
    expect(serviceSearchable({ is_active: true, is_prohibited: false })).toBe(true);
    expect(serviceSearchable({ is_active: true, is_prohibited: true })).toBe(false);
    expect(serviceSearchable({ is_active: false, is_prohibited: false })).toBe(false);
  });
});

describe('nurse-search schema', () => {
  const base = {
    serviceCode: 'SRV_WOUND_CARE',
    start: '2026-11-20T08:00:00+07:00',
    end: '2026-11-20T10:00:00+07:00',
    lat: '10.7769',
    lng: '106.7009',
  };

  it('coerces query strings and applies defaults', () => {
    const q = searchQuerySchema.parse(base);
    expect(q).toMatchObject({ lat: 10.7769, lng: 106.7009, sort: 'distance', page: 1, pageSize: 20 });
    expect(q.start.toISOString()).toBe('2026-11-20T01:00:00.000Z');
  });

  it('rejects: end before start, no timezone, unknown params, page size > 50, bad enum', () => {
    expect(searchQuerySchema.safeParse({ ...base, end: base.start }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ ...base, start: '2026-11-20T08:00:00' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ ...base, trustScore: '90' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ ...base, pageSize: '51' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ ...base, paymentMethod: 'MOMO' }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ ...base, lat: '91' }).success).toBe(false);
  });
});

describe('nurse-search avatar link', () => {
  it('https URL passes through; anything else that is not an object key → null', async () => {
    expect(await defaultSignAvatar('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(await defaultSignAvatar('http://insecure/a.jpg')).toBeNull();
    expect(await defaultSignAvatar('../../etc/passwd')).toBeNull();
  });
});

describe('nurse-search routes', () => {
  const PATIENT = '00000000-0000-4000-8000-0000000000aa';
  const calls: unknown[] = [];
  const fake = {
    search: async (q: unknown) => {
      calls.push(q);
      return { items: [], page: 1, pageSize: 20, total: 0 };
    },
    getProfile: async (id: string) => ({ nurseId: id }),
  } as unknown as NurseSearchService;

  const app = express();
  app.use(createNurseSearchRouter(fake));
  app.use(errorHandler);
  setTokenVerifier(async (t) =>
    t === 'patient' ? { id: PATIENT, role: 'PATIENT' as never } : t === 'nurse' ? { id: PATIENT, role: 'NURSE' as never } : null,
  );
  const qs = 'serviceCode=SRV_WOUND_CARE&start=2026-11-20T08:00:00%2B07:00&end=2026-11-20T10:00:00%2B07:00&lat=10.7&lng=106.7';

  it('PATIENT only: 401 without token, 403 for a nurse', async () => {
    expect((await request(app).get(`/nurses/search?${qs}`)).status).toBe(401);
    expect((await request(app).get(`/nurses/search?${qs}`).set('Authorization', 'Bearer nurse')).status).toBe(403);
  });

  it('valid query → 200 envelope; invalid → 400 VALIDATION_ERROR', async () => {
    const ok = await request(app).get(`/nurses/search?${qs}`).set('Authorization', 'Bearer patient');
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ success: true, data: { items: [], page: 1, pageSize: 20, total: 0 } });
    const bad = await request(app).get('/nurses/search?lat=1').set('Authorization', 'Bearer patient');
    expect([bad.status, bad.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('/nurses/search is not swallowed by /nurses/:nurseId; non-UUID id → 400', async () => {
    calls.length = 0;
    await request(app).get(`/nurses/search?${qs}`).set('Authorization', 'Bearer patient');
    expect(calls).toHaveLength(1);
    const bad = await request(app).get('/nurses/abc').set('Authorization', 'Bearer patient');
    expect(bad.status).toBe(400);
    const id = '00000000-0000-4000-8000-000000000001';
    const one = await request(app).get(`/nurses/${id}`).set('Authorization', 'Bearer patient');
    expect(one.body).toEqual({ success: true, data: { nurseId: id } });
  });
});
