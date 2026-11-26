/**
 * deposits — the nurse deposit (ADR-0004 D1–D3 · FR-PAY-03 · BR-04 §2.2 · BR-12 §2.3). BE-3 · Phase 5.
 * Contract: docs/api/deposits.api.md
 *
 *  GET  /wallets/me/deposit                                DepositStatusDto (shortfall, grace, what she may accept)
 *  POST /wallets/deposit/topup-link                         VietQR link for ≤ shortfall; paid via the escrow webhook ("KQ…")
 *  GET  /wallets/deposit/topups/:id                         { status: PENDING | COMPLETED | FAILED }
 *  GET  /wallets/me/deposit/penalties                       every deduction with its reason, rule and appeal deadline
 *  POST /wallets/me/deposit/penalties/:txId/appeal          dispute PENALTY_APPEAL within PENALTY_APPEAL_DAYS
 *  GET  /wallets/me/deposit/refund-request                  latest closure → refund request (or null)
 *  POST /wallets/me/deposit/refund-request                  close the account: no new jobs; READY when the 4 conditions hold
 *  POST /wallets/me/deposit/refund-request/:id/cancel       only before READY
 *  GET/PUT /nurse/bank-account                              registered payout account
 *  job  deposits.reconciliation        daily 01:30 — mirror ledger vs custody; MISMATCH freezes refund payouts
 *  job  deposits.refund-eligibility    daily 02:15 — REQUESTED/WAITING_HOLD → READY (+ due date) or WAITING_HOLD
 *  Admin (Phase 7 admin-finance mounts the routes): payoutRefund, rejectRefund, resolveReconciliation
 */
import { randomBytes } from 'node:crypto';
import {
  AuditAction,
  DepositRefundStatus,
  TxStatus,
  TxType,
  type AppealPenaltyRequest,
  type BankAccountDto,
  type DepositPenaltyDto,
  type DepositRefundRequestDto,
  type DepositStatusDto,
  type DepositTopupLinkDto,
  type PenaltyReason,
  type SystemConfigKey,
} from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, notFound } from '../../core/errors';
import { signData, vietQrImageUrl } from '../gateway-webhooks/gateway-webhooks.policy';
import { getGatewayWebhooksService, simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import type { ReceivingAccount } from '../gateway-webhooks/gateway-webhooks.types';
import { depositGraceActive } from '../wallets-ledger/wallets-ledger.policy';
import { lockNurseWallet, postNurseEntry } from '../wallets-ledger/wallets-ledger.ledger';
import { findWallet } from '../wallets-ledger/wallets-ledger.repo';
import { depositLedgerKeys } from './deposits.ledger';
import {
  addWorkingDays,
  appealError,
  makePaymentCode,
  maskAccount,
  refundEligibility,
  shortfallOf,
  topupAmountError,
  vnDateString,
} from './deposits.policy';
import * as repo from './deposits.repo';
import { depositRefundStatus } from '../notifications/notifications.notices';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notify } from '../notifications/notifications.types';
import {
  MAX_RECONCILIATION_DETAILS,
  PENALTY_APPEAL_REASON_CODE,
  type BankAccountRow,
  type ReconciliationResult,
  type RefundRequestRow,
  type RefundSweepResult,
} from './deposits.types';

const UNIQUE_VIOLATION = '23505';
const OPEN_REFUND_STATUSES = new Set(['REQUESTED', 'WAITING_HOLD']);

export interface CustodyAccount extends ReceivingAccount {
  partnerName: string;
}

export interface DepositsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  /** Account at the custody partner that receives deposit top-ups (ADR-0004 D1); null = not configured. */
  custodyAccount: () => CustodyAccount | null;
  /**
   * Total held at the custody partner on its statement. null = simulated custody (demo scope, ADR-0004 D1):
   * the statement IS the mirror ledger.
   */
  custodyStatementTotal?: () => Promise<number | null>;
  /** Dev simulator: signs and runs the escrow webhook for (orderCode, amount, reference). Absent = disabled. */
  deliverWebhook?: (orderCode: string, amount: number, reference: string) => Promise<unknown>;
  now?: () => number;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
  random?: (n: number) => Uint8Array;
  /** notifications (Phase 6): DEPOSIT_REFUND_STATUS after commit (ADR-0004: every change is notified). */
  notify?: Notify;
}

export class DepositsService {
  constructor(private readonly deps: DepositsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private cfg = (key: SystemConfigKey): Promise<number> => (this.deps.configNumber ?? getConfigNumber)(key);

  // ---- status ------------------------------------------------------------------

  async getStatus(nurseId: string): Promise<DepositStatusDto> {
    const nowMs = this.nowMs();
    const [wallet, minDeposit, graceMaxShifts, withholdRate] = await Promise.all([
      findWallet(this.deps.read, nurseId),
      this.cfg('MIN_NURSE_DEPOSIT'),
      this.cfg('DEPOSIT_GRACE_MAX_SHIFTS'),
      this.cfg('DEPOSIT_WITHHOLD_RATE'),
    ]);
    const balance = Number(wallet?.deposit_balance ?? 0);
    const full = balance >= minDeposit;
    const grace = depositGraceActive(wallet, { minDeposit, graceMaxShifts }, nowMs);
    const closing = !!wallet?.closure_requested_at;
    return {
      depositBalance: balance,
      minDeposit,
      shortfall: shortfallOf(balance, minDeposit),
      grace: {
        active: grace,
        shiftsUsed: Number(wallet?.deposit_grace_shifts_used ?? 0),
        maxShifts: graceMaxShifts,
        expiresAt: wallet?.deposit_grace_expires_at ? new Date(wallet.deposit_grace_expires_at).toISOString() : null,
        withholdRate,
      },
      canAcceptCash: full && !closing,
      canAcceptTransfer: (full || grace) && !closing,
      custodyPartnerName: this.deps.custodyAccount()?.partnerName,
    };
  }

  // ---- top-up ------------------------------------------------------------------

  async createTopupLink(nurseId: string, amount: number): Promise<DepositTopupLinkDto> {
    const acc = this.deps.custodyAccount();
    if (!acc) throw new AppError(503, 'CUSTODY_NOT_CONFIGURED', 'Deposit top-up is not available right now');
    const nowMs = this.nowMs();
    const [minDeposit, timeoutMinutes] = await Promise.all([this.cfg('MIN_NURSE_DEPOSIT'), this.cfg('PAYMENT_TIMEOUT_MINUTES')]);

    const created = await this.deps.withTx(async (db) => {
      const wallet = await lockNurseWallet(db, nurseId);
      if (wallet.closure_requested_at) throw conflict('ACCOUNT_CLOSING', 'The account is being closed');
      const shortfall = shortfallOf(Number(wallet.deposit_balance), minDeposit);
      const err = topupAmountError(amount, shortfall);
      if (err === 'DEPOSIT_FULL') throw conflict('DEPOSIT_FULL', 'The deposit is already full');
      if (err) throw new AppError(400, err, 'A top-up may not exceed what is missing to the minimum deposit', { shortfall });
      await repo.expirePendingTopups(db, nurseId);
      const paymentCode = makePaymentCode((this.deps.random ?? randomBytes)(12));
      const expiresAt = new Date(nowMs + timeoutMinutes * 60_000);
      const id = await repo.insertTopup(db, { walletId: wallet.id, nurseId, amount, paymentCode, expiresAt });
      return { id, paymentCode, expiresAt };
    });

    return {
      topupId: created.id,
      amount,
      qrImageUrl: vietQrImageUrl(acc, amount, created.paymentCode) ?? '',
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
      transferContent: created.paymentCode,
      expiresAt: created.expiresAt.toISOString(),
    };
  }

  async getTopupStatus(nurseId: string, topupId: string): Promise<{ status: TxStatus }> {
    const t = await repo.findTopupForNurse(this.deps.read, nurseId, topupId);
    if (!t) throw notFound('TOPUP_NOT_FOUND', 'Top-up not found');
    if (t.status === 'COMPLETED') return { status: TxStatus.COMPLETED };
    if (t.status === 'PENDING' && new Date(t.expires_at).getTime() > this.nowMs()) return { status: TxStatus.PENDING };
    return { status: TxStatus.FAILED }; // expired, replaced by a newer link, or returned
  }

  /**
   * Dev / demo only (PAYMENT_SIMULATOR_ENABLED=true, never in production): the gateway webhook a successful transfer
   * of this top-up would send, signed and run through the real handler.
   */
  async simulateTopupPayment(nurseId: string, topupId: string): Promise<unknown> {
    if (!this.deps.deliverWebhook) throw notFound('NOT_FOUND', 'Not found');
    const t = await repo.findTopupForNurse(this.deps.read, nurseId, topupId);
    if (!t) throw notFound('TOPUP_NOT_FOUND', 'Top-up not found');
    return this.deps.deliverWebhook(t.payment_code, Number(t.amount), `SIM-${t.payment_code}-${this.nowMs()}`);
  }

  // ---- penalties ---------------------------------------------------------------

  async listPenalties(nurseId: string): Promise<DepositPenaltyDto[]> {
    const rows = await repo.listPenalties(this.deps.read, nurseId);
    return rows.map((r) => ({
      transactionId: r.transaction_id,
      amount: Number(r.amount),
      reason: r.reason as PenaltyReason,
      slaRuleRef: r.sla_rule_ref,
      bookingId: r.booking_id ?? undefined,
      bookingCode: r.booking_code ?? undefined,
      disputeId: r.dispute_id ?? undefined,
      note: r.note ?? undefined,
      createdAt: new Date(r.created_at).toISOString(),
      appealDeadline: r.appeal_deadline ? new Date(r.appeal_deadline).toISOString() : null,
      appealDisputeId: r.appeal_dispute_id ?? undefined,
      reversed: r.reversed,
    }));
  }

  async appealPenalty(nurseId: string, transactionId: string, body: AppealPenaltyRequest): Promise<{ disputeId: string }> {
    const nowMs = this.nowMs();
    try {
      return await this.deps.withTx(async (db) => {
        const p = await repo.findPenalty(db, nurseId, transactionId);
        if (!p) throw notFound('PENALTY_NOT_FOUND', 'Penalty not found');
        const err = appealError(p, nowMs);
        if (err) throw conflict(err, 'This penalty cannot be appealed');
        const disputeId = await repo.insertAppeal(db, {
          transactionId,
          nurseId,
          bookingId: p.booking_id!,
          reasonCode: PENALTY_APPEAL_REASON_CODE,
          description: body.reason.trim(),
          evidence: body.evidenceKeys ?? [],
        });
        return { disputeId };
      });
    } catch (e) {
      if ((e as { code?: string }).code === UNIQUE_VIOLATION) throw conflict('ALREADY_APPEALED', 'This penalty cannot be appealed');
      throw e;
    }
  }

  // ---- bank account --------------------------------------------------------------

  async getBankAccount(nurseId: string): Promise<BankAccountDto | null> {
    const a = await repo.findBankAccount(this.deps.read, nurseId);
    return a ? toBankDto(a) : null;
  }

  async setBankAccount(nurseId: string, a: BankAccountRow): Promise<BankAccountDto> {
    await repo.upsertBankAccount(this.deps.read, nurseId, a);
    return toBankDto(a);
  }

  // ---- closure → refund ------------------------------------------------------------

  async getRefundRequest(nurseId: string): Promise<DepositRefundRequestDto | null> {
    const wallet = await findWallet(this.deps.read, nurseId);
    if (!wallet) return null;
    const r = await repo.findLatestRefundRequest(this.deps.read, wallet.id);
    return r ? toRefundDto(r, Number(wallet.deposit_balance)) : null;
  }

  async requestClosure(nurseId: string): Promise<DepositRefundRequestDto> {
    const at = new Date(this.nowMs());
    const id = await this.deps.withTx(async (db) => {
      const wallet = await lockNurseWallet(db, nurseId);
      if (await repo.findOpenRefundRequest(db, wallet.id)) throw conflict('REFUND_REQUEST_EXISTS', 'An account closure is already in progress');
      const bank = await repo.findBankAccount(db, nurseId);
      if (!bank) throw conflict('BANK_ACCOUNT_REQUIRED', 'Register a bank account to receive the deposit refund');
      const requestId = await repo.insertRefundRequest(db, wallet.id, bank, at);
      await repo.setClosureRequested(db, wallet.id, at); // no new jobs from now on (matching gate)
      return requestId;
    });
    await this.evaluateRefund(id);
    return (await this.getRefundRequest(nurseId))!;
  }

  async cancelRefundRequest(nurseId: string, requestId: string): Promise<{ success: boolean }> {
    const at = new Date(this.nowMs());
    await this.deps.withTx(async (db) => {
      const r = await repo.lockRefundRequest(db, requestId);
      if (!r || r.user_id !== nurseId) throw notFound('REFUND_REQUEST_NOT_FOUND', 'Refund request not found');
      if (!OPEN_REFUND_STATUSES.has(r.status)) throw conflict('REFUND_NOT_CANCELLABLE', 'The request can no longer be cancelled');
      await repo.setRefundStatus(db, r.id, { status: 'CANCELLED', at });
      await repo.setClosureRequested(db, r.wallet_id, null);
    });
    return { success: true };
  }

  /** REQUESTED / WAITING_HOLD → READY (with payout due date) or WAITING_HOLD (with what is still pending). */
  async evaluateRefund(requestId: string): Promise<'READY' | 'WAITING_HOLD' | 'SKIPPED'> {
    const nowMs = this.nowMs();
    const [holdDays, slaDays] = await Promise.all([this.cfg('DEPOSIT_REFUND_HOLD_DAYS'), this.cfg('DEPOSIT_REFUND_SLA_WORKING_DAYS')]);
    const out = await this.deps.withTx(async (db): Promise<{ status: 'READY' | 'WAITING_HOLD' | 'SKIPPED'; nurseId?: string; changed?: boolean }> => {
      const r = await repo.lockRefundRequest(db, requestId);
      if (!r || !OPEN_REFUND_STATUSES.has(r.status)) return { status: 'SKIPPED' };
      const e = refundEligibility(await repo.refundFacts(db, r.user_id), holdDays, nowMs);
      const at = new Date(nowMs);
      if (e.pendingReasons.length > 0) {
        await repo.saveRefundEvaluation(db, r.id, { status: 'WAITING_HOLD', pending: e.pendingReasons, eligibleAt: e.eligibleAt, refundAmount: null, dueBy: null, at });
        return { status: 'WAITING_HOLD', nurseId: r.user_id, changed: r.status !== 'WAITING_HOLD' };
      }
      const wallet = await lockNurseWallet(db, r.user_id);
      // Enough calendar room for N working days even across Tết.
      const holidays = await repo.holidaysBetween(db, vnDateString(nowMs), vnDateString(nowMs + (slaDays * 3 + 14) * 86_400_000));
      await repo.saveRefundEvaluation(db, r.id, {
        status: 'READY',
        pending: [],
        eligibleAt: at,
        refundAmount: Math.max(Number(wallet.deposit_balance), 0),
        dueBy: addWorkingDays(nowMs, slaDays, holidays),
        at,
      });
      return { status: 'READY', nurseId: r.user_id, changed: true };
    });
    // Only a change of status is notified: the daily sweep re-evaluates WAITING_HOLD requests.
    if (out.nurseId && out.changed && out.status !== 'SKIPPED') {
      await sendNotices(this.deps.notify, [depositRefundStatus(out.nurseId, { requestId, status: out.status })]);
    }
    return out.status;
  }

  async runRefundEligibilitySweep(): Promise<RefundSweepResult> {
    const ids = await repo.listOpenRefundRequestIds(this.deps.read);
    const out: RefundSweepResult = { ready: 0, waiting: 0, failed: 0 };
    for (const id of ids) {
      try {
        const s = await this.evaluateRefund(id);
        if (s === 'READY') out.ready += 1;
        if (s === 'WAITING_HOLD') out.waiting += 1;
      } catch (err) {
        out.failed += 1;
        console.error(`[deposits] refund request ${id} could not be evaluated:`, err);
      }
    }
    return out;
  }

  /** Admin: pay a READY refund (one DEPOSIT_REFUND row with the custody partner reference). Frozen by a reconciliation mismatch. */
  async payoutRefund(adminId: string, requestId: string, externalRef: string | null, ip?: string): Promise<DepositRefundRequestDto> {
    const at = new Date(this.nowMs());
    const paid = await this.deps.withTx(async (db) => {
      if (await repo.hasUnresolvedMismatch(db)) {
        throw conflict('RECONCILIATION_MISMATCH', 'Deposit payouts are frozen until the reconciliation mismatch is resolved');
      }
      const r = await repo.lockRefundRequest(db, requestId);
      if (!r) throw notFound('REFUND_REQUEST_NOT_FOUND', 'Refund request not found');
      if (r.status !== DepositRefundStatus.READY) throw conflict('REFUND_NOT_READY', 'Only a READY request can be paid');
      const wallet = await lockNurseWallet(db, r.user_id);
      const amount = Math.max(Number(wallet.deposit_balance), 0);
      if (amount === 0) throw conflict('NOTHING_TO_REFUND', 'The deposit is empty or in debt: reject the request with a reason');
      const posted = await postNurseEntry(db, {
        userId: r.user_id,
        bookingId: null,
        txType: TxType.DEPOSIT_REFUND,
        balance: 'DEPOSIT',
        delta: -amount,
        idempotencyKey: depositLedgerKeys.refund(r.id),
        externalRef,
      });
      if (!posted) throw conflict('REFUND_ALREADY_PAID', 'This refund was already paid');
      await repo.setRefundStatus(db, r.id, { status: 'REFUNDED', at, reviewedBy: adminId, transactionId: posted.transactionId, refundAmount: amount });
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.PROCESS_DEPOSIT_REFUND,
        targetTable: 'deposit_refund_requests',
        targetId: r.id,
        oldValue: { status: r.status },
        newValue: { status: 'REFUNDED', amount, nurseId: r.user_id, externalRef, transactionId: posted.transactionId },
        ipAddress: ip,
      });
      return { nurseId: r.user_id, amount };
    });
    await sendNotices(this.deps.notify, [depositRefundStatus(paid.nurseId, { requestId, status: 'REFUNDED', amount: paid.amount })]);
    return (await this.getRefundRequest(paid.nurseId))!;
  }

  /** Admin: reject with a written reason (e.g. bank account mismatch). The money is never forfeited. */
  async rejectRefund(adminId: string, requestId: string, reason: string, ip?: string): Promise<DepositRefundRequestDto> {
    const text = reason.trim();
    if (text.length < 10) throw badRequest('VALIDATION_ERROR', 'A rejection needs a written reason');
    const at = new Date(this.nowMs());
    const nurseId = await this.deps.withTx(async (db) => {
      const r = await repo.lockRefundRequest(db, requestId);
      if (!r) throw notFound('REFUND_REQUEST_NOT_FOUND', 'Refund request not found');
      if (!['REQUESTED', 'WAITING_HOLD', 'READY'].includes(r.status)) throw conflict('REFUND_NOT_OPEN', 'The request is already closed');
      await repo.setRefundStatus(db, r.id, { status: 'REJECTED', at, reviewedBy: adminId, rejectReason: text });
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.PROCESS_DEPOSIT_REFUND,
        targetTable: 'deposit_refund_requests',
        targetId: r.id,
        oldValue: { status: r.status },
        newValue: { status: 'REJECTED', nurseId: r.user_id, reason: text },
        ipAddress: ip,
      });
      return r.user_id;
    });
    await sendNotices(this.deps.notify, [depositRefundStatus(nurseId, { requestId, status: 'REJECTED', reason: text })]);
    return (await this.getRefundRequest(nurseId))!;
  }

  // ---- reconciliation (ADR-0004 D1) ----------------------------------------------------

  async runReconciliation(): Promise<ReconciliationResult> {
    const nowMs = this.nowMs();
    const db = this.deps.read;
    const totals = await repo.depositTotals(db);
    const mismatch = await repo.mismatchedDepositWallets(db, MAX_RECONCILIATION_DETAILS);
    const walletsTotal = Number(totals.wallets_total);
    const ledgerTotal = Number(totals.ledger_total);
    const statement = this.deps.custodyStatementTotal ? await this.deps.custodyStatementTotal() : null;
    const custodyTotal = statement ?? ledgerTotal;
    const status = mismatch.count === 0 && walletsTotal === ledgerTotal && custodyTotal === ledgerTotal ? 'OK' : 'MISMATCH';
    const runDate = vnDateString(nowMs);
    await repo.upsertReconciliation(db, {
      runDate,
      walletsTotal,
      ledgerTotal,
      custodyTotal,
      mismatched: mismatch.count,
      status,
      details: mismatch.sample,
    });
    return { runDate, status, walletsTotal, ledgerTotal, custodyTotal, mismatchedWallets: mismatch.count };
  }

  /** Admin: a mismatch was explained / corrected — payouts resume. */
  async resolveReconciliation(adminId: string, runDate: string, note: string, ip?: string): Promise<void> {
    const text = note.trim();
    if (text.length < 10) throw badRequest('VALIDATION_ERROR', 'Explain how the mismatch was resolved');
    const at = new Date(this.nowMs());
    await this.deps.withTx(async (db) => {
      const id = await repo.resolveReconciliation(db, runDate, adminId, text, at);
      if (!id) throw notFound('RECONCILIATION_NOT_FOUND', 'No open mismatch for that date');
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.RESOLVE_FINANCE_HOLD,
        targetTable: 'deposit_reconciliations',
        targetId: id,
        oldValue: { status: 'MISMATCH', resolved: false },
        newValue: { resolved: true, runDate, note: text },
        ipAddress: ip,
      });
    });
  }
}

function toBankDto(a: BankAccountRow): BankAccountDto {
  return { bankName: a.bank_name, accountMasked: maskAccount(a.account_no), accountHolder: a.account_holder };
}

function toRefundDto(r: RefundRequestRow, depositBalance: number): DepositRefundRequestDto {
  const paid = r.status === 'REFUNDED';
  const ready = r.status === 'READY';
  return {
    id: r.id,
    status: r.status as DepositRefundStatus,
    pendingReasons: r.pending_reasons ?? [],
    eligibleAt: r.eligible_at ? new Date(r.eligible_at).toISOString() : null,
    refundAmount: paid || ready ? (paid ? Number(r.refund_amount ?? 0) : Math.max(depositBalance, 0)) : null,
    debtAmount: Math.max(-depositBalance, 0),
    bankAccount: {
      bankName: r.bank_name ?? '',
      accountMasked: r.bank_account_no ? maskAccount(r.bank_account_no) : '',
      accountHolder: r.account_holder ?? '',
    },
    dueBy: r.due_by ? new Date(r.due_by).toISOString() : null,
    rejectReason: r.reject_reason ?? undefined,
    requestedAt: new Date(r.requested_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** Custody account from env (DEPOSIT_CUSTODY_*); the sandbox falls back to the payment receiving account. */
export function custodyAccountFromEnv(env: NodeJS.ProcessEnv = process.env): CustodyAccount | null {
  const pick = (k: string) => env[k]?.trim() || undefined;
  const bankBin = pick('DEPOSIT_CUSTODY_BANK_BIN') ?? pick('PAYMENT_RECEIVING_BANK_BIN');
  const bankName = pick('DEPOSIT_CUSTODY_BANK_NAME') ?? pick('PAYMENT_RECEIVING_BANK_NAME');
  const accountNumber = pick('DEPOSIT_CUSTODY_ACCOUNT_NO') ?? pick('PAYMENT_RECEIVING_ACCOUNT_NO');
  const accountName = pick('DEPOSIT_CUSTODY_ACCOUNT_NAME') ?? pick('PAYMENT_RECEIVING_ACCOUNT_NAME');
  const partnerName = pick('DEPOSIT_CUSTODY_PARTNER_NAME') ?? 'Ngân hàng đối tác lưu ký (mô phỏng)';
  return bankBin && bankName && accountNumber && accountName ? { bankBin, bankName, accountNumber, accountName, partnerName } : null;
}

let singleton: DepositsService | null = null;

export function getDepositsService(): DepositsService {
  if (!singleton) {
    singleton = new DepositsService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      custodyAccount: () => custodyAccountFromEnv(),
      notify: notifyUser,
      deliverWebhook: simulatorEnabled()
        ? (orderCode, amount, reference) => {
            const data = { orderCode, amount, reference, description: orderCode, transactionDateTime: new Date().toISOString() };
            const secret = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? '';
            return getGatewayWebhooksService().handleEscrowWebhook({ code: '00', desc: 'success', success: true, data, signature: signData(data, secret) });
          }
        : undefined,
    });
  }
  return singleton;
}
