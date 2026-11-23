/**
 * wallets-ledger — the nurse's wallet: balances, ledger history, earnings, upcoming settlements,
 * and the travel-support payout. BE-3 · Phase 5 · FR-PAY-01/03 · FR-BOOK-02 L3 · ADR-0004.
 * Contract: docs/api/wallets-ledger.api.md
 *
 *  GET /wallets/me                          WalletSummaryDto (3 balances, min deposit, grace, suspension banner)
 *  GET /wallets/me/transactions             Paged<WalletTransactionDto>, newest first, ?type= chip or TxType, ?cursor=
 *  GET /wallets/me/earnings?range=week|month points + total + label (Vietnam time)
 *  GET /wallets/me/upcoming-settlements     checked-out transfer shifts still in escrow
 *  job wallets-ledger.travel-support-sweep  pays PENDING prescription_rejections travel support (TRAVEL_SUPPORT)
 *
 * Money moves only through postNurseEntry (wallets-ledger.ledger.ts) — shared with deposits, settlements, withdrawals.
 */
import {
  TxStatus,
  TxType,
  type BalanceType,
  type Paged,
  type SystemConfigKey,
  type UpcomingSettlementDto,
  type WalletSummaryDto,
  type WalletTransactionDto,
} from '@healthcare-system/shared';
import { getConfigNumber } from '../../core/config';
import { query, withTransaction, type Queryable } from '../../core/database';
import { badRequest } from '../../core/errors';
import type { DepositRule } from '../matching-radar/matching-radar.types';
import { nurseLedgerKeys, postNurseEntry } from './wallets-ledger.ledger';
import {
  EARNING_TYPES,
  bucketEarnings,
  decodeCursor,
  depositGraceActive,
  describeTx,
  earningsWindow,
  encodeCursor,
  signedAmount,
  suspensionOf,
  txTypesForFilter,
} from './wallets-ledger.policy';
import * as repo from './wallets-ledger.repo';
import {
  DEFAULT_TX_PAGE_SIZE,
  MAX_TX_PAGE_SIZE,
  TRAVEL_SUPPORT_BATCH_SIZE,
  type EarningsRange,
  type EarningsResult,
  type TravelSupportSweepResult,
} from './wallets-ledger.types';

export interface WalletsLedgerDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  now?: () => number;
  configNumber?: (key: SystemConfigKey) => Promise<number>;
}

export type TravelSupportOutcome = 'PAID' | 'ALREADY_PAID' | 'NOT_FOUND';

export class WalletsLedgerService {
  constructor(private readonly deps: WalletsLedgerDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  private cfg(key: SystemConfigKey): Promise<number> {
    return (this.deps.configNumber ?? getConfigNumber)(key);
  }

  private async depositRule(): Promise<DepositRule> {
    const [minDeposit, graceMaxShifts] = await Promise.all([this.cfg('MIN_NURSE_DEPOSIT'), this.cfg('DEPOSIT_GRACE_MAX_SHIFTS')]);
    return { minDeposit, graceMaxShifts };
  }

  async getSummary(nurseId: string): Promise<WalletSummaryDto> {
    const db = this.deps.read;
    const nowMs = this.nowMs();
    const [rule, wallet, status, commissionOverdue, upcoming] = await Promise.all([
      this.depositRule(),
      repo.findWallet(db, nurseId),
      repo.findNurseStatus(db, nurseId),
      repo.hasOverdueCommission(db, nurseId, new Date(nowMs)),
      repo.listUpcomingSettlements(db, nurseId),
    ]);
    const depositBalance = Number(wallet?.deposit_balance ?? 0);
    const graceActive = depositGraceActive(wallet, rule, nowMs);
    const { isSuspended, suspendedReason } = suspensionOf({
      closureRequested: !!wallet?.closure_requested_at,
      profileStatus: status.profile_status,
      profileSuspendedReason: status.suspended_reason,
      commissionOverdue,
      depositShort: depositBalance < rule.minDeposit,
      graceActive,
    });
    return {
      availableBalance: Number(wallet?.available_balance ?? 0),
      // The customer prepayment sits in the CUSTOMER's escrow; for the nurse "held" = what her checked-out shifts will pay.
      escrowLockedBalance: upcoming.reduce((sum, r) => sum + Number(r.total_amount) - Number(r.platform_fee), 0),
      depositBalance,
      minDeposit: rule.minDeposit,
      isSuspended,
      suspendedReason,
      depositGraceActive: graceActive,
    };
  }

  async listTransactions(nurseId: string, q: { type?: string; cursor?: string; limit?: number }): Promise<Paged<WalletTransactionDto>> {
    const types = txTypesForFilter(q.type);
    if (types === 'INVALID') throw badRequest('VALIDATION_ERROR', `Unknown transaction filter: ${q.type}`);
    const cursor = q.cursor ? decodeCursor(q.cursor) : null;
    if (q.cursor && !cursor) throw badRequest('INVALID_CURSOR', 'Cursor is not valid');
    const limit = Math.min(Math.max(q.limit ?? DEFAULT_TX_PAGE_SIZE, 1), MAX_TX_PAGE_SIZE);

    const wallet = await repo.findWallet(this.deps.read, nurseId);
    if (!wallet) return { items: [], nextCursor: null };
    const rows = await repo.listTransactions(this.deps.read, wallet.id, { types, cursor, limit });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.tx_type as TxType,
        status: r.status as TxStatus,
        balanceType: r.balance_type as BalanceType,
        amount: signedAmount(r),
        bookingCode: r.booking_code ?? undefined,
        description: describeTx(r.tx_type, r.booking_code),
        createdAt: new Date(r.created_at).toISOString(),
      })),
      nextCursor: rows.length > limit && last ? encodeCursor({ createdAt: last.created_at_text, id: last.id }) : null,
    };
  }

  async getEarnings(nurseId: string, range: EarningsRange): Promise<EarningsResult> {
    const win = earningsWindow(range, this.nowMs());
    const wallet = await repo.findWallet(this.deps.read, nurseId);
    const rows = wallet ? await repo.listEarnings(this.deps.read, wallet.id, EARNING_TYPES, win.from, win.to) : [];
    return bucketEarnings(win, rows);
  }

  async getUpcomingSettlements(nurseId: string): Promise<UpcomingSettlementDto[]> {
    const [coolingHours, rows] = await Promise.all([
      this.cfg('SETTLEMENT_COOLING_HOURS'),
      repo.listUpcomingSettlements(this.deps.read, nurseId),
    ]);
    return rows.map((r) => {
      const gross = Number(r.total_amount);
      const commission = Number(r.platform_fee);
      return {
        bookingCode: r.booking_code,
        serviceName: r.service_name,
        grossAmount: gross,
        commissionAmount: commission,
        netAmount: gross - commission,
        settleAt: new Date(new Date(r.checkout_time).getTime() + coolingHours * 3_600_000).toISOString(),
        disputeOpen: r.dispute_status === 'OPEN' || r.dispute_status === 'UNDER_REVIEW',
      };
    });
  }

  /**
   * Pays one rejection's travel support (FR-BOOK-02 Layer 3) into the nurse's available balance from the operations
   * fund: ONE TRAVEL_SUPPORT row + travel_support_status = PAID, in one transaction. Idempotent.
   */
  async payTravelSupport(rejectionId: string): Promise<TravelSupportOutcome> {
    const at = new Date(this.nowMs());
    return this.deps.withTx(async (db) => {
      const r = await repo.lockTravelSupport(db, rejectionId);
      if (!r) return 'NOT_FOUND';
      if (r.travel_support_status !== 'PENDING') return 'ALREADY_PAID';
      const amount = Number(r.travel_support_amount);
      if (amount > 0) {
        await postNurseEntry(db, {
          userId: r.nurse_id,
          bookingId: r.booking_id,
          txType: TxType.TRAVEL_SUPPORT,
          balance: 'AVAILABLE',
          delta: amount,
          idempotencyKey: nurseLedgerKeys.travelSupport(r.id),
          externalRef: null, // operations fund → nurse wallet is internal in the simulated scope (ADR-0004 D1)
        });
      }
      await repo.markTravelSupportPaid(db, r.id, at);
      return 'PAID';
    });
  }

  async runTravelSupportSweep(): Promise<TravelSupportSweepResult> {
    const ids = await repo.listPendingTravelSupportIds(this.deps.read, TRAVEL_SUPPORT_BATCH_SIZE);
    const result: TravelSupportSweepResult = { paid: 0, failed: 0 };
    for (const id of ids) {
      try {
        if ((await this.payTravelSupport(id)) === 'PAID') result.paid += 1;
      } catch (err) {
        result.failed += 1;
        console.error(`[wallets-ledger] travel support ${id} failed:`, err);
      }
    }
    return result;
  }
}

let singleton: WalletsLedgerService | null = null;

export function getWalletsLedgerService(): WalletsLedgerService {
  if (!singleton) {
    singleton = new WalletsLedgerService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
    });
  }
  return singleton;
}
