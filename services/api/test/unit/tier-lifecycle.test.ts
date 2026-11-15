import { describe, expect, it } from 'vitest';
import { AuditAction, MatchingMode, NurseTier, ProfileStatus } from '@healthcare-system/shared';
import { isTier2ValidOn, releaseFromDate, shouldDemote } from '../../src/modules/tier-lifecycle/tier-lifecycle.policy';
import { runGphnExpirySweep, vietnamDate, registerTierLifecycleJobs } from '../../src/modules/tier-lifecycle/tier-lifecycle.jobs';
import {
  GPHN_EXPIRY_SWEEP_JOB,
  REDISPATCH_JOB,
  type RedispatchPayload,
  type TierNotice,
} from '../../src/modules/tier-lifecycle/tier-lifecycle.types';

/**
 * tier-lifecycle — FR-AUTH-02 §2, BR-21 §2.5 (RTM TC-AUTH-02).
 * Policy = pure. The sweep runs against an in-memory fake of the four SQL statements it issues,
 * with a fake clock (test strategy: time is a test variable, never a real sleep).
 */

const T2 = NurseTier.TIER_2_SPECIALIST;
const T1 = NurseTier.TIER_1_BASIC;
// 2026-11-05 00:05 in Vietnam = 2026-11-04 17:05Z
const NOW = Date.parse('2026-11-04T17:05:00Z');
const TODAY = '2026-11-05';
const HOUR = 3_600_000;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('policy', () => {
  it('vietnamDate uses Asia/Ho_Chi_Minh, not UTC', () => {
    expect(vietnamDate(NOW)).toBe(TODAY);
  });

  it('shouldDemote: Tier 2 with GPHN expiring today or earlier', () => {
    const f = (gphnExpiryDate: string | null, tier = T2, gphnNumber: string | null = 'G-1') => ({ tier, gphnNumber, gphnExpiryDate });
    expect(shouldDemote(f('2026-11-04'), TODAY)).toBe(true); // expired yesterday
    expect(shouldDemote(f(TODAY), TODAY)).toBe(true); // expires today = invalid today (same rule as computeTier)
    expect(shouldDemote(f('2026-11-06'), TODAY)).toBe(false); // still valid
    expect(shouldDemote(f(null), TODAY)).toBe(true); // Tier 2 without expiry = inconsistent → demote
    expect(shouldDemote(f('2031-01-01', T2, null), TODAY)).toBe(true); // no GPHN number
    expect(shouldDemote(f('2020-01-01', T1), TODAY)).toBe(false); // already Tier 1
  });

  it('isTier2ValidOn: judged on the SERVICE date, not on the tier column alone', () => {
    const nurse = { tier: T2, gphnNumber: 'G-1', gphnExpiryDate: '2026-11-10' };
    expect(isTier2ValidOn(nurse, '2026-11-09')).toBe(true);
    expect(isTier2ValidOn(nurse, '2026-11-10')).toBe(false); // shift on the expiry day
    expect(isTier2ValidOn(nurse, '2026-12-01')).toBe(false);
    expect(isTier2ValidOn({ ...nurse, tier: T1 }, '2026-11-09')).toBe(false);
  });

  it('releaseFromDate: the expiry date, or today when expiry is missing / today', () => {
    expect(releaseFromDate('2026-11-01', TODAY)).toBe('2026-11-01');
    expect(releaseFromDate(TODAY, TODAY)).toBe(TODAY);
    expect(releaseFromDate(null, TODAY)).toBe(TODAY);
  });
});

// ---------------------------------------------------------------------------
// In-memory fake of the SQL the sweep runs
// ---------------------------------------------------------------------------

interface FakeNurse {
  tier: NurseTier;
  gphn_number: string | null;
  gphn_expiry_date: string | null;
  profile_status: ProfileStatus;
}
interface FakeBooking {
  id: string;
  booking_code: string;
  customer_id: string;
  nurse_id: string | null;
  execution_status: string;
  needsTier2: boolean;
  start_time: Date;
  matching_mode: MatchingMode;
}

class FakeDb {
  nurses = new Map<string, FakeNurse>();
  bookings: FakeBooking[] = [];
  audits: { action: string; targetId: string; oldValue: any; newValue: any; actorId: string | null }[] = [];
  /** Nurse ids whose lock should throw (simulates a DB error for one nurse). */
  failOn = new Set<string>();
  /** Hook run when a nurse is locked (simulates a concurrent renewal approval). */
  onLock?: (nurseId: string) => void;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    if (sql.includes('SELECT user_id') && sql.includes('FROM nurse_profiles')) {
      const [today, limit, afterId] = params;
      const ids = [...this.nurses.entries()]
        .filter(([, n]) => n.tier === T2 && (!n.gphn_number || !n.gphn_expiry_date || n.gphn_expiry_date <= today))
        .map(([k]) => k)
        .filter((k) => afterId === null || k > afterId)
        .sort()
        .slice(0, limit);
      return { rows: ids.map((user_id) => ({ user_id })), rowCount: ids.length };
    }
    if (sql.includes('FROM nurse_profiles') && sql.includes('FOR UPDATE')) {
      const [nurseId] = params;
      if (this.failOn.has(nurseId)) throw new Error('simulated DB failure');
      this.onLock?.(nurseId);
      const n = this.nurses.get(nurseId);
      return { rows: n ? [{ ...n }] : [], rowCount: n ? 1 : 0 };
    }
    if (sql.includes('UPDATE nurse_profiles')) {
      const n = this.nurses.get(params[0]);
      if (!n || n.tier !== T2) return { rows: [], rowCount: 0 };
      n.tier = T1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('UPDATE bookings')) {
      const [nurseId, fromDate, now] = params as [string, string, Date];
      const released = this.bookings.filter(
        (b) =>
          b.nurse_id === nurseId &&
          b.execution_status === 'CONFIRMED' &&
          b.needsTier2 &&
          b.start_time.getTime() > now.getTime() &&
          vietnamDate(b.start_time.getTime()) >= fromDate,
      );
      for (const b of released) {
        b.nurse_id = null;
        b.execution_status = 'MATCHING';
      }
      return {
        rows: released.map(({ id, booking_code, customer_id, matching_mode, start_time }) => ({
          id,
          booking_code,
          customer_id,
          matching_mode,
          start_time,
        })),
        rowCount: released.length,
      };
    }
    if (sql.includes('INSERT INTO audit_logs')) {
      const [actorId, action, , targetId, oldValue, newValue] = params;
      this.audits.push({ actorId, action, targetId, oldValue: JSON.parse(oldValue), newValue: JSON.parse(newValue) });
      return { rows: [{ id: id(999), created_at: new Date(NOW) }], rowCount: 1 };
    }
    throw new Error(`FakeDb: unexpected SQL ${sql}`);
  }
}

class FakeScheduler {
  jobs: { jobName: string; payload: RedispatchPayload; runAt: Date; key: string }[] = [];
  fail = false;
  async scheduleJob<T>(jobName: string, payload: T, runAt: Date, key: string) {
    if (this.fail) throw new Error('redis down');
    if (this.jobs.some((j) => j.key === key)) return { created: false };
    this.jobs.push({ jobName, payload: payload as RedispatchPayload, runAt, key });
    return { created: true };
  }
}

function setup() {
  const db = new FakeDb();
  const scheduler = new FakeScheduler();
  const notices: TierNotice[] = [];
  const deps = {
    // Fake "transaction": runs on the same fake db (rollback is not what these tests are about).
    withTx: <T>(fn: (c: any) => Promise<T>) => fn(db),
    read: db as any,
    scheduler,
    notify: async (n: TierNotice) => {
      notices.push(n);
    },
    now: () => NOW,
    log: () => undefined,
  };
  return { db, scheduler, notices, deps };
}

const NURSE_EXPIRED = id(1);
const NURSE_VALID = id(2);
const CUSTOMER = id(50);

function seed(db: FakeDb) {
  db.nurses.set(NURSE_EXPIRED, { tier: T2, gphn_number: 'G-1', gphn_expiry_date: '2026-11-03', profile_status: ProfileStatus.ACTIVE });
  db.nurses.set(NURSE_VALID, { tier: T2, gphn_number: 'G-2', gphn_expiry_date: '2030-01-01', profile_status: ProfileStatus.ACTIVE });
  const base = { customer_id: CUSTOMER, matching_mode: MatchingMode.JOB_BOARD };
  db.bookings.push(
    // future invasive CONFIRMED → released
    { ...base, id: id(10), booking_code: 'BK-10', nurse_id: NURSE_EXPIRED, execution_status: 'CONFIRMED', needsTier2: true, start_time: new Date(NOW + 30 * HOUR) },
    // future NON-invasive → kept (Tier 1 may do it)
    { ...base, id: id(11), booking_code: 'BK-11', nurse_id: NURSE_EXPIRED, execution_status: 'CONFIRMED', needsTier2: false, start_time: new Date(NOW + 30 * HOUR) },
    // invasive already IN_PROGRESS → kept
    { ...base, id: id(12), booking_code: 'BK-12', nurse_id: NURSE_EXPIRED, execution_status: 'IN_PROGRESS', needsTier2: true, start_time: new Date(NOW - HOUR) },
    // invasive of the VALID nurse → kept
    { ...base, id: id(13), booking_code: 'BK-13', nurse_id: NURSE_VALID, execution_status: 'CONFIRMED', needsTier2: true, start_time: new Date(NOW + 30 * HOUR) },
  );
}

describe('runGphnExpirySweep', () => {
  it('demotes the expired nurse to Tier 1, keeps ACTIVE, releases only future invasive CONFIRMED shifts', async () => {
    const { db, scheduler, deps } = setup();
    seed(db);

    const r = await runGphnExpirySweep(deps);

    expect(r).toEqual({ demoted: 1, skipped: 0, releasedBookings: 1, failed: 0 });
    expect(db.nurses.get(NURSE_EXPIRED)).toMatchObject({ tier: T1, profile_status: ProfileStatus.ACTIVE });
    expect(db.nurses.get(NURSE_VALID)!.tier).toBe(T2);

    const byId = Object.fromEntries(db.bookings.map((b) => [b.id, b]));
    expect(byId[id(10)]).toMatchObject({ nurse_id: null, execution_status: 'MATCHING' });
    expect(byId[id(11)]).toMatchObject({ nurse_id: NURSE_EXPIRED, execution_status: 'CONFIRMED' });
    expect(byId[id(12)]).toMatchObject({ nurse_id: NURSE_EXPIRED, execution_status: 'IN_PROGRESS' });
    expect(byId[id(13)]).toMatchObject({ nurse_id: NURSE_VALID, execution_status: 'CONFIRMED' });

    // re-dispatch handed to the matcher, keyed per booking + nurse
    expect(scheduler.jobs).toEqual([
      {
        jobName: REDISPATCH_JOB,
        payload: { bookingId: id(10), reason: 'NURSE_TIER_DEMOTED', releasedNurseId: NURSE_EXPIRED, matchingMode: MatchingMode.JOB_BOARD },
        runAt: new Date(NOW),
        key: `redispatch:${id(10)}:${NURSE_EXPIRED}`,
      },
    ]);
  });

  it('writes one TIER_DEMOTION audit row with system actor and the released bookings', async () => {
    const { db, deps } = setup();
    seed(db);
    await runGphnExpirySweep(deps);

    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({
      actorId: null,
      action: AuditAction.TIER_DEMOTION,
      targetId: NURSE_EXPIRED,
      oldValue: { tier: T2, gphnNumber: 'G-1', gphnExpiryDate: '2026-11-03' },
      newValue: { tier: T1, profileStatus: ProfileStatus.ACTIVE, reason: 'GPHN_EXPIRED', sweepDate: TODAY, releasedBookingIds: [id(10)] },
    });
  });

  it('no penalty path: nothing but the four expected statements is executed (no ledger, no trust score)', async () => {
    const { db, deps } = setup();
    seed(db);
    // FakeDb throws on any unexpected SQL, so reaching here proves no other table was touched.
    await expect(runGphnExpirySweep(deps)).resolves.toMatchObject({ failed: 0 });
  });

  it('notifies the nurse and each affected customer', async () => {
    const { db, deps, notices } = setup();
    seed(db);
    await runGphnExpirySweep(deps);
    expect(notices.map((n) => [n.userId, n.bookingId])).toEqual([
      [NURSE_EXPIRED, undefined],
      [CUSTOMER, id(10)],
    ]);
  });

  it('is idempotent: a second run changes nothing and schedules nothing new', async () => {
    const { db, scheduler, deps } = setup();
    seed(db);
    await runGphnExpirySweep(deps);
    const r2 = await runGphnExpirySweep(deps);
    expect(r2).toEqual({ demoted: 0, skipped: 0, releasedBookings: 0, failed: 0 });
    expect(db.audits).toHaveLength(1);
    expect(scheduler.jobs).toHaveLength(1);
  });

  it('a renewal approved between scan and lock wins: the nurse is skipped, not demoted', async () => {
    const { db, deps } = setup();
    seed(db);
    db.onLock = (nurseId) => {
      if (nurseId === NURSE_EXPIRED) db.nurses.get(nurseId)!.gphn_expiry_date = '2031-06-30';
    };
    const r = await runGphnExpirySweep(deps);
    expect(r).toMatchObject({ demoted: 0, skipped: 1 });
    expect(db.nurses.get(NURSE_EXPIRED)!.tier).toBe(T2);
    expect(db.bookings.find((b) => b.id === id(10))!.execution_status).toBe('CONFIRMED');
  });

  it('one failing nurse does not stop the others; failures are counted', async () => {
    const { db, deps } = setup();
    seed(db);
    const OTHER = id(3);
    db.nurses.set(OTHER, { tier: T2, gphn_number: 'G-3', gphn_expiry_date: '2026-10-01', profile_status: ProfileStatus.SUSPENDED });
    db.failOn.add(NURSE_EXPIRED);

    const r = await runGphnExpirySweep(deps);
    expect(r).toMatchObject({ demoted: 1, failed: 1 });
    // status kept as-is even when it is not ACTIVE
    expect(db.nurses.get(OTHER)).toMatchObject({ tier: T1, profile_status: ProfileStatus.SUSPENDED });
  });

  it('pages through candidates in batches', async () => {
    const { db, deps } = setup();
    for (let i = 100; i < 105; i++) {
      db.nurses.set(id(i), { tier: T2, gphn_number: `G-${i}`, gphn_expiry_date: '2026-01-01', profile_status: ProfileStatus.ACTIVE });
    }
    const r = await runGphnExpirySweep({ ...deps, batchSize: 2 });
    expect(r.demoted).toBe(5);
  });

  it('a redispatch that cannot be scheduled is counted as a failure (job will retry → DLQ alert)', async () => {
    const { db, scheduler, deps } = setup();
    seed(db);
    scheduler.fail = true;
    const r = await runGphnExpirySweep(deps);
    expect(r).toMatchObject({ demoted: 1, releasedBookings: 1, failed: 1 });
  });
});

describe('registerTierLifecycleJobs', () => {
  it('registers the daily schedule and throws from the handler when the sweep reports failures', async () => {
    const handlers = new Map<string, () => Promise<void>>();
    const schedules: unknown[] = [];
    const queue = {
      registerHandler: (name: string, h: () => Promise<void>) => void handlers.set(name, h),
      scheduleRecurring: async (...args: unknown[]) => void schedules.push(args),
      scheduleJob: async () => ({}),
    };
    let failed = 0;
    await registerTierLifecycleJobs(queue, async () => ({ demoted: 0, skipped: 0, releasedBookings: 0, failed }));

    expect(schedules).toEqual([[GPHN_EXPIRY_SWEEP_JOB, { pattern: '5 0 * * *', tz: 'Asia/Ho_Chi_Minh' }, GPHN_EXPIRY_SWEEP_JOB]]);
    await expect(handlers.get(GPHN_EXPIRY_SWEEP_JOB)!()).resolves.toBeUndefined();
    failed = 2;
    await expect(handlers.get(GPHN_EXPIRY_SWEEP_JOB)!()).rejects.toThrow(/2 failure/);
  });
});
