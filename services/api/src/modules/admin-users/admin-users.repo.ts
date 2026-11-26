/**
 * admin-users — SQL (BE-2 · Phase 7). Write functions expect a TRANSACTION client.
 */
import type { Queryable } from '../../core/database';
import { classifyQuery } from './admin-users.policy';
import type { BookingRef, ListFilter, NurseStanding, UserRow } from './admin-users.types';

const USER_SELECT = `
  SELECT u.id, u.role::text AS role, u.full_name, u.phone, u.email, u.avatar_url, u.cccd_number,
         u.kyc_status::text AS kyc_status, u.status::text AS status, u.created_at,
         np.profile_status::text AS profile_status, np.suspended_reason, np.tier::text AS tier, np.trust_score,
         np.rating_avg, np.gphn_number, to_char(np.gphn_expiry_date, 'YYYY-MM-DD') AS gphn_expiry_date,
         np.years_of_exp, np.is_online
    FROM users u
    LEFT JOIN nurse_profiles np ON np.user_id = u.id`;

/** Effective status: the nurse profile for a nurse, the account otherwise. */
const EFFECTIVE = `CASE WHEN u.role = 'NURSE' AND np.profile_status IS NOT NULL THEN np.profile_status::text ELSE u.status::text END`;

export async function listUsers(db: Queryable, f: ListFilter): Promise<{ rows: UserRow[]; total: number }> {
  const where: string[] = [`u.role IN ('PATIENT', 'NURSE')`];
  const params: unknown[] = [];
  const add = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (f.role) where.push(`u.role = ${add(f.role)}::user_role_enum`);
  if (f.status) where.push(`${EFFECTIVE} = ${add(f.status)}`);
  const q = classifyQuery(f.q);
  if (q?.kind === 'id') where.push(`u.id = ${add(q.value)}::uuid`);
  if (q?.kind === 'phone') where.push(`u.phone LIKE ${add(`%${q.value}%`)}`);
  if (q?.kind === 'text') {
    const p = add(`%${q.value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    where.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p})`);
  }
  const { rows } = await db.query<UserRow>(
    `${USER_SELECT.replace('SELECT u.id', 'SELECT count(*) OVER () AS total, u.id')}
      WHERE ${where.join(' AND ')}
      ORDER BY u.created_at DESC, u.id
      LIMIT ${add(f.limit)} OFFSET ${add(f.offset)}`,
    params,
  );
  return { rows, total: rows[0] ? Number(rows[0].total) : 0 };
}

export async function findUser(db: Queryable, id: string): Promise<UserRow | null> {
  const { rows } = await db.query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return rows[0] ?? null;
}

/**
 * Locks the account row, then the nurse profile (always in this order). The cash-commission sweep, the TrustScore
 * update and the deposit trigger write nurse_profiles too: they wait for us, never interleave.
 *
 * FOR NO KEY UPDATE, not FOR UPDATE (found by the Phase 8 concurrency test): a nurse accepting a shift holds her
 * nurse_profiles row and then writes bookings.nurse_id, whose foreign key takes FOR KEY SHARE on this users row.
 * FOR UPDATE would block that while we wait for nurse_profiles → deadlock. We never change users.id, so the
 * weaker lock is exact; it still serializes with bookings' FOR SHARE read of a customer's status.
 */
export async function lockUser(db: Queryable, id: string): Promise<UserRow | null> {
  const { rows } = await db.query<{ id: string }>(`SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE`, [id]);
  if (!rows[0]) return null;
  await db.query(`SELECT 1 FROM nurse_profiles WHERE user_id = $1 FOR UPDATE`, [id]);
  return findUser(db, id);
}

export async function setAccountStatus(db: Queryable, id: string, status: string): Promise<void> {
  await db.query(`UPDATE users SET status = $2::user_status_enum WHERE id = $1`, [id, status]);
}

export async function setProfileStatus(db: Queryable, id: string, status: string, reason: string | null): Promise<void> {
  await db.query(
    `UPDATE nurse_profiles
        SET profile_status = $2::profile_status_enum, suspended_reason = $3,
            is_online = CASE WHEN $2 = 'ACTIVE' THEN is_online ELSE FALSE END, updated_at = now()
      WHERE user_id = $1`,
    [id, status, reason],
  );
}

const OVERDUE_COMMISSION = `
  b.payment_method = 'CASH' AND b.execution_status = 'COMPLETED' AND b.settled_at IS NULL
  AND b.commission_due_at IS NOT NULL AND b.commission_due_at <= $2 AND b.platform_fee > 0`;

/** Deposit (with the onboarding grace — same rule as the 0025 trigger), overdue commission, TrustScore. */
export async function nurseStanding(db: Queryable, nurseId: string, now: Date): Promise<NurseStanding> {
  const { rows } = await db.query<{
    deposit_balance: string | null;
    in_grace: boolean | null;
    min_deposit: string | null;
    overdue: string;
    trust_score: number;
    threshold: string | null;
  }>(
    `SELECT w.deposit_balance,
            (w.deposit_balance >= 0 AND w.deposit_grace_expires_at IS NOT NULL AND w.deposit_grace_expires_at > $2
             AND COALESCE(w.deposit_grace_shifts_used, 0) <
                 COALESCE((SELECT config_value::numeric FROM system_configs WHERE config_key = 'DEPOSIT_GRACE_MAX_SHIFTS'), 0)) AS in_grace,
            (SELECT config_value FROM system_configs WHERE config_key = 'MIN_NURSE_DEPOSIT') AS min_deposit,
            (SELECT count(*) FROM bookings b WHERE b.nurse_id = np.user_id AND ${OVERDUE_COMMISSION}) AS overdue,
            np.trust_score,
            (SELECT config_value FROM system_configs WHERE config_key = 'TRUST_SUSPEND_BELOW') AS threshold
       FROM nurse_profiles np
       LEFT JOIN wallets w ON w.user_id = np.user_id
      WHERE np.user_id = $1`,
    [nurseId, now],
  );
  const r = rows[0];
  return {
    depositBalance: Number(r?.deposit_balance ?? 0),
    inGrace: r?.in_grace === true,
    minDeposit: Number(r?.min_deposit ?? 0),
    overdueCommissions: Number(r?.overdue ?? 0),
    trustScore: Number(r?.trust_score ?? 0),
    trustThreshold: Number(r?.threshold ?? 0),
  };
}

/**
 * Takes a locked nurse off every CONFIRMED shift that has not started and sends it back to MATCHING — no fee for the
 * customer, escrow stays on the booking (same release as tier-lifecycle). The prescription check is reset: the next
 * nurse verifies it again.
 */
export async function releaseFutureBookings(db: Queryable, nurseId: string, now: Date): Promise<BookingRef[]> {
  const { rows } = await db.query<BookingRef>(
    `UPDATE bookings
        SET nurse_id = NULL, execution_status = 'MATCHING', prescription_verified_by_nurse = FALSE, updated_at = now()
      WHERE nurse_id = $1 AND execution_status = 'CONFIRMED' AND start_time > $2
      RETURNING id, booking_code, customer_id, matching_mode::text AS matching_mode, execution_status::text AS execution_status`,
    [nurseId, now],
  );
  return rows;
}

/** Shifts of this nurse that are running or confirmed-but-already-started: left alone, reported to the Admin. */
export async function runningNurseBookings(db: Queryable, nurseId: string): Promise<BookingRef[]> {
  const { rows } = await db.query<BookingRef>(
    `SELECT id, booking_code, customer_id, matching_mode::text AS matching_mode, execution_status::text AS execution_status
       FROM bookings WHERE nurse_id = $1 AND execution_status IN ('CONFIRMED', 'IN_PROGRESS') ORDER BY start_time`,
    [nurseId],
  );
  return rows;
}

/** Customer's bookings that are not finished (for the Admin to follow up after a ban). */
export async function openCustomerBookings(db: Queryable, customerId: string): Promise<BookingRef[]> {
  const { rows } = await db.query<BookingRef>(
    `SELECT id, booking_code, customer_id, matching_mode::text AS matching_mode, execution_status::text AS execution_status
       FROM bookings WHERE customer_id = $1 AND execution_status IN ('DRAFT', 'MATCHING', 'CONFIRMED', 'IN_PROGRESS')
      ORDER BY start_time`,
    [customerId],
  );
  return rows;
}

export async function bookingCounts(db: Queryable, userId: string): Promise<{ total: number; open: number; inProgress: number }> {
  const { rows } = await db.query<{ total: string; open: string; in_progress: string }>(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE execution_status IN ('DRAFT', 'MATCHING', 'CONFIRMED', 'IN_PROGRESS')) AS open,
            count(*) FILTER (WHERE execution_status = 'IN_PROGRESS') AS in_progress
       FROM bookings WHERE customer_id = $1 OR nurse_id = $1`,
    [userId],
  );
  return { total: Number(rows[0].total), open: Number(rows[0].open), inProgress: Number(rows[0].in_progress) };
}

export async function statusHistory(
  db: Queryable,
  userId: string,
  limit = 50,
): Promise<Array<{ created_at: Date; actor_id: string | null; actor_name: string | null; old_value: any; new_value: any }>> {
  const { rows } = await db.query(
    `SELECT a.created_at, a.actor_id, u.full_name AS actor_name, a.old_value, a.new_value
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.target_table = 'users' AND a.target_id = $1 AND a.action_type = 'CHANGE_ACCOUNT_STATUS'
      ORDER BY a.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows as any;
}
