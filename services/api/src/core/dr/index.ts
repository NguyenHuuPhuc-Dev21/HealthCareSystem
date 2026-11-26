/**
 * Disaster-recovery verification (BE-2 · Phase 8 · NFR-AVAIL-01 / CT-23) — what must be true of a database restored
 * from backup + PITR before anyone trusts it. Used by `npm run ops:dr-verify` after infra/dr/drill.sh (or after a
 * real restore). Read-only: it never writes to either database.
 *
 *  recovery     the restored server has finished recovery (promoted)
 *  migrations   every db/migrations file is recorded in schema_migrations (same set as the source, if given)
 *  triggers     the append-only / money / safety triggers exist and are enabled
 *  rows@target  rows created up to the target exist in the restored copy exactly as in the source:
 *               wallet_transactions (RPO wallets ≤ 1 h), audit_logs (RPO logs ≤ 24 h), bookings, conversations_messages
 *  ledger       every wallet balance (available / escrow / deposit) equals the sum of its ledger movements
 *  archiving    (source) WAL archiving on, archive_timeout ≤ 1 h, last archive recent, no recent failures
 */
import type { Queryable } from '../database';

/** A pool or client on the restored / source database (core/database Queryable). */
export type DrDb = Queryable;

export type DrStatus = 'PASS' | 'WARN' | 'FAIL';
export interface DrCheck {
  name: string;
  status: DrStatus;
  detail: string;
}

/** Triggers whose loss would silently break money or evidence rules (migrations 0001 → 0026). */
export const CRITICAL_TRIGGERS = [
  'trg_wallet_transactions_no_update',
  'trg_wallet_transactions_no_delete',
  'trg_audit_logs_no_update',
  'trg_audit_logs_no_delete',
  'trg_settlements_no_update',
  'trg_settlements_no_delete',
  'trg_payment_webhook_events_no_update',
  'trg_payment_webhook_events_no_delete',
  'trg_bookings_no_prohibited_service',
  'trg_wallets_deposit_suspension',
  'trg_conversations_messages_guard',
] as const;

/** Tables compared row-for-row up to the target, with the SRS recovery-point budget that applies. */
export const TARGET_TABLES: Array<{ table: string; budget: string }> = [
  { table: 'wallet_transactions', budget: 'RPO wallets ≤ 1 h' },
  { table: 'audit_logs', budget: 'RPO logs ≤ 24 h' },
  { table: 'bookings', budget: 'RPO ≤ 1 h' },
  { table: 'conversations_messages', budget: 'RPO logs ≤ 24 h' },
];

export const MAX_ARCHIVE_TIMEOUT_S = 3600; // RPO wallets ≤ 1 h
export const MAX_ARCHIVE_AGE_S = 3600;

const LEDGER_MISMATCH_SQL = `
  SELECT count(*)::int AS n FROM (
    SELECT w.id,
           w.available_balance     <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'AVAILABLE'     AND t.status = 'COMPLETED'), 0) AS a,
           w.escrow_locked_balance <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'ESCROW_LOCKED' AND t.status = 'COMPLETED'), 0) AS e,
           w.deposit_balance       <> COALESCE(sum(t.balance_after - t.balance_before) FILTER (WHERE t.balance_type = 'DEPOSIT'       AND t.status = 'COMPLETED'), 0) AS d
      FROM wallets w LEFT JOIN wallet_transactions t ON t.wallet_id = w.id
     GROUP BY w.id) x
   WHERE a OR e OR d`;

async function ledgerMismatches(db: DrDb): Promise<number> {
  return (await db.query<{ n: number }>(LEDGER_MISMATCH_SQL)).rows[0].n;
}

async function countUpTo(db: DrDb, table: string, target: string | null): Promise<{ n: number; last: string | null }> {
  const where = target ? `WHERE created_at <= $1::timestamptz` : '';
  const { rows } = await db.query<{ n: number; last: string | null }>(
    `SELECT count(*)::int AS n, to_char(max(created_at), 'YYYY-MM-DD"T"HH24:MI:SS.MSOF') AS last FROM ${table} ${where}`,
    target ? [target] : [],
  );
  return rows[0];
}

export async function runDrChecks(opts: {
  restored: DrDb;
  source?: DrDb | null;
  migrationIds: string[];
  target?: string | null;
}): Promise<DrCheck[]> {
  const { restored, source = null, target = null } = opts;
  const out: DrCheck[] = [];

  // recovery finished
  const rec = (await restored.query<{ r: boolean }>(`SELECT pg_is_in_recovery() AS r`)).rows[0].r;
  out.push({ name: 'recovery', status: rec ? 'FAIL' : 'PASS', detail: rec ? 'still in recovery — not promoted' : 'promoted, accepting writes' });

  // migrations
  const appliedIds = async (db: DrDb): Promise<string[]> => {
    const t = await db.query<{ ok: boolean }>(`SELECT to_regclass('public.schema_migrations') IS NOT NULL AS ok`);
    return t.rows[0].ok ? (await db.query<{ id: string }>(`SELECT id FROM schema_migrations`)).rows.map((r: { id: string }) => r.id) : [];
  };
  const applied = new Set(await appliedIds(restored));
  const missing = opts.migrationIds.filter((id) => !applied.has(id));
  let migDetail = missing.length ? `missing: ${missing.join(', ')}` : `${opts.migrationIds.length} migration files all applied`;
  let migStatus: DrStatus = missing.length ? 'FAIL' : 'PASS';
  if (source) {
    const srcIds = await appliedIds(source);
    const notRestored = srcIds.filter((id) => !applied.has(id));
    if (notRestored.length) {
      migStatus = 'FAIL';
      migDetail += `; applied on source but not restored: ${notRestored.join(', ')}`;
    }
  }
  out.push({ name: 'migrations', status: migStatus, detail: migDetail });

  // triggers
  const trg = await restored.query<{ tgname: string; tgenabled: string }>(
    `SELECT tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])`,
    [[...CRITICAL_TRIGGERS]],
  );
  const present = new Map<string, string>(trg.rows.map((r: { tgname: string; tgenabled: string }) => [r.tgname, r.tgenabled]));
  const lost = CRITICAL_TRIGGERS.filter((t) => !present.has(t));
  const disabled = CRITICAL_TRIGGERS.filter((t) => present.get(t) === 'D');
  out.push({
    name: 'triggers',
    status: lost.length || disabled.length ? 'FAIL' : 'PASS',
    detail:
      lost.length || disabled.length
        ? `missing: ${lost.join(', ') || '-'}; disabled: ${disabled.join(', ') || '-'}`
        : `${CRITICAL_TRIGGERS.length} critical triggers present and enabled`,
  });

  // rows up to the target, against the source
  for (const { table, budget } of TARGET_TABLES) {
    const r = await countUpTo(restored, table, target);
    if (!source) {
      out.push({ name: `rows:${table}`, status: 'WARN', detail: `${r.n} rows, newest ${r.last ?? '-'} (no --source to compare; ${budget})` });
      continue;
    }
    const s = await countUpTo(source, table, target);
    const lostRows = s.n - r.n;
    out.push({
      name: `rows:${table}`,
      status: lostRows === 0 ? 'PASS' : target ? 'FAIL' : 'WARN',
      detail:
        lostRows === 0
          ? `${r.n} rows${target ? ` up to ${target}` : ''} — identical to source (${budget})`
          : `${lostRows} row(s) ${target ? `created before ${target} ` : ''}missing (source ${s.n}, restored ${r.n}, newest restored ${r.last ?? '-'}; ${budget})`,
    });
  }

  // ledger consistency
  const mis = await ledgerMismatches(restored);
  if (mis === 0) {
    out.push({ name: 'ledger', status: 'PASS', detail: 'every wallet balance equals its ledger (available / escrow / deposit)' });
  } else {
    const srcMis = source ? await ledgerMismatches(source) : null;
    out.push({
      name: 'ledger',
      status: srcMis !== null && mis <= srcMis ? 'WARN' : 'FAIL',
      detail:
        srcMis !== null && mis <= srcMis
          ? `${mis} wallet(s) differ from their ledger — same on the source (${srcMis}): pre-existing data (e.g. test fixtures), not caused by the restore`
          : `${mis} wallet(s) differ from their ledger${srcMis !== null ? ` (source: ${srcMis})` : ''}`,
    });
  }

  // archiving health on the source (production server)
  if (source) {
    const { rows } = await source.query<{
      mode: string;
      timeout: string;
      failed: number;
      last_failed: string | null;
      last_ok: string | null;
      age_s: number | null;
    }>(
      `SELECT current_setting('archive_mode') AS mode,
              (SELECT setting FROM pg_settings WHERE name = 'archive_timeout') AS timeout,
              failed_count::int AS failed,
              to_char(last_failed_time, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS last_failed,
              to_char(last_archived_time, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS last_ok,
              extract(epoch FROM now() - last_archived_time)::int AS age_s
         FROM pg_stat_archiver`,
    );
    const a = rows[0];
    const timeout = Number(a.timeout);
    const problems: string[] = [];
    if (a.mode !== 'on' && a.mode !== 'always') problems.push(`archive_mode=${a.mode}`);
    if (!(timeout > 0 && timeout <= MAX_ARCHIVE_TIMEOUT_S)) problems.push(`archive_timeout=${timeout}s (needs 1–${MAX_ARCHIVE_TIMEOUT_S}s)`);
    if (a.age_s === null || a.age_s > MAX_ARCHIVE_AGE_S) problems.push(`last archived WAL ${a.age_s === null ? 'never' : `${a.age_s}s ago`}`);
    if (a.last_failed && (!a.last_ok || a.last_failed > a.last_ok)) problems.push(`archiving failing since ${a.last_failed}`);
    out.push({
      name: 'archiving',
      status: problems.length ? 'FAIL' : 'PASS',
      detail: problems.length
        ? problems.join('; ')
        : `archive_mode=${a.mode}, archive_timeout=${timeout}s, last WAL archived ${a.age_s}s ago — wallet RPO ≤ ${Math.ceil(timeout / 60)} min`,
    });
  }
  return out;
}

export function overall(checks: DrCheck[]): DrStatus {
  if (checks.some((c) => c.status === 'FAIL')) return 'FAIL';
  return checks.some((c) => c.status === 'WARN') ? 'WARN' : 'PASS';
}
