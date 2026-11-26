/**
 * admin-finance — Admin reconciliation and finance queues (BE-3 · Phase 7 · FR-ADMIN-01 · CT-15).
 * Contract: docs/api/admin-finance.api.md
 *
 *  GET  /admin/finance/reconciliation?from&to         CT-15 totals + detail + ledger checks (FinancialReconDto)
 *  GET  /admin/finance/ledger-export?from&to           CSV audit trail of every ledger row (audited export)
 *  GET  /admin/finance/withdrawals?status               POST …/:id/approve {payoutRef} · …/:id/reject {reason}
 *  GET  /admin/finance/deposit-refunds?status           POST …/:id/payout {externalRef} · …/:id/reject {reason}
 *  GET  /admin/finance/deposit-reconciliations          POST …/:runDate/resolve {note}
 *  GET  /admin/finance/settlement-holds?open            POST …/:bookingId/resolve {note}
 *  GET  /admin/finance/nurse-debts
 *
 * Reports only read. Every action delegates to the module that owns the money (withdrawals, deposits,
 * settlements): one transaction there, audited there, nurse notified after commit.
 */
import { AuditAction, DepositRefundStatus, WithdrawalStatus } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { query, type Queryable } from '../../core/database';
import { AppError } from '../../core/errors';
import { getDepositsService, type DepositsService } from '../deposits/deposits.service';
import { getSettlementsService, type SettlementsService } from '../settlements/settlements.service';
import { getWithdrawalsService, type WithdrawalsService } from '../withdrawals/withdrawals.service';
import { LEDGER_CSV_HEADER, ledgerCsvLine, resolvePeriod, toCsv } from './admin-finance.policy';
import * as repo from './admin-finance.repo';
import {
  MAX_EXPORT_ROWS,
  MAX_LIST_ROWS,
  type AdminDepositRefundDto,
  type AdminReconciliationRunDto,
  type AdminSettlementHoldDto,
  type AdminWithdrawalDto,
  type FinancialReconDto,
  type LedgerCheck,
  type NurseDebtDto,
} from './admin-finance.types';

type Row = Record<string, any>;
const iso = (d: Date | string | null): string | null => (d ? new Date(d).toISOString() : null);
const num = (v: unknown): number => Number(v ?? 0);

export interface AdminFinanceDeps {
  read: Queryable;
  withdrawals: Pick<WithdrawalsService, 'markWithdrawn' | 'reject'>;
  deposits: Pick<DepositsService, 'payoutRefund' | 'rejectRefund' | 'resolveReconciliation'>;
  settlements: Pick<SettlementsService, 'resolveHold'>;
  now?: () => number;
}

export class AdminFinanceService {
  constructor(private readonly deps: AdminFinanceDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  // ---- reconciliation (CT-15) -----------------------------------------------------------------

  async reconciliation(from?: string, to?: string): Promise<FinancialReconDto> {
    const nowMs = this.nowMs();
    const period = resolvePeriod(from, to, nowMs);
    const [s, f, last] = await Promise.all([
      repo.snapshot(this.deps.read, new Date(nowMs)),
      repo.periodFlows(this.deps.read, period),
      repo.lastReconciliation(this.deps.read),
    ]);
    const check = (name: LedgerCheck['name'], walletsTotal: number, ledgerTotal: number): LedgerCheck => ({
      name,
      walletsTotal,
      ledgerTotal,
      ok: walletsTotal === ledgerTotal,
    });
    return {
      period: { from: period.from, to: period.to },
      generated_at: new Date(nowMs).toISOString(),
      total_escrow_held: s.escrowWallets,
      total_commission_collected: f.commissionTransfer + f.commissionCash,
      total_payouts: f.payouts,
      total_refunds: f.refunds,
      pending_withdrawals: s.pendingWithdrawals,
      escrow_received: f.escrowReceived,
      commission_transfer: f.commissionTransfer,
      commission_cash: f.commissionCash,
      deposit_withheld: f.withheld,
      withdrawals_paid: f.withdrawalsPaid,
      pending_withdrawals_count: s.pendingWithdrawalsCount,
      deposits_held: s.depositsHeld,
      deposit_penalties: f.penalties,
      deposit_penalty_reversals: f.reversals,
      deposit_refunds_paid: f.depositRefunds,
      nurse_deposit_debt: s.depositDebt,
      cash_commission_unpaid: s.cashUnpaid,
      cash_commission_overdue: s.cashOverdue,
      pending_deposit_refunds: s.pendingRefunds,
      open_settlement_holds: s.openHolds,
      last_deposit_reconciliation: last ? { run_date: last.run_date, status: last.status, resolved: last.resolved } : null,
      checks: [
        check('ESCROW_LEDGER', s.escrowWallets, s.escrowLedger),
        check('AVAILABLE_LEDGER', s.availableWallets, s.availableLedger),
        check('DEPOSIT_LEDGER', s.depositWallets, s.depositLedger),
      ],
    };
  }

  /** CSV of every ledger row in the period (the audit trail of FR-ADMIN-01). The export itself is audited. */
  async exportLedger(adminId: string, from: string | undefined, to: string | undefined, ip?: string): Promise<{ filename: string; csv: string; rows: number }> {
    const period = resolvePeriod(from, to, this.nowMs());
    const count = await repo.countLedgerRows(this.deps.read, period);
    if (count > MAX_EXPORT_ROWS) {
      throw new AppError(413, 'EXPORT_TOO_LARGE', `More than ${MAX_EXPORT_ROWS} ledger rows: export a shorter period`, { rows: count });
    }
    const rows = await repo.ledgerRows(this.deps.read, period, MAX_EXPORT_ROWS);
    await writeAuditLog(this.deps.read, {
      actorId: adminId,
      action: AuditAction.EXPORT_FINANCE_REPORT,
      targetTable: 'wallet_transactions',
      newValue: { from: period.from, to: period.to, rows: rows.length },
      ipAddress: ip,
    });
    return { filename: `ledger_${period.from}_${period.to}.csv`, csv: toCsv(LEDGER_CSV_HEADER, rows.map(ledgerCsvLine)), rows: rows.length };
  }

  // ---- withdrawals (FR-PAY-04) ------------------------------------------------------------------

  async listWithdrawals(status: string = WithdrawalStatus.WITHDRAW_REQUESTED): Promise<AdminWithdrawalDto[]> {
    return (await repo.listWithdrawals(this.deps.read, status, MAX_LIST_ROWS)).map((r: Row) => ({
      id: r.id,
      nurseId: r.nurse_id,
      nurseName: r.full_name,
      phone: r.phone,
      amount: num(r.amount),
      bankName: r.bank_name,
      bankAccountNo: r.bank_account_no,
      accountHolder: r.account_holder,
      status: r.status,
      rejectReason: r.reject_reason ?? null,
      payoutRef: r.payout_ref ?? null,
      requestedAt: iso(r.created_at)!,
      processedAt: iso(r.reviewed_at),
    }));
  }

  approveWithdrawal(adminId: string, id: string, payoutRef: string | null, ip?: string) {
    return this.deps.withdrawals.markWithdrawn(adminId, id, payoutRef, ip);
  }

  rejectWithdrawal(adminId: string, id: string, reason: string, ip?: string) {
    return this.deps.withdrawals.reject(adminId, id, reason, ip);
  }

  // ---- deposit closure refunds (ADR-0004 D3) -----------------------------------------------------

  async listDepositRefunds(status?: string): Promise<AdminDepositRefundDto[]> {
    const statuses = status ? [status] : [DepositRefundStatus.REQUESTED, DepositRefundStatus.WAITING_HOLD, DepositRefundStatus.READY];
    return (await repo.listDepositRefunds(this.deps.read, statuses, MAX_LIST_ROWS)).map((r: Row) => ({
      id: r.id,
      nurseId: r.nurse_id,
      nurseName: r.full_name,
      status: r.status,
      pendingReasons: r.pending_reasons ?? [],
      eligibleAt: iso(r.eligible_at),
      depositBalance: num(r.deposit_balance),
      refundAmount: r.refund_amount === null ? (r.status === 'READY' ? Math.max(num(r.deposit_balance), 0) : null) : num(r.refund_amount),
      bankName: r.bank_name ?? null,
      bankAccountNo: r.bank_account_no ?? null,
      accountHolder: r.account_holder ?? null,
      dueBy: iso(r.due_by),
      rejectReason: r.reject_reason ?? null,
      requestedAt: iso(r.requested_at)!,
      updatedAt: iso(r.updated_at)!,
    }));
  }

  payoutDepositRefund(adminId: string, id: string, externalRef: string | null, ip?: string) {
    return this.deps.deposits.payoutRefund(adminId, id, externalRef, ip);
  }

  rejectDepositRefund(adminId: string, id: string, reason: string, ip?: string) {
    return this.deps.deposits.rejectRefund(adminId, id, reason, ip);
  }

  // ---- holds -----------------------------------------------------------------------------------------

  async listReconciliations(): Promise<AdminReconciliationRunDto[]> {
    return (await repo.listReconciliations(this.deps.read, MAX_LIST_ROWS)).map((r: Row) => ({
      id: r.id,
      runDate: r.run_date,
      status: r.status,
      walletsTotal: num(r.wallets_total),
      ledgerTotal: num(r.ledger_total),
      custodyTotal: num(r.custody_total),
      mismatchedWallets: num(r.mismatched_wallets),
      details: r.details,
      resolvedAt: iso(r.resolved_at),
      resolutionNote: r.resolution_note ?? null,
    }));
  }

  async resolveReconciliation(adminId: string, runDate: string, note: string, ip?: string): Promise<{ resolved: true }> {
    await this.deps.deposits.resolveReconciliation(adminId, runDate, note, ip);
    return { resolved: true };
  }

  async listSettlementHolds(openOnly = true): Promise<AdminSettlementHoldDto[]> {
    return (await repo.listSettlementHolds(this.deps.read, openOnly, MAX_LIST_ROWS)).map((r: Row) => ({
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      nurseId: r.nurse_id ?? null,
      totalAmount: num(r.total_amount),
      reason: r.reason,
      detectedAt: iso(r.detected_at)!,
      resolvedAt: iso(r.resolved_at),
      resolutionNote: r.resolution_note ?? null,
    }));
  }

  async resolveSettlementHold(adminId: string, bookingId: string, note: string, ip?: string): Promise<{ resolved: true }> {
    await this.deps.settlements.resolveHold(adminId, bookingId, note, ip);
    return { resolved: true };
  }

  // ---- debts -------------------------------------------------------------------------------------------

  async listNurseDebts(): Promise<NurseDebtDto[]> {
    return (await repo.listNurseDebts(this.deps.read, new Date(this.nowMs()), MAX_LIST_ROWS)).map((r: Row) => ({
      nurseId: r.nurse_id,
      nurseName: r.full_name,
      phone: r.phone,
      profileStatus: r.profile_status,
      suspendedReason: r.suspended_reason ?? null,
      depositBalance: num(r.deposit_balance),
      depositDebt: Math.max(-num(r.deposit_balance), 0),
      unpaidCommission: num(r.unpaid),
      overdueCommission: num(r.overdue),
      unpaidCashBookings: num(r.bookings),
    }));
  }
}

let singleton: AdminFinanceService | null = null;

export function getAdminFinanceService(): AdminFinanceService {
  if (!singleton) {
    singleton = new AdminFinanceService({
      read: { query },
      withdrawals: getWithdrawalsService(),
      deposits: getDepositsService(),
      settlements: getSettlementsService(),
    });
  }
  return singleton;
}
