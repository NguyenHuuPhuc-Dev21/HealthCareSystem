/**
 * Mock đối soát tài chính — khớp docs/api/admin-finance.api.md:
 *   GET /admin/finance/reconciliation?from&to   → báo cáo (số theo kỳ tỉ lệ với số ngày; "now" cố định)
 *   GET /admin/finance/ledger-export?from&to    → CSV sổ cái (400 INVALID_PERIOD, 413 EXPORT_TOO_LARGE khi kỳ > 90 ngày trong mock)
 * Để thử trạng thái LỆCH sổ cái: trong Console chạy  localStorage.setItem('mock_finance_mismatch', '1')  (xoá để trở lại bình thường).
 */

import { fail, ok } from './mock-fetch';
import type { MockHandler } from './mock-fetch';

const DAY = 86_400_000;
const hasToken = (h: Headers) => (h.get('Authorization') ?? '').startsWith('Bearer ');
const unauthorized = () => fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập đã hết hạn');

function parsePeriod(from: string | null, to: string | null) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !re.test(from) || !re.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const days = Math.round((b - a) / DAY) + 1;
  return days > 366 ? null : { days, a, b };
}

const mismatch = () => {
  try {
    return localStorage.getItem('mock_finance_mismatch') === '1';
  } catch {
    return false;
  }
};

export const financeHandlers: Record<string, MockHandler> = {
  'GET /api/v1/admin/finance/reconciliation': (_b, { headers, query }) => {
    if (!hasToken(headers)) return unauthorized();
    const p = parsePeriod(query.get('from'), query.get('to'));
    if (!p) return fail(400, 'INVALID_PERIOD', 'Kỳ báo cáo không hợp lệ (từ ≤ đến, tối đa 366 ngày).');
    const d = p.days;
    const commissionTransfer = 640_000 * d;
    const commissionCash = 180_000 * d;
    const bad = mismatch();
    return ok({
      total_escrow_held: 18_450_000,
      total_commission_collected: commissionTransfer + commissionCash,
      total_payouts: 3_620_000 * d,
      total_refunds: 410_000 * d,
      pending_withdrawals: 5_200_000,
      escrow_received: 4_870_000 * d,
      commission_transfer: commissionTransfer,
      commission_cash: commissionCash,
      deposit_withheld: 215_000 * d,
      withdrawals_paid: 2_400_000 * d,
      pending_withdrawals_count: 4,
      deposits_held: 61_800_000,
      deposit_penalties: 150_000 * Math.ceil(d / 3),
      deposit_penalty_reversals: 50_000 * Math.ceil(d / 10),
      deposit_refunds_paid: 600_000 * Math.ceil(d / 15),
      nurse_deposit_debt: 120_000,
      cash_commission_unpaid: 1_350_000,
      cash_commission_overdue: 270_000,
      pending_deposit_refunds: 2,
      open_settlement_holds: bad ? 1 : 0,
      last_deposit_reconciliation: { run_date: new Date(p.b).toISOString().slice(0, 10), status: bad ? 'MISMATCH' : 'OK', resolved: !bad },
      checks: [
        { name: 'ESCROW_LEDGER', walletsTotal: 18_450_000, ledgerTotal: 18_450_000, ok: true },
        { name: 'AVAILABLE_LEDGER', walletsTotal: 9_735_000, ledgerTotal: 9_735_000, ok: true },
        { name: 'DEPOSIT_LEDGER', walletsTotal: 61_680_000, ledgerTotal: bad ? 61_560_000 : 61_680_000, ok: !bad },
      ],
    });
  },

  'GET /api/v1/admin/finance/ledger-export': (_b, { headers, query }) => {
    if (!hasToken(headers)) return unauthorized();
    const from = query.get('from');
    const to = query.get('to');
    const p = parsePeriod(from, to);
    if (!p) return fail(400, 'INVALID_PERIOD', 'Kỳ báo cáo không hợp lệ.');
    if (p.days > 90) return fail(413, 'EXPORT_TOO_LARGE', 'Quá nhiều dòng để xuất (tối đa 50.000). Hãy chọn kỳ ngắn hơn.');
    const rows = [
      'created_at,tx_type,balance_type,status,signed_amount,balance_before,balance_after,user_id,role,booking_code,idempotency_key,external_ref',
      `${from}T03:12:44Z,ESCROW_HOLD,ESCROW,COMPLETED,500000,0,500000,u-patient-1,PATIENT,HC-261110-AB12CD,gw-9f2a1,PAYOS-7781`,
      `${from}T09:41:02Z,SETTLEMENT,AVAILABLE,COMPLETED,425000,0,425000,n-0001,NURSE,HC-261110-AB12CD,settle-HC-261110-AB12CD,`,
      `${to}T10:02:11Z,COMMISSION,PLATFORM,COMPLETED,75000,0,75000,n-0001,NURSE,HC-261110-AB12CD,settle-HC-261110-AB12CD:fee,`,
    ];
    return { status: 200, body: '﻿' + rows.join('\r\n'), filename: `ledger_${from}_${to}.csv` };
  },
};
