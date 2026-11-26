/**
 * admin-finance — pure rules: report period (Vietnam days) and CSV encoding (BE-3 · Phase 7).
 */
import { badRequest } from '../../core/errors';
import { MAX_REPORT_DAYS, type LedgerExportRow, type Period } from './admin-finance.types';

const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD of an instant in Vietnam (UTC+7, no DST). */
export function vnDate(ms: number): string {
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of 00:00 in Vietnam on that date. */
export function vnMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - VN_OFFSET_MS);
}

function validDate(d: string): boolean {
  return DATE_RE.test(d) && vnDate(vnMidnight(d).getTime()) === d;
}

/**
 * from / to are Vietnam dates, both inclusive. Default: the current month up to today.
 * 400 for a bad date, to before from, or more than MAX_REPORT_DAYS days.
 */
export function resolvePeriod(from: string | undefined, to: string | undefined, nowMs: number): Period {
  const today = vnDate(nowMs);
  const f = from ?? `${today.slice(0, 8)}01`;
  const t = to ?? today;
  if (!validDate(f) || !validDate(t)) throw badRequest('INVALID_PERIOD', 'from / to must be dates YYYY-MM-DD');
  const fromAt = vnMidnight(f);
  const toAt = new Date(vnMidnight(t).getTime() + DAY_MS);
  const days = Math.round((toAt.getTime() - fromAt.getTime()) / DAY_MS);
  if (days < 1) throw badRequest('INVALID_PERIOD', 'to must not be before from');
  if (days > MAX_REPORT_DAYS) throw badRequest('INVALID_PERIOD', `At most ${MAX_REPORT_DAYS} days per report`);
  return { from: f, to: t, fromAt, toAt };
}

/** RFC 4180 field; a leading = + - @ is neutralised so a spreadsheet never runs it as a formula. */
export function csvField(v: unknown): string {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const LEDGER_CSV_HEADER = [
  'created_at',
  'tx_type',
  'balance_type',
  'status',
  'signed_amount',
  'balance_before',
  'balance_after',
  'user_id',
  'role',
  'booking_code',
  'idempotency_key',
  'external_ref',
];

/** One ledger row; signed_amount follows the balance (credit +, debit −). */
export function ledgerCsvLine(r: LedgerExportRow): string {
  const signed = Number(r.balance_after) - Number(r.balance_before);
  return [
    r.created_at,
    r.tx_type,
    r.balance_type,
    r.status,
    signed,
    Number(r.balance_before),
    Number(r.balance_after),
    r.user_id,
    r.role,
    r.booking_code,
    r.idempotency_key,
    r.external_ref,
  ]
    .map(csvField)
    .join(',');
}

/** UTF-8 BOM so Excel opens Vietnamese text correctly; CRLF line ends (RFC 4180). */
export function toCsv(header: string[], lines: string[]): string {
  return `﻿${[header.join(','), ...lines].join('\r\n')}\r\n`;
}
