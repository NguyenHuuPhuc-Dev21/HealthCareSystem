/**
 * cash-commission — the nurse self-pays the platform commission of a cash booking. BE-3 · Phase 5 · FR-PAY-02 · BR-05.
 * Contract: docs/api/cash-commission.api.md
 *
 *  GET  /nurse/commission-debts                    every commission of her completed cash shifts: OVERDUE, UNPAID, PAID
 *  POST /bookings/:id/commission-payment-link      VietQR to the platform account, transfer content "HH…" (one per booking)
 *  POST /bookings/:id/confirm-commission           dev / demo only: signs and runs the gateway webhook of the payment
 *  webhook "HH…"                                   COMMISSION_PAYMENT (no balance moves) → booking SETTLED → un-suspend
 *  job  cash-commission.overdue-sweep (5 min)      deadline passed, unpaid → nurse SUSPENDED (COMMISSION_OVERDUE)
 *
 * The commission is never taken from deposit_balance or available_balance.
 */
import { randomBytes } from 'node:crypto';
import type { CommissionDebtDto, CommissionPaymentLinkDto } from '@healthcare-system/shared';
import { query, withTransaction, type Queryable } from '../../core/database';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { signData, vietQrImageUrl } from '../gateway-webhooks/gateway-webhooks.policy';
import { getGatewayWebhooksService, receivingAccountFromEnv, simulatorEnabled } from '../gateway-webhooks/gateway-webhooks.service';
import type { ReceivingAccount } from '../gateway-webhooks/gateway-webhooks.types';
import { commissionStatus, makeCommissionCode, sortDebts } from './cash-commission.policy';
import * as repo from './cash-commission.repo';
import type { CommissionPaymentRow, OverdueSweepResult } from './cash-commission.types';

export interface CashCommissionDeps {
  read: Queryable;
  withTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T>;
  /** The platform's receiving account (the commission is platform revenue); null = not configured. */
  receivingAccount: () => ReceivingAccount | null;
  /** Dev simulator: signs and runs the escrow webhook for (orderCode, amount, reference). Absent = disabled. */
  deliverWebhook?: (orderCode: string, amount: number, reference: string) => Promise<unknown>;
  now?: () => number;
  random?: (n: number) => Uint8Array;
}

export class CashCommissionService {
  constructor(private readonly deps: CashCommissionDeps) {}

  private nowMs(): number {
    return (this.deps.now ?? Date.now)();
  }

  async listDebts(nurseId: string): Promise<CommissionDebtDto[]> {
    const nowMs = this.nowMs();
    const rows = await repo.listDebts(this.deps.read, nurseId);
    return sortDebts(
      rows.map((r) => ({
        bookingId: r.booking_id,
        bookingCode: r.booking_code,
        serviceName: r.service_name,
        bookingAmount: Number(r.total_amount),
        commissionAmount: Number(r.platform_fee),
        dueAt: new Date(r.commission_due_at).toISOString(),
        status: commissionStatus(r.paid_at, r.commission_due_at, nowMs),
        paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : undefined,
      })),
    );
  }

  /** One payment code per booking: asking again returns the same transfer details. */
  async createPaymentLink(nurseId: string, bookingId: string): Promise<CommissionPaymentLinkDto> {
    const acc = this.deps.receivingAccount();
    if (!acc) throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'Commission payment is not available right now');
    const { payment, dueAt } = await this.deps.withTx(async (db) => {
      const b = await repo.lockBooking(db, bookingId);
      if (!b || b.nurse_id !== nurseId) throw forbidden('FORBIDDEN', 'You do not have access to this booking'); // no existence leak
      if (b.payment_method !== 'CASH') throw badRequest('NOT_CASH_BOOKING', 'Only cash bookings have a commission to pay');
      if (b.execution_status !== 'COMPLETED' || !b.commission_due_at) {
        throw conflict('COMMISSION_NOT_DUE', 'The commission is due once the shift is checked out');
      }
      if (b.settled_at) throw conflict('COMMISSION_ALREADY_PAID', 'This commission is already paid');
      const amount = Number(b.platform_fee);
      if (amount <= 0) throw conflict('NOTHING_DUE', 'No commission is due for this booking');
      const existing = await repo.findPayment(db, bookingId);
      const p: CommissionPaymentRow =
        existing ??
        (await repo.insertPayment(db, { bookingId, nurseId, amount, code: makeCommissionCode((this.deps.random ?? randomBytes)(12)) }));
      return { payment: p, dueAt: b.commission_due_at };
    });
    const amount = Number(payment.amount);
    return {
      checkoutUrl: '', // VietQR only (no hosted checkout page in the sandbox)
      qrCode: vietQrImageUrl(acc, amount, payment.payment_code) ?? '',
      transferContent: payment.payment_code,
      dueTime: new Date(dueAt).toISOString(),
      amount,
      bankName: acc.bankName,
      accountNumber: acc.accountNumber,
    };
  }

  /** Dev / demo only (PAYMENT_SIMULATOR_ENABLED=true): the webhook a successful transfer of the commission would send. */
  async simulatePayment(nurseId: string, bookingId: string): Promise<{ success: boolean; paidAt: string }> {
    if (!this.deps.deliverWebhook) throw notFound('NOT_FOUND', 'Not found');
    const link = await this.createPaymentLink(nurseId, bookingId);
    await this.deps.deliverWebhook(link.transferContent, link.amount!, `SIM-${link.transferContent}-${this.nowMs()}`);
    const p = await repo.findPayment(this.deps.read, bookingId);
    return { success: !!p?.paid_at, paidAt: p?.paid_at ? new Date(p.paid_at).toISOString() : '' };
  }

  async runOverdueSweep(): Promise<OverdueSweepResult> {
    const suspended = await this.deps.withTx((db) => repo.suspendOverdueNurses(db, new Date(this.nowMs())));
    return { suspended: suspended.length };
  }
}

let singleton: CashCommissionService | null = null;

export function getCashCommissionService(): CashCommissionService {
  if (!singleton) {
    singleton = new CashCommissionService({
      read: { query },
      withTx: (fn) => withTransaction((client) => fn(client)),
      receivingAccount: () => receivingAccountFromEnv(),
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
