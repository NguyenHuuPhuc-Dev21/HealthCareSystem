/**
 * Pure rules of settlements (BE-3 · Phase 5 · FR-PAY-02 · ADR-0004 D2). No I/O.
 *
 *  - when a shift may be settled (trigger × booking state)
 *  - the money split: gross = commission + net; net = deposit withheld + payout
 *  - what a cancellation outcome still owes the nurse and the platform
 */
import { MoneyHelper } from '@healthcare-system/shared';
import type { CancellationShareRow, SettleBookingRow, SettleSkipReason, SettlementSplit, SettlementTrigger } from './settlements.types';

/**
 * Can this shift be paid out now?
 *  COOLING_ELAPSED     check-out + coolingHours passed, dispute NONE (FR-PAY-02)
 *  CUSTOMER_CONFIRMED  checked out, dispute NONE — the customer gives up the rest of the window
 *  DISPUTE_RELEASED    dispute resolved for the nurse (Phase 6 disputes calls this)
 */
export function shiftSettleBlocker(
  b: SettleBookingRow,
  trigger: Exclude<SettlementTrigger, 'CANCELLATION_SHARE'>,
  coolingHours: number,
  nowMs: number,
): SettleSkipReason | null {
  if (b.settled_at) return 'ALREADY_SETTLED';
  if (b.payment_method !== 'BANK_TRANSFER') return 'NOT_TRANSFER_BOOKING';
  if (b.payment_status !== 'ESCROW_HELD') return 'NOT_HELD';
  if (!b.nurse_id) return 'NO_NURSE';
  if (!b.checkout_time) return 'NOT_CHECKED_OUT';
  if (b.execution_status !== 'COMPLETED') return 'NOT_COMPLETED';
  if (trigger === 'DISPUTE_RELEASED') return b.dispute_status === 'RESOLVED_NURSE' ? null : 'DISPUTE_OPEN';
  // NONE, or a dispute already resolved for the nurse (released when it could not be paid at resolution time).
  if (b.dispute_status !== 'NONE' && b.dispute_status !== 'RESOLVED_NURSE') return 'DISPUTE_OPEN';
  if (trigger === 'COOLING_ELAPSED' && new Date(b.checkout_time).getTime() + coolingHours * 3_600_000 > nowMs) return 'COOLING';
  return null;
}

/**
 * gross → commission (priced into the booking as platform_fee) → net → ADR-0004 D2 withholding while the deposit is
 * below the minimum (MoneyHelper.calculateDepositWithhold: never above the shortfall) → payout to available.
 */
export function splitSettlement(p: {
  gross: number;
  commission: number;
  depositBalance: number;
  minDeposit: number;
  withholdRate: number;
  countsAsShift: boolean;
}): SettlementSplit {
  if (p.commission > p.gross) throw new Error(`Commission ${p.commission} exceeds gross ${p.gross}`);
  const net = p.gross - p.commission;
  const short = p.depositBalance < p.minDeposit;
  const { withhold, payout } = short
    ? MoneyHelper.calculateDepositWithhold(net, p.depositBalance, p.minDeposit, p.withholdRate)
    : { withhold: 0, payout: net };
  return { gross: p.gross, commission: p.commission, net, withheld: withhold, payout, graceShift: p.countsAsShift && short };
}

/**
 * Cancellation shares kept in escrow (cancellation-policy, settlement_status PENDING):
 *  rows 2–3  nurse_compensation and platform_share are already the split → gross = both, commission = platform_share
 *  row 4     (customer stops after check-in) nurse_compensation is the gross for the hours worked → usual commission
 */
export function cancellationGross(c: CancellationShareRow, commissionRate: number): { gross: number; commission: number } {
  const nurse = Number(c.nurse_compensation);
  const platform = Number(c.platform_share);
  if (c.scenario === 'CUSTOMER_STOP_AFTER_CHECKIN') {
    return { gross: nurse + platform, commission: platform + MoneyHelper.calculatePercentage(nurse, commissionRate) };
  }
  return { gross: nurse + platform, commission: platform };
}
