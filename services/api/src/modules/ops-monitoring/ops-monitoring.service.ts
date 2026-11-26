/**
 * ops-monitoring — operational health checks and alerts (BE-3 · Phase 8). Contract: docs/api/ops-monitoring.api.md
 *
 *  GET /admin/ops/health        every check now (ADMIN)
 *  job ops-monitoring.sweep     every 5 min: run the checks; each ALERT → log line [OPS][ALERT] + notify every
 *                               active Admin (in-app + push), at most once per OPS_ALERT_REPEAT_MINUTES per check.
 *
 * Checks (runbook in docs/runbooks/):
 *   JOB_BACKLOG               shared queue backlog / dead letters (core/jobs)         → monitoring-and-alerts.md
 *   WEBHOOK_FAILURES          gateway webhooks that moved no money as intended        → payment-webhook-failure.md
 *   SOS_UNACKNOWLEDGED        SOS alerts nobody acknowledged                          → sos-response.md
 *   URGENT_DELIVERY_FAILURES  urgent push / SMS fallback that failed                  → monitoring-and-alerts.md
 *   CASH_COMMISSION_OVERDUE   overdue cash commissions (ALERT if the sweep missed one)→ cash-commission-overdue.md
 *   SETTLEMENT_LAG            transfer shifts not paid after cooling + lag            → settlement-job-monitoring.md
 *   FINANCE_HOLDS             open settlement holds / reconciliation mismatches       → deposit-and-wallet-reconciliation.md
 *   LEDGER_DRIFT              Σ wallets ≠ Σ ledger                                    → deposit-and-wallet-reconciliation.md
 *
 * A check that cannot run (Redis down, …) is UNKNOWN, never OK.
 */
import { NotificationPriority, type SystemConfigKey } from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, type Queryable } from '../../core/database';
import { jobs, type BacklogReport } from '../../core/jobs';
import { getKeyValueStore, type KeyValueStore } from '../../core/redis';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notice, Notify } from '../notifications/notifications.types';
import { alertKey, commissionStatus, countStatus, deliveryStatus, overall, webhookStatus } from './ops-monitoring.policy';
import * as repo from './ops-monitoring.repo';
import { thresholdsFromEnv, type CheckName, type CheckResult, type HealthReport, type OpsThresholds, type SweepResult } from './ops-monitoring.types';

const MIN = 60_000;
/** A check (or the Redis mark) that takes longer is UNKNOWN: a health page must answer even with Redis down. */
const CHECK_TIMEOUT_MS = 5_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export interface OpsMonitoringDeps {
  read: Queryable;
  /** core/jobs backlog; absent = JOB_BACKLOG is UNKNOWN. */
  backlog?: () => Promise<BacklogReport>;
  /** "already notified" marks; absent = notify on every sweep. */
  store?: Pick<KeyValueStore, 'setIfAbsent'>;
  notify?: Notify;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
  thresholds?: OpsThresholds;
  now?: () => number;
  /** Where [OPS][ALERT] lines go (tests capture them). */
  log?: (line: string) => void;
  checkTimeoutMs?: number;
}

export class OpsMonitoringService {
  private readonly t: OpsThresholds;

  constructor(private readonly deps: OpsMonitoringDeps) {
    this.t = deps.thresholds ?? thresholdsFromEnv();
  }

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  async health(): Promise<HealthReport> {
    const nowMs = this.nowMs();
    const checks = await Promise.all([
      this.safe('JOB_BACKLOG', 'monitoring-and-alerts.md', () => this.jobBacklog()),
      this.safe('WEBHOOK_FAILURES', 'payment-webhook-failure.md', () => this.webhookFailures(nowMs)),
      this.safe('SOS_UNACKNOWLEDGED', 'sos-response.md', () => this.sosUnacknowledged(nowMs)),
      this.safe('URGENT_DELIVERY_FAILURES', 'monitoring-and-alerts.md', () => this.urgentDeliveries(nowMs)),
      this.safe('CASH_COMMISSION_OVERDUE', 'cash-commission-overdue.md', () => this.cashCommission(nowMs)),
      this.safe('SETTLEMENT_LAG', 'settlement-job-monitoring.md', () => this.settlementLag(nowMs)),
      this.safe('FINANCE_HOLDS', 'deposit-and-wallet-reconciliation.md', () => this.financeHolds()),
      this.safe('LEDGER_DRIFT', 'deposit-and-wallet-reconciliation.md', () => this.ledgerDrift()),
    ]);
    return { status: overall(checks), checkedAt: new Date(nowMs).toISOString(), checks };
  }

  /** Job body: alert each ALERT once per repeat window (log + Admin notification). */
  async sweep(): Promise<SweepResult> {
    const report = await this.health();
    const alerts = report.checks.filter((c) => c.status === 'ALERT');
    let notified = 0;
    for (const c of alerts) {
      (this.deps.log ?? console.warn)(`[OPS][ALERT] ${JSON.stringify({ check: c.name, summary: c.summary, value: c.value, runbook: c.runbook })}`);
      const fresh = this.deps.store
        ? await withTimeout(this.deps.store.setIfAbsent(alertKey(c.name), report.checkedAt, this.t.repeatMinutes * 60), CHECK_TIMEOUT_MS).catch(() => true)
        : true;
      if (!fresh || !this.deps.notify) continue;
      const admins = await repo.activeAdminIds(this.deps.read);
      const notices: Notice[] = admins.map((userId) => ({
        userId,
        type: 'OPS_ALERT',
        priority: c.name === 'SOS_UNACKNOWLEDGED' ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
        title: `Cảnh báo vận hành: ${c.name}`,
        body: `${c.summary} — xem docs/runbooks/${c.runbook}`,
        data: { check: c.name, runbook: c.runbook },
      }));
      await sendNotices(this.deps.notify, notices);
      notified += 1;
    }
    return { status: report.status, alerts: alerts.length, notified };
  }

  // ---- checks ------------------------------------------------------------------------------------

  private async safe(name: CheckName, runbook: string, fn: () => Promise<Omit<CheckResult, 'name' | 'runbook'>>): Promise<CheckResult> {
    try {
      return { name, runbook, ...(await withTimeout(fn(), this.deps.checkTimeoutMs ?? CHECK_TIMEOUT_MS)) };
    } catch (err) {
      return { name, runbook, status: 'UNKNOWN', summary: `Check failed: ${(err as Error).message}`, value: {} };
    }
  }

  private async jobBacklog(): Promise<Omit<CheckResult, 'name' | 'runbook'>> {
    if (!this.deps.backlog) return { status: 'UNKNOWN', summary: 'Job queue not connected', value: {} };
    const r = await this.deps.backlog();
    return {
      status: r.alert ? ('ALERT' as const) : ('OK' as const),
      summary: r.alert ? `Backlog ${r.waiting} waiting, ${r.deadLetters} dead letters` : 'Job queue healthy',
      value: { waiting: r.waiting, active: r.active, delayed: r.delayed, failed: r.failed, deadLetters: r.deadLetters },
    };
  }

  private async webhookFailures(nowMs: number) {
    const rows = await repo.webhookProblems(this.deps.read, new Date(nowMs - this.t.webhookWindowMinutes * MIN));
    const total = rows.reduce((s, r) => s + r.count, 0);
    const value: Record<string, number> = { total, windowMinutes: this.t.webhookWindowMinutes };
    for (const r of rows) value[r.outcome] = r.count;
    return {
      status: webhookStatus(total, this.t),
      summary: total ? `${total} webhook(s) need a person in the last ${this.t.webhookWindowMinutes} min` : 'No webhook problems',
      value,
    };
  }

  private async sosUnacknowledged(nowMs: number) {
    const r = await repo.sosUnacknowledged(this.deps.read, new Date(nowMs - this.t.urgentWindowHours * 60 * MIN), new Date(nowMs - this.t.sosAckAlertMinutes * MIN));
    return {
      status: countStatus(r.count, 'ALERT'),
      summary: r.count ? `${r.count} SOS alert(s) unacknowledged for more than ${this.t.sosAckAlertMinutes} min` : 'No unacknowledged SOS',
      value: { count: r.count, oldest: r.oldest ? new Date(r.oldest).toISOString() : null },
    };
  }

  private async urgentDeliveries(nowMs: number) {
    const r = await repo.failedUrgentDeliveries(this.deps.read, new Date(nowMs - this.t.urgentWindowHours * 60 * MIN));
    return {
      status: deliveryStatus(r.sms, r.push),
      summary: r.sms || r.push ? `Failed urgent deliveries: ${r.sms} SMS, ${r.push} push (last ${this.t.urgentWindowHours} h)` : 'Urgent deliveries OK',
      value: { failedSms: r.sms, failedPush: r.push },
    };
  }

  private async cashCommission(nowMs: number) {
    const r = await repo.cashCommissionOverdue(this.deps.read, new Date(nowMs), new Date(nowMs - this.t.commissionSweepGraceMinutes * MIN));
    return {
      status: commissionStatus(r.overdue, r.notSuspended),
      summary: r.notSuspended
        ? `${r.notSuspended} overdue commission(s) whose nurse is still ACTIVE — the overdue sweep is not running`
        : r.overdue
          ? `${r.overdue} cash commission(s) overdue (${r.amount} VND)`
          : 'No overdue cash commission',
      value: { overdue: r.overdue, amount: r.amount, notSuspended: r.notSuspended },
    };
  }

  private async settlementLag(nowMs: number) {
    const cooling = await (this.deps.configNumber ?? getConfigNumber)('SETTLEMENT_COOLING_HOURS');
    const r = await repo.settlementLag(this.deps.read, new Date(nowMs - cooling * 60 * MIN - this.t.settlementLagMinutes * MIN));
    return {
      status: countStatus(r.count, 'ALERT'),
      summary: r.count ? `${r.count} shift(s) (${r.amount} VND) not settled ${this.t.settlementLagMinutes} min after the cooling window` : 'Settlements on time',
      value: { count: r.count, amount: r.amount, oldestCheckout: r.oldest ? new Date(r.oldest).toISOString() : null },
    };
  }

  private async financeHolds() {
    const r = await repo.financeHolds(this.deps.read);
    return {
      status: countStatus(r.holds + r.mismatches, 'WARN'),
      summary: r.holds || r.mismatches ? `${r.holds} settlement hold(s), ${r.mismatches} reconciliation mismatch(es) waiting for an Admin` : 'No finance holds',
      value: { settlementHolds: r.holds, reconciliationMismatches: r.mismatches },
    };
  }

  private async ledgerDrift() {
    const d = await repo.ledgerDrift(this.deps.read);
    const off = Object.values(d).some((v) => v !== 0);
    return {
      status: off ? ('ALERT' as const) : ('OK' as const),
      summary: off ? `Wallets differ from the ledger (escrow ${d.escrow}, available ${d.available}, deposit ${d.deposit})` : 'Wallets match the ledger',
      value: d,
    };
  }
}

let singleton: OpsMonitoringService | null = null;

export function getOpsMonitoringService(): OpsMonitoringService {
  if (!singleton) {
    singleton = new OpsMonitoringService({
      read: { query },
      backlog: () => jobs.checkBacklog(),
      store: { setIfAbsent: (key, value, ttl) => getKeyValueStore().setIfAbsent(key, value, ttl) }, // lazy: no Redis at import
      notify: notifyUser,
    });
  }
  return singleton;
}
