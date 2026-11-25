import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { closePool, runInTransaction } from '../../src/core/database';
import { AppError } from '../../src/core/errors';
import { AdminUsersService } from '../../src/modules/admin-users/admin-users.service';
import type { Notice } from '../../src/modules/notifications/notifications.types';
import { createTestPool } from './helpers';

/**
 * Phase 7 (BE-2 · admin-users) trên PostgreSQL 16 thật (migration 0027) — FR-ADMIN-01 "Quản lý Người dùng":
 * tìm kiếm, xem chi tiết, khóa / mở khóa (ACTIVE / SUSPENDED / BANNED) tài khoản Khách hàng & Điều dưỡng.
 *  - điều dưỡng: profile_status là nguồn sự thật duy nhất; khóa → gỡ khỏi ca CONFIRMED chưa bắt đầu và điều phối lại
 *  - mở khóa chỉ khi đã hết nguyên nhân (ký quỹ đủ, không nợ hoa hồng; TrustScore thấp cần Admin xác nhận đào tạo lại)
 *  - BANNED là vĩnh viễn, thu hồi phiên đăng nhập; mọi thay đổi ghi audit_logs CHANGE_ACCOUNT_STATUS
 */
describe('admin-users (integration)', () => {
  let pool: Pool;
  let svc: AdminUsersService;
  let adminId: string;
  const notices: Notice[] = [];
  const scheduled: { name: string; payload: any; key: string }[] = [];
  const revoked: string[] = [];
  const NOW = Date.now();
  const HOUR = 3_600_000;
  const RUN = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  let seq = 0;

  const phone = () => `07${Math.floor(Math.random() * 1e8).toString().padStart(8, '0')}`;

  async function user(role: 'PATIENT' | 'NURSE' | 'ADMIN', name: string, status = 'ACTIVE') {
    const { rows } = await pool.query(
      `INSERT INTO users (phone, full_name, role, status, email, cccd_number) VALUES ($1, $2, $3, $4::user_status_enum, $5, $6) RETURNING id, phone`,
      [phone(), name, role, status, `${RUN.toLowerCase()}${++seq}@example.com`, role === 'PATIENT' ? `0792${RUN.replace(/\D/g, '9').padEnd(4, '9')}${String(seq).padStart(4, '0')}` : null],
    );
    return { id: rows[0].id as string, phone: rows[0].phone as string };
  }

  async function nurse(o: { status?: string; reason?: string | null; deposit?: number; trust?: number } = {}) {
    const u = await user('NURSE', `Điều dưỡng ${RUN} ${seq}`);
    await pool.query(
      `INSERT INTO nurse_profiles (user_id, tier, profile_status, suspended_reason, trust_score, is_online)
       VALUES ($1, 'TIER_1_BASIC', $2::profile_status_enum, $3, $4, TRUE)`,
      [u.id, o.status ?? 'ACTIVE', o.reason ?? null, o.trust ?? 100],
    );
    // The 0025 trigger only fires on UPDATE: the insert sets the starting balance as is.
    await pool.query(`INSERT INTO wallets (user_id, deposit_balance) VALUES ($1, $2)`, [u.id, o.deposit ?? 300_000]);
    return u;
  }

  async function booking(customerId: string, nurseId: string | null, status: string, startInHours: number, extra: { cashOverdue?: boolean } = {}) {
    const profile = await pool.query(
      `INSERT INTO patient_profiles (customer_id, full_name, dob, weight_kg, mobility_status, address_text, location_type, lat, lng,
                                     data_consent_accepted, consent_timestamp)
       VALUES ($1, 'Lê Văn Bảy', '1948-03-20', 58, 'NORMAL', '12 Lê Lợi', 'HOME', 10.77, 106.70, TRUE, now()) RETURNING id`,
      [customerId],
    );
    const code = `HC-261125-${RUN}${String(++seq).padStart(2, '0')}`;
    const start = new Date(NOW + startInHours * HOUR);
    const { rows } = await pool.query(
      `INSERT INTO bookings (booking_code, customer_id, patient_profile_id, nurse_id, service_id, matching_mode, payment_method,
                             start_time, end_time, base_amount, total_amount, platform_fee, execution_status, commission_due_at)
       SELECT $1, $2, $3, $4, id, 'JOB_BOARD', 'CASH', $5, $5::timestamptz + interval '4 hours', 400000, 400000, 60000,
              $6::execution_status_enum, $7
         FROM service_categories WHERE code = 'SRV_SHIFT_4H' RETURNING id`,
      [code, customerId, profile.rows[0].id, nurseId, start, status, extra.cashOverdue ? new Date(NOW - HOUR) : null],
    );
    return { id: rows[0].id as string, code };
  }

  const nurseRow = async (id: string) =>
    (
      await pool.query(
        `SELECT np.profile_status::text AS profile, np.suspended_reason AS reason, np.is_online, u.status::text AS account
           FROM nurse_profiles np JOIN users u ON u.id = np.user_id WHERE u.id = $1`,
        [id],
      )
    ).rows[0];

  async function rejectsWith(p: Promise<unknown>, status: number, code: string) {
    let err: unknown;
    try {
      await p;
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AppError);
    expect([(err as AppError).status, (err as AppError).code]).toEqual([status, code]);
    return err as AppError;
  }

  beforeAll(async () => {
    pool = createTestPool();
    adminId = (await user('ADMIN', 'Admin vận hành')).id;
    svc = new AdminUsersService({
      read: pool,
      withTx: (fn) => runInTransaction(pool, fn),
      scheduler: {
        scheduleJob: async (name, payload, _at, key) => {
          scheduled.push({ name, payload, key });
        },
      },
      revokeSessions: async (id) => {
        revoked.push(id);
      },
      notify: async (n) => {
        notices.push(n);
      },
      now: () => NOW,
    });
  });

  afterAll(async () => {
    await pool.end();
    await closePool();
  });

  it('search by name, phone and id; filter by role and by the status that matters (profile for a nurse)', async () => {
    const c = await user('PATIENT', `Khách ${RUN} Tìm Kiếm`);
    const n = await nurse({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL' });

    const byName = await svc.list({ q: `khách ${RUN.toLowerCase()} tìm`, limit: 50, offset: 0 });
    expect(byName.items.map((i) => i.id)).toEqual([c.id]);
    expect(byName.items[0]).toMatchObject({ role: 'PATIENT', status: 'ACTIVE', accountStatus: 'ACTIVE', profileStatus: null, tier: null });

    const byPhone = await svc.list({ q: n.phone.slice(2), limit: 50, offset: 0 });
    expect(byPhone.items.map((i) => i.id)).toContain(n.id);
    const byPhone84 = await svc.list({ q: `+84 ${n.phone.slice(1)}`, limit: 50, offset: 0 });
    expect(byPhone84.items.map((i) => i.id)).toEqual([n.id]);

    const byId = await svc.list({ q: n.id, limit: 50, offset: 0 });
    expect(byId.items[0]).toMatchObject({
      id: n.id,
      role: 'NURSE',
      status: 'SUSPENDED', // the profile, not the account (ACTIVE)
      accountStatus: 'ACTIVE',
      suspendedReason: 'DEPOSIT_SHORTFALL',
      trustScore: 100,
    });

    const suspendedNurses = await svc.list({ role: 'NURSE', status: 'SUSPENDED', limit: 100, offset: 0 });
    expect(suspendedNurses.items.every((i) => i.role === 'NURSE' && i.status === 'SUSPENDED')).toBe(true);
    expect(suspendedNurses.items.map((i) => i.id)).toContain(n.id);

    const all = await svc.list({ limit: 100, offset: 0 });
    expect(all.items.some((i) => i.id === adminId)).toBe(false); // Admin accounts are not listed
    expect(all.total).toBeGreaterThanOrEqual(2);
    expect((await svc.list({ q: '%', limit: 5, offset: 0 })).items).toEqual([]); // LIKE wildcards are literal
  });

  it('suspending a nurse: profile only (still signs in), future shifts re-dispatched, running shift untouched, audited', async () => {
    const n = await nurse();
    const c = await user('PATIENT', 'Khách có ca');
    const future = await booking(c.id, n.id, 'CONFIRMED', 48);
    const running = await booking(c.id, n.id, 'IN_PROGRESS', -1);
    notices.length = 0;
    scheduled.length = 0;

    const r = await svc.setStatus(adminId, n.id, { status: 'SUSPENDED', reason: 'Khách phản ánh thái độ, chờ xác minh' }, '10.0.0.9');
    expect(r).toMatchObject({
      updated: true,
      role: 'NURSE',
      previousStatus: 'ACTIVE',
      status: 'SUSPENDED',
      sessionsRevoked: false,
      releasedBookings: [{ id: future.id, bookingCode: future.code }],
      inProgressBookings: [{ id: running.id, bookingCode: running.code }],
    });
    expect(await nurseRow(n.id)).toEqual({ profile: 'SUSPENDED', reason: 'ADMIN_SUSPENDED', is_online: false, account: 'ACTIVE' });
    const b = (await pool.query(`SELECT nurse_id, execution_status::text AS s FROM bookings WHERE id = $1`, [future.id])).rows[0];
    expect(b).toEqual({ nurse_id: null, s: 'MATCHING' });
    expect(scheduled).toEqual([
      { name: 'matching-radar.redispatch', key: `redispatch:${future.id}:${n.id}`, payload: expect.objectContaining({ reason: 'NURSE_SUSPENDED', releasedNurseId: n.id }) },
    ]);
    expect(revoked).not.toContain(n.id);
    expect(notices.map((x) => [x.userId, x.type])).toEqual([
      [n.id, 'ACCOUNT_SUSPENDED'],
      [c.id, 'BOOKING_REDISPATCHED'],
    ]);

    const audit = (
      await pool.query(
        `SELECT actor_id, ip_address, old_value, new_value FROM audit_logs WHERE target_id = $1 AND action_type = 'CHANGE_ACCOUNT_STATUS'`,
        [n.id],
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actor_id: adminId,
      ip_address: '10.0.0.9',
      old_value: { status: 'ACTIVE', role: 'NURSE' },
      new_value: { status: 'SUSPENDED', reason: 'Khách phản ánh thái độ, chờ xác minh', releasedBookingIds: [future.id] },
    });

    // a deposit top-up must not lift an Admin suspension (the 0025 trigger only lifts DEPOSIT_SHORTFALL)
    await pool.query(`UPDATE wallets SET deposit_balance = deposit_balance + 50000 WHERE user_id = $1`, [n.id]);
    expect((await nurseRow(n.id)).reason).toBe('ADMIN_SUSPENDED');

    await rejectsWith(svc.setStatus(adminId, n.id, { status: 'SUSPENDED', reason: 'lần hai nữa' }), 409, 'ALREADY_IN_STATUS');
    const back = await svc.setStatus(adminId, n.id, { status: 'ACTIVE', reason: 'Đã xác minh, không vi phạm' });
    expect(back).toMatchObject({ previousStatus: 'SUSPENDED', status: 'ACTIVE', releasedBookings: [] });
    expect(await nurseRow(n.id)).toMatchObject({ profile: 'ACTIVE', reason: null });

    const d = await svc.detail(n.id);
    expect(d.statusHistory.map((h) => [h.from, h.to])).toEqual([
      ['SUSPENDED', 'ACTIVE'],
      ['ACTIVE', 'SUSPENDED'],
    ]);
    expect(d.statusHistory[0]).toMatchObject({ actorId: adminId, actorName: 'Admin vận hành', reason: 'Đã xác minh, không vi phạm' });
  });

  it('reactivation is refused while the deposit is short or a cash commission is overdue; a low TrustScore needs a waiver', async () => {
    const short = await nurse({ status: 'SUSPENDED', reason: 'DEPOSIT_SHORTFALL', deposit: 120_000 });
    const e1 = await rejectsWith(svc.setStatus(adminId, short.id, { status: 'ACTIVE', reason: 'Mở khóa thử' }), 409, 'REACTIVATION_BLOCKED');
    expect(e1.details).toEqual({ blockers: ['DEPOSIT_SHORTFALL'] });
    expect((await svc.detail(short.id)).nurse).toMatchObject({ depositBalance: 120_000, minDeposit: 300_000, reactivationBlockers: ['DEPOSIT_SHORTFALL'] });

    const owes = await nurse({ status: 'SUSPENDED', reason: 'COMMISSION_OVERDUE' });
    const c = await user('PATIENT', 'Khách tiền mặt');
    await booking(c.id, owes.id, 'COMPLETED', -30, { cashOverdue: true });
    const e2 = await rejectsWith(svc.setStatus(adminId, owes.id, { status: 'ACTIVE', reason: 'Mở khóa thử' }), 409, 'REACTIVATION_BLOCKED');
    expect(e2.details).toEqual({ blockers: ['COMMISSION_OVERDUE'] });

    const low = await nurse({ status: 'SUSPENDED', reason: 'TRUST_SCORE_BELOW_THRESHOLD', trust: 55 });
    const e3 = await rejectsWith(svc.setStatus(adminId, low.id, { status: 'ACTIVE', reason: 'Mở khóa thử' }), 409, 'REACTIVATION_BLOCKED');
    expect(e3.details).toEqual({ blockers: ['TRUST_SCORE_BELOW_THRESHOLD'] });
    await svc.setStatus(adminId, low.id, { status: 'ACTIVE', reason: 'Đã hoàn thành khóa đào tạo lại', waiveTrustScore: true });
    expect((await nurseRow(low.id)).profile).toBe('ACTIVE');
    const a = (await pool.query(`SELECT new_value FROM audit_logs WHERE target_id = $1 AND action_type = 'CHANGE_ACCOUNT_STATUS'`, [low.id])).rows[0];
    expect(a.new_value).toMatchObject({ status: 'ACTIVE', trustScoreWaived: true });

    // a waiver never lifts a hard blocker
    await rejectsWith(svc.setStatus(adminId, short.id, { status: 'ACTIVE', reason: 'Mở khóa thử', waiveTrustScore: true }), 409, 'REACTIVATION_BLOCKED');
    expect((await nurseRow(short.id)).profile).toBe('SUSPENDED');
  });

  it('banning a nurse: profile and account BANNED, sessions revoked, shifts re-dispatched; a ban is permanent', async () => {
    const n = await nurse();
    const c = await user('PATIENT', 'Khách bị ảnh hưởng');
    const future = await booking(c.id, n.id, 'CONFIRMED', 72);
    scheduled.length = 0;
    const r = await svc.setStatus(adminId, n.id, { status: 'BANNED', reason: 'Giả mạo giấy phép hành nghề' });
    expect(r).toMatchObject({ status: 'BANNED', sessionsRevoked: true, releasedBookings: [{ id: future.id }] });
    expect(await nurseRow(n.id)).toEqual({ profile: 'BANNED', reason: 'ADMIN_BANNED', is_online: false, account: 'BANNED' });
    expect(revoked).toContain(n.id);
    expect(scheduled[0].payload).toMatchObject({ reason: 'NURSE_BANNED', bookingId: future.id });

    await rejectsWith(svc.setStatus(adminId, n.id, { status: 'ACTIVE', reason: 'Gỡ cấm thử' }), 409, 'BANNED_IS_PERMANENT');
    await rejectsWith(svc.setStatus(adminId, n.id, { status: 'SUSPENDED', reason: 'Gỡ cấm thử' }), 409, 'BANNED_IS_PERMANENT');
  });

  it('a nurse waiting for credential review can only be banned; Admins and yourself are off limits', async () => {
    const p = await nurse({ status: 'PENDING_VERIFICATION' });
    await rejectsWith(svc.setStatus(adminId, p.id, { status: 'ACTIVE', reason: 'Duyệt hồ sơ' }), 409, 'PROFILE_PENDING_VERIFICATION');
    await rejectsWith(svc.setStatus(adminId, p.id, { status: 'SUSPENDED', reason: 'Tạm khóa' }), 409, 'PROFILE_PENDING_VERIFICATION');
    await svc.setStatus(adminId, p.id, { status: 'BANNED', reason: 'Văn bằng giả mạo' });
    expect((await nurseRow(p.id)).profile).toBe('BANNED');

    const other = await user('ADMIN', 'Admin khác');
    await rejectsWith(svc.setStatus(adminId, other.id, { status: 'SUSPENDED', reason: 'Không được phép' }), 403, 'TARGET_NOT_MANAGEABLE');
    await rejectsWith(svc.setStatus(adminId, adminId, { status: 'SUSPENDED', reason: 'Không được phép' }), 403, 'TARGET_NOT_MANAGEABLE');
    await rejectsWith(svc.detail(other.id), 404, 'USER_NOT_FOUND');
    await rejectsWith(svc.setStatus(adminId, '00000000-0000-4000-8000-000000000000', { status: 'BANNED', reason: 'Không tồn tại' }), 404, 'USER_NOT_FOUND');
  });

  it('customers: SUSPENDED keeps the session, BANNED revokes it and lists open bookings; detail masks the CCCD', async () => {
    const c = await user('PATIENT', 'Khách cần khóa');
    const open = await booking(c.id, null, 'MATCHING', 24);
    const s = await svc.setStatus(adminId, c.id, { status: 'SUSPENDED', reason: 'Nhiều lần hủy ca không lý do' });
    expect(s).toMatchObject({ role: 'PATIENT', previousStatus: 'ACTIVE', status: 'SUSPENDED', sessionsRevoked: false, openCustomerBookings: [] });
    expect(revoked).not.toContain(c.id);

    const d = await svc.detail(c.id);
    expect(d).toMatchObject({ status: 'SUSPENDED', nurse: null, bookings: { total: 1, open: 1, inProgress: 0 } });
    expect(d.cccdMasked).toMatch(/^•+\d{4}$/);
    expect(JSON.stringify(d)).not.toContain('cccd_number');

    const b = await svc.setStatus(adminId, c.id, { status: 'BANNED', reason: 'Quấy rối điều dưỡng' });
    expect(b).toMatchObject({
      previousStatus: 'SUSPENDED',
      sessionsRevoked: true,
      openCustomerBookings: [{ id: open.id, bookingCode: open.code, executionStatus: 'MATCHING' }],
    });
    expect(revoked).toContain(c.id);
  });
});
