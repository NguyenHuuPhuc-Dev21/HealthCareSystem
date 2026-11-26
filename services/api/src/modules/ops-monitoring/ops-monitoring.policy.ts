/**
 * ops-monitoring — pure rules (BE-3 · Phase 8): status of each check from its numbers, overall status.
 */
import type { CheckResult, CheckStatus, OpsThresholds } from './ops-monitoring.types';

const RANK: Record<CheckStatus, number> = { OK: 0, UNKNOWN: 1, WARN: 2, ALERT: 3 };

/** The worst status wins; UNKNOWN (a check could not run) is worse than OK but never hides a WARN / ALERT. */
export function overall(checks: Pick<CheckResult, 'status'>[]): CheckStatus {
  return checks.reduce<CheckStatus>((worst, c) => (RANK[c.status] > RANK[worst] ? c.status : worst), 'OK');
}

export function webhookStatus(problems: number, t: OpsThresholds): CheckStatus {
  if (problems >= t.webhookAlert) return 'ALERT';
  if (problems >= t.webhookWarn) return 'WARN';
  return 'OK';
}

/** Overdue commissions are expected (nurses pay late) → WARN; one the sweep did not act on → ALERT. */
export function commissionStatus(overdue: number, overdueNotSuspended: number): CheckStatus {
  if (overdueNotSuspended > 0) return 'ALERT';
  return overdue > 0 ? 'WARN' : 'OK';
}

export function countStatus(n: number, level: 'WARN' | 'ALERT'): CheckStatus {
  return n > 0 ? level : 'OK';
}

/** Deliveries: a failed SMS fallback means someone may not have been reached → ALERT; failed pushes alone → WARN. */
export function deliveryStatus(failedSms: number, failedPush: number): CheckStatus {
  if (failedSms > 0) return 'ALERT';
  return failedPush > 0 ? 'WARN' : 'OK';
}

/** Redis key holding "this alert was notified"; set with a TTL of the repeat window. */
export function alertKey(name: string): string {
  return `ops-alert:${name}`;
}
