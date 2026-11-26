/**
 * ops-monitoring — types and operational thresholds (BE-3 · Phase 8 · operational monitoring & alerting).
 * Thresholds are operational (how noisy the alerts are), not business rules: they live here with an env override,
 * not in system_configs.
 */

export type CheckStatus = 'OK' | 'WARN' | 'ALERT' | 'UNKNOWN';

export type CheckName =
  | 'JOB_BACKLOG'
  | 'WEBHOOK_FAILURES'
  | 'SOS_UNACKNOWLEDGED'
  | 'URGENT_DELIVERY_FAILURES'
  | 'CASH_COMMISSION_OVERDUE'
  | 'SETTLEMENT_LAG'
  | 'FINANCE_HOLDS'
  | 'LEDGER_DRIFT';

export interface CheckResult {
  name: CheckName;
  status: CheckStatus;
  /** One line for the Admin / the log. */
  summary: string;
  /** The numbers behind it. */
  value: Record<string, number | string | null>;
  /** docs/runbooks/<file> to follow. */
  runbook: string;
}

export interface HealthReport {
  status: CheckStatus;
  checkedAt: string;
  checks: CheckResult[];
}

export interface SweepResult {
  status: CheckStatus;
  alerts: number;
  notified: number;
}

/** Webhook outcomes that need a person (money did not move as intended, or a code matched nothing). */
export const WEBHOOK_PROBLEM_OUTCOMES = [
  'AMOUNT_MISMATCH',
  'NOT_TRANSFER_BOOKING',
  'UNKNOWN_BOOKING',
  'UNKNOWN_EXTENSION',
  'UNKNOWN_SURCHARGE',
  'UNKNOWN_COMMISSION',
] as const;

/**
 * Notification types of an SOS (FR-SHIFT-05). The sos module sends them with priority HIGH; any of them still
 * unacknowledged after OPS_SOS_ACK_ALERT_MINUTES is an alert.
 */
export const SOS_NOTIFICATION_TYPES = ['SOS', 'SOS_ALERT'] as const;

const envInt = (name: string, fallback: number): number => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.trunc(v) : fallback;
};

export interface OpsThresholds {
  /** Look-back for webhook problems (minutes). */
  webhookWindowMinutes: number;
  /** Problems in the window: ≥ warn → WARN, ≥ alert → ALERT. */
  webhookWarn: number;
  webhookAlert: number;
  /** An SOS unacknowledged this long is an ALERT (the SMS fallback fires at 60 s). */
  sosAckAlertMinutes: number;
  /** Look-back for urgent alerts / failed deliveries (hours). */
  urgentWindowHours: number;
  /** Overdue cash commission still not suspended after this many minutes → the sweep is not running. */
  commissionSweepGraceMinutes: number;
  /** A transfer shift still unpaid this many minutes after the cooling window → the settlement sweep is stuck. */
  settlementLagMinutes: number;
  /** The same alert is notified again at most this often. */
  repeatMinutes: number;
}

export function thresholdsFromEnv(): OpsThresholds {
  return {
    webhookWindowMinutes: envInt('OPS_WEBHOOK_WINDOW_MINUTES', 60),
    webhookWarn: envInt('OPS_WEBHOOK_WARN', 1),
    webhookAlert: envInt('OPS_WEBHOOK_ALERT', 3),
    sosAckAlertMinutes: envInt('OPS_SOS_ACK_ALERT_MINUTES', 2),
    urgentWindowHours: envInt('OPS_URGENT_WINDOW_HOURS', 24),
    commissionSweepGraceMinutes: envInt('OPS_COMMISSION_SWEEP_GRACE_MINUTES', 15),
    settlementLagMinutes: envInt('OPS_SETTLEMENT_LAG_MINUTES', 120),
    repeatMinutes: envInt('OPS_ALERT_REPEAT_MINUTES', 60),
  };
}

export const OPS_SWEEP_JOB = 'ops-monitoring.sweep';
export const OPS_SWEEP_EVERY_MS = 5 * 60_000;
