import { apiClient } from '../../lib/api-client';
import { downloadFromApi } from '../../lib/download';
import type { DownloadResult } from '../../lib/download';

/**
 * Đối soát tài chính (CT-15) — khớp docs/api/admin-finance.api.md. Tên trường giữ nguyên như backend (snake_case ở báo cáo,
 * camelCase ở `checks`). Số tiền là VNĐ nguyên. Kind "now" = tại thời điểm xem; "period" = trong kỳ đã chọn.
 */
export interface ReconciliationCheck {
  name: 'ESCROW_LEDGER' | 'AVAILABLE_LEDGER' | 'DEPOSIT_LEDGER';
  walletsTotal: number;
  ledgerTotal: number;
  ok: boolean;
}

export interface FinancialReconDto {
  // 5 chỉ số cốt lõi của CT-15
  total_escrow_held: number; // now
  total_commission_collected: number; // period (chuyển khoản + tiền mặt)
  total_payouts: number; // period
  total_refunds: number; // period
  pending_withdrawals: number; // now (số tiền)
  // chi tiết
  escrow_received: number;
  commission_transfer: number;
  commission_cash: number;
  deposit_withheld: number;
  withdrawals_paid: number;
  pending_withdrawals_count: number;
  deposits_held: number;
  deposit_penalties: number;
  deposit_penalty_reversals: number;
  deposit_refunds_paid: number;
  nurse_deposit_debt: number;
  cash_commission_unpaid: number;
  cash_commission_overdue: number;
  pending_deposit_refunds: number;
  open_settlement_holds: number;
  last_deposit_reconciliation: { run_date: string; status: 'OK' | 'MISMATCH'; resolved: boolean } | null;
  /** Mỗi số dư ví đối chiếu với sổ cái chỉ-ghi-thêm (append-only) */
  checks: ReconciliationCheck[];
}

/** GET /admin/finance/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD — theo ngày Việt Nam, gồm cả hai đầu, tối đa 366 ngày (400 INVALID_PERIOD). */
export function getFinancialReconciliation(from: string, to: string) {
  return apiClient<FinancialReconDto>(`/admin/finance/reconciliation?from=${from}&to=${to}`);
}

/**
 * GET /admin/finance/ledger-export — tệp CSV sổ cái (UTF-8 BOM). Quá 50.000 dòng → 413 EXPORT_TOO_LARGE.
 * MỖI LẦN XUẤT ghi `audit_logs` EXPORT_FINANCE_REPORT (kỳ, số dòng, IP).
 */
export function exportLedgerCsv(from: string, to: string): Promise<DownloadResult> {
  return downloadFromApi(`/admin/finance/ledger-export?from=${from}&to=${to}`, `ledger_${from}_${to}.csv`);
}
