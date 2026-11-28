/**
 * withdrawals — the nurse takes money out of her available balance. BE-3 · Phase 5 · FR-PAY-04.
 * Contract: docs/api/withdrawals.api.md
 *
 *  POST /wallets/withdraw        { amount } (+ Idempotency-Key header) → WITHDRAW_REQUESTED.
 *                                The money leaves available_balance at once (one WITHDRAW ledger row), so it cannot
 *                                be spent twice while the Admin processes the transfer. amount > available → 400.
 *  GET  /wallets/withdrawals     the nurse's requests, newest first.
 *  Admin (admin-finance, Phase 7 mounts the routes):
 *    markWithdrawn   transfer done → WITHDRAWN (+ payout reference)
 *    reject          written reason → REJECTED; the money comes back to available_balance (one REFUND credit)
 * Only available_balance is ever withdrawn: the deposit and escrow are never touched here.
 */
import { randomUUID } from 'node:crypto';
import { AuditAction, TxType, WithdrawalStatus, type WithdrawalDto } from '@healthcare-system/shared';
import { writeAuditLog } from '../../core/audit';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, notFound } from '../../core/errors';
import { findBankAccount } from '../deposits/deposits.repo';
import { InsufficientBalanceError, lockNurseWallet, postNurseEntry } from '../wallets-ledger/wallets-ledger.ledger';
import { withdrawalUpdate } from '../notifications/notifications.notices';
import { notifyUser, sendNotices } from '../notifications/notifications.service';
import type { Notify } from '../notifications/notifications.types';
import * as repo from './withdrawals.repo';
import type { WithdrawalRow, WithdrawResult } from './withdrawals.types';

/** Operational limit of the history list (not a business number). */
export const MAX_WITHDRAWALS_LISTED = 100;

export const withdrawalKeys = {
  /** Namespaced per nurse: one client's key can never reach another nurse's withdrawal. */
  request: (nurseId: string, clientKey: string) => `withdraw:${nurseId}:${clientKey}`,
  reversal: (withdrawalId: string) => `withdraw-reversal:${withdrawalId}`,
};

export interface WithdrawalsDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
  /** notifications (Phase 6): WITHDRAWAL_UPDATE after commit. Absent = none. */
  notify?: Notify;
}

export class WithdrawalsService {
  constructor(private readonly deps: WithdrawalsDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  async requestWithdrawal(nurseId: string, amount: number, clientKey?: string): Promise<WithdrawResult> {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw badRequest('INVALID_AMOUNT', 'The amount must be a positive whole number of VND');
    const key = withdrawalKeys.request(nurseId, clientKey ?? randomUUID());
    const at = new Date(this.nowMs());
    const row = await this.deps.withTx(async (db) => {
      const wallet = await lockNurseWallet(db, nurseId); // serializes concurrent requests of this nurse
      const existing = await repo.findByIdempotencyKey(db, key);
      if (existing) return existing; // retried request: same withdrawal, money taken once
      const bank = await findBankAccount(db, nurseId);
      if (!bank) throw conflict('BANK_ACCOUNT_REQUIRED', 'Register a bank account before withdrawing');
      const available = Number(wallet.available_balance);
      if (amount > available) {
        throw new AppError(400, 'INSUFFICIENT_BALANCE', 'The amount exceeds the available balance', { available });
      }
      try {
        const posted = await postNurseEntry(db, {
          userId: nurseId,
          bookingId: null,
          txType: TxType.WITHDRAW,
          balance: 'AVAILABLE',
          delta: -amount,
          idempotencyKey: key,
          externalRef: null,
        });
        return repo.insertWithdrawal(db, {
          walletId: wallet.id,
          transactionId: posted!.transactionId,
          amount,
          bankName: bank.bank_name,
          accountNo: bank.account_no,
          holder: bank.account_holder,
          idempotencyKey: key,
          at,
        });
      } catch (e) {
        if (e instanceof InsufficientBalanceError) throw new AppError(400, 'INSUFFICIENT_BALANCE', 'The amount exceeds the available balance');
        throw e;
      }
    });
    const dto = toDto(row);
    return { withdrawal_id: dto.id, id: dto.id, amount: dto.amount, status: dto.status, requestedAt: dto.requestedAt };
  }

  async listWithdrawals(nurseId: string): Promise<WithdrawalDto[]> {
    return (await repo.listForNurse(this.deps.read, nurseId, MAX_WITHDRAWALS_LISTED)).map(toDto);
  }

  /** Admin: the bank transfer was made. */
  async markWithdrawn(adminId: string, withdrawalId: string, payoutRef: string | null, ip?: string): Promise<WithdrawalDto> {
    const at = new Date(this.nowMs());
    const done = await this.deps.withTx(async (db) => {
      const w = await repo.lockWithdrawal(db, withdrawalId);
      if (!w) throw notFound('WITHDRAWAL_NOT_FOUND', 'Withdrawal not found');
      if (w.status !== WithdrawalStatus.WITHDRAW_REQUESTED) throw conflict('WITHDRAWAL_CLOSED', 'This withdrawal was already processed');
      await repo.markWithdrawn(db, w.id, adminId, payoutRef, at);
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.PROCESS_WITHDRAWAL,
        targetTable: 'withdrawal_requests',
        targetId: w.id,
        oldValue: { status: w.status },
        newValue: { status: WithdrawalStatus.WITHDRAWN, amount: Number(w.amount), nurseId: w.user_id, payoutRef },
        ipAddress: ip,
      });
      return { nurseId: w.user_id, dto: toDto((await repo.lockWithdrawal(db, w.id))!) };
    });
    await sendNotices(this.deps.notify, [withdrawalUpdate(done.nurseId, { withdrawalId: done.dto.id, amount: done.dto.amount, status: 'WITHDRAWN' })]);
    return done.dto;
  }

  /** Admin: refused with a written reason — the money goes back to the available balance. */
  async reject(adminId: string, withdrawalId: string, reason: string, ip?: string): Promise<WithdrawalDto> {
    const text = reason.trim();
    if (text.length < 10) throw badRequest('VALIDATION_ERROR', 'A rejection needs a written reason');
    const at = new Date(this.nowMs());
    const done = await this.deps.withTx(async (db) => {
      const w = await repo.lockWithdrawal(db, withdrawalId);
      if (!w) throw notFound('WITHDRAWAL_NOT_FOUND', 'Withdrawal not found');
      if (w.status !== WithdrawalStatus.WITHDRAW_REQUESTED) throw conflict('WITHDRAWAL_CLOSED', 'This withdrawal was already processed');
      const posted = await postNurseEntry(db, {
        userId: w.user_id,
        bookingId: null,
        txType: TxType.REFUND,
        balance: 'AVAILABLE',
        delta: Number(w.amount),
        idempotencyKey: withdrawalKeys.reversal(w.id),
        externalRef: null,
      });
      await repo.markRejected(db, w.id, adminId, text, posted!.transactionId, at);
      await writeAuditLog(db, {
        actorId: adminId,
        action: AuditAction.PROCESS_WITHDRAWAL,
        targetTable: 'withdrawal_requests',
        targetId: w.id,
        oldValue: { status: w.status },
        newValue: { status: WithdrawalStatus.REJECTED, amount: Number(w.amount), nurseId: w.user_id, reason: text, reversalTransactionId: posted!.transactionId },
        ipAddress: ip,
      });
      return { nurseId: w.user_id, dto: toDto((await repo.lockWithdrawal(db, w.id))!) };
    });
    await sendNotices(this.deps.notify, [withdrawalUpdate(done.nurseId, { withdrawalId: done.dto.id, amount: done.dto.amount, status: 'REJECTED', reason: text })]);
    return done.dto;
  }
}

function toDto(w: WithdrawalRow): WithdrawalDto {
  return {
    id: w.id,
    amount: Number(w.amount),
    status: w.status as WithdrawalStatus,
    rejectReason: w.reject_reason ?? undefined,
    requestedAt: new Date(w.created_at).toISOString(),
    processedAt: w.reviewed_at ? new Date(w.reviewed_at).toISOString() : undefined,
  };
}

let singleton: WithdrawalsService | null = null;

export function getWithdrawalsService(): WithdrawalsService {
  if (!singleton) singleton = new WithdrawalsService({ read: { query }, withTx: (fn) => withTransaction((c) => fn(c)), notify: notifyUser });
  return singleton;
}
