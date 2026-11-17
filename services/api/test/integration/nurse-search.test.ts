import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { vnDate } from '../../src/modules/availability-engine/availability-engine.policy';
import { findAvailableNurses } from '../../src/modules/availability-engine/availability-engine.service';
import { searchQuerySchema } from '../../src/modules/nurse-search/nurse-search.schema';
import { NurseSearchService } from '../../src/modules/nurse-search/nurse-search.service';
import { createTestPool } from './helpers';

/**
 * nurse-search (BE-3 · Phase 2 · FR-SEARCH-01) trên PostgreSQL 16 thật (migration 0001 → 0009 + seed dịch vụ).
 *  - chỉ hiện điều dưỡng ACTIVE, trong bán kính, không xin đóng tài khoản;
 *  - ký quỹ theo ADR-0004: đủ 300k, HOẶC đang ân hạn (chỉ chuyển khoản, < 3 ca, chưa hết hạn);
 *  - dịch vụ xâm lấn: Tier 2 còn hạn GPHN vào NGÀY CA;
 *  - lịch rảnh do availability-engine quyết → kết quả search = kết quả matching (tiêu chí Phase 2 số 3).
 * Đồng hồ = giờ thật (vì SQL so sánh deposit_grace_expires_at với now() của DB). Ca: 08:00–10:00, 4 ngày tới.
 * Vị trí: một điểm ngẫu nhiên ở vùng Hà Nội, để không lẫn với điều dưỡng do test khác tạo (Bến Thành).
 */
describe('nurse-search (integration)', () => {
  let pool: Pool;
  let svc: NurseSearchService;
  const created: string[] = [];

  const NOW = Date.now();
  const DAY = 86_400_000;
  const SHIFT_DATE = vnDate(NOW + 4 * DAY);
  const vn = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+07:00`);
  const CARE = { lat: 21.0 + Math.random() * 0.5, lng: 105.6 + Math.random() * 0.5 };
  const at = (dLat: number) => ({ lat: CARE.lat + dLat, lng: CARE.lng });
  const NEAR = at(0.009); // ~1 km
  const FAR = at(0.07); // ~7.8 km
  const OUTSIDE = at(0.2); // ~22 km

  async function createNurse(
    pos: { lat: number; lng: number },
    over: {
      tier?: string;
      gphnExpiry?: string;
      status?: string;
      deposit?: number;
      graceDays?: number;
      graceUsed?: number;
      closing?: boolean;
      gender?: string;
      years?: number;
      rating?: number;
      timeOff?: boolean;
    } = {},
  ): Promise<string> {
    const phone = `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;
    const { rows } = await pool.query(
      `INSERT INTO users (phone, full_name, role, status, gender, avatar_url)
       VALUES ($1, 'Điều dưỡng search', 'NURSE', 'ACTIVE', $2::gender_enum, 'https://cdn.test/a.jpg') RETURNING id`,
      [phone, over.gender ?? 'FEMALE'],
    );
    const id: string = rows[0].id;
    created.push(id);
    const tier = over.tier ?? 'TIER_1_BASIC';
    const t2 = tier === 'TIER_2_SPECIALIST';
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, gphn_number, gphn_expiry_date, profile_status, current_lat, current_lng,
                                   years_of_exp, rating_avg, is_retired_medical_staff)
       VALUES ($1, $2::nurse_tier_enum, $3, $4::date, $5::profile_status_enum, $6, $7, $8, $9, TRUE)`,
      [id, tier, t2 ? `G-${id.slice(0, 6)}` : null, t2 ? (over.gphnExpiry ?? '2030-12-31') : null, over.status ?? 'ACTIVE',
        pos.lat, pos.lng, over.years ?? 3, over.rating ?? 4],
    );
    await pool.query(
      `INSERT INTO wallets (user_id, deposit_balance, deposit_grace_expires_at, deposit_grace_shifts_used, closure_requested_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, over.deposit ?? 300_000, over.graceDays === undefined ? null : new Date(NOW + over.graceDays * DAY),
        over.graceUsed ?? 0, over.closing ? new Date(NOW) : null],
    );
    await pool.query(
      `INSERT INTO nurse_availabilities (nurse_id, day_of_week, start_time, end_time, availability_type)
       SELECT $1, d, '00:00', '23:59', 'RECURRING_AVAILABLE' FROM generate_series(0, 6) AS d`,
      [id],
    );
    if (over.timeOff) {
      await pool.query(
        `INSERT INTO nurse_availabilities (nurse_id, specific_date, start_time, end_time, availability_type)
         VALUES ($1, $2::date, '07:00', '11:00', 'TIME_OFF_EXCEPTION')`,
        [id, SHIFT_DATE],
      );
    }
    return id;
  }

  const query = (over: Record<string, unknown> = {}) =>
    searchQuerySchema.parse({
      serviceCode: 'SRV_WOUND_CARE',
      start: vn(SHIFT_DATE, '08:00').toISOString(),
      end: vn(SHIFT_DATE, '10:00').toISOString(),
      lat: String(CARE.lat),
      lng: String(CARE.lng),
      pageSize: '50',
      ...over,
    });
  const ids = async (over: Record<string, unknown> = {}) => (await svc.search(query(over))).items.map((c) => c.nurseId);

  async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
  }

  beforeAll(async () => {
    pool = createTestPool();
    svc = new NurseSearchService({ read: pool, now: () => NOW, signAvatar: async (s) => `signed:${s}` });
  });

  afterAll(async () => {
    if (created.length) {
      await pool.query('DELETE FROM wallets WHERE user_id = ANY($1::uuid[])', [created]);
      await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [created]);
    }
    await pool.end();
    await closePool(); // global pool used by core/config
  });

  it('1 — shows ACTIVE nurses in range as public cards; hides outside radius, not ACTIVE, closing, short deposit', async () => {
    const ok = await createNurse(NEAR, { years: 12, rating: 4.8 });
    const outside = await createNurse(OUTSIDE);
    const pending = await createNurse(NEAR, { status: 'PENDING_VERIFICATION' });
    const closing = await createNurse(NEAR, { closing: true });
    const short = await createNurse(NEAR, { deposit: 100_000 });

    const res = await svc.search(query());
    const card = res.items.find((c) => c.nurseId === ok)!;
    expect(card).toMatchObject({
      fullName: 'Điều dưỡng search',
      avatarUrl: 'signed:https://cdn.test/a.jpg',
      gender: 'FEMALE',
      tier: 'TIER_1_BASIC',
      isRetiredMedicalStaff: true,
      yearsOfExperience: 12,
      ratingAvg: 4.8,
      reviewCount: 0,
      distanceKm: 1,
      cashAllowed: true,
    });
    expect(Object.keys(card).sort()).toEqual(
      ['avatarUrl', 'cashAllowed', 'distanceKm', 'fullName', 'gender', 'isRetiredMedicalStaff', 'nurseId', 'ratingAvg', 'reviewCount', 'tier', 'yearsOfExperience'],
    );
    const found = res.items.map((c) => c.nurseId);
    for (const hidden of [outside, pending, closing, short]) expect(found).not.toContain(hidden);
  });

  it('2 — deposit grace (ADR-0004 D2): transfer only, < 3 shifts, not expired', async () => {
    const graceOk = await createNurse(NEAR, { deposit: 0, graceDays: 20 });
    const graceUsedUp = await createNurse(NEAR, { deposit: 0, graceDays: 20, graceUsed: 3 });
    const graceExpired = await createNurse(NEAR, { deposit: 0, graceDays: -1 });

    const any = await svc.search(query());
    expect(any.items.find((c) => c.nurseId === graceOk)).toMatchObject({ cashAllowed: false });
    expect(await ids({ paymentMethod: 'CASH' })).not.toContain(graceOk);
    expect(await ids({ paymentMethod: 'BANK_TRANSFER' })).toContain(graceOk);

    const all = any.items.map((c) => c.nurseId);
    expect(all).not.toContain(graceUsedUp);
    expect(all).not.toContain(graceExpired);
  });

  it('3 — invasive service: Tier 2 with GPHN valid on the shift date only', async () => {
    const t1 = await createNurse(NEAR);
    const t2 = await createNurse(NEAR, { tier: 'TIER_2_SPECIALIST' });
    // GPHN still valid today, but its expiry date is the shift date → not valid for that shift
    const expiring = await createNurse(NEAR, { tier: 'TIER_2_SPECIALIST', gphnExpiry: SHIFT_DATE });

    const found = await ids({ serviceCode: 'SRV_IV_INFUSION' });
    expect(found).toContain(t2);
    expect(found).not.toContain(t1);
    expect(found).not.toContain(expiring);

    // Basic service: the expiring nurse is shown, as Tier 1 for that date; tier filter follows that.
    expect(await ids({ tier: 'TIER_2_SPECIALIST' })).not.toContain(expiring);
    expect(await ids({ tier: 'TIER_1_BASIC' })).toContain(expiring);
  });

  it('4 — availability comes from availability-engine: same answer as matching (Phase 2 exit criterion 3)', async () => {
    const free = await createNurse(NEAR);
    const off = await createNurse(NEAR, { timeOff: true });

    const found = await ids();
    expect(found).toContain(free);
    expect(found).not.toContain(off);

    const slot = { start: vn(SHIFT_DATE, '08:00'), end: vn(SHIFT_DATE, '10:00') };
    const engine = await findAvailableNurses(pool, { nurseIds: [free, off], ...slot });
    expect(engine).toEqual([free]);
  });

  it('5 — gender filter, radius, sort and paging', async () => {
    const male = await createNurse(NEAR, { gender: 'MALE' });
    const far = await createNurse(FAR, { rating: 5, years: 30 });
    const near = await createNurse(NEAR, { rating: 3, years: 1 });

    const males = await ids({ gender: 'MALE' });
    expect(males).toContain(male);
    expect(males).not.toContain(near);

    expect(await ids({ radiusKm: '5' })).not.toContain(far);
    expect(await ids({ radiusKm: '500' })).not.toContain(await createNurse(OUTSIDE)); // capped at RADAR_EXPANDED_RADIUS_KM

    const byDistance = await ids();
    expect(byDistance.indexOf(near)).toBeLessThan(byDistance.indexOf(far));
    const byRating = await ids({ sort: 'rating' });
    expect(byRating.indexOf(far)).toBeLessThan(byRating.indexOf(near));

    const p1 = await svc.search(query({ pageSize: '1', page: '1' }));
    const p2 = await svc.search(query({ pageSize: '1', page: '2' }));
    expect(p1.items).toHaveLength(1);
    expect(p1.total).toBeGreaterThanOrEqual(2);
    expect(p1.items[0].nurseId).not.toBe(p2.items[0].nurseId);
  });

  it('6 — refused requests: prohibited / unknown service, shift in the past', async () => {
    await rejectsWith(svc.search(query({ serviceCode: 'SRV_BLOOD_TRANSFUSION' })), 400, 'SERVICE_NOT_BOOKABLE');
    await rejectsWith(svc.search(query({ serviceCode: 'NOPE' })), 400, 'SERVICE_NOT_BOOKABLE');
    const past = vnDate(NOW - 2 * DAY);
    await rejectsWith(
      svc.search(query({ start: vn(past, '08:00').toISOString(), end: vn(past, '10:00').toISOString() })),
      400,
      'INVALID_SLOT',
    );
  });

  it('7 — profile: visible nurse → card + reviews; closing / unknown → 404 NURSE_NOT_FOUND', async () => {
    const ok = await createNurse(NEAR, { years: 7 });
    const closing = await createNurse(NEAR, { closing: true });

    const p = await svc.getProfile(ok);
    expect(p).toMatchObject({ nurseId: ok, yearsOfExperience: 7, reviewCount: 0, reviews: [] });
    await rejectsWith(svc.getProfile(closing), 404, 'NURSE_NOT_FOUND');
    await rejectsWith(svc.getProfile('00000000-0000-4000-8000-000000000000'), 404, 'NURSE_NOT_FOUND');
  });
});
