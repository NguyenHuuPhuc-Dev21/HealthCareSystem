/**
 * Authoritative Money Helpers (VND Integer Precision)
 * Strict rule: All currency values in VND are exact integers; zero floating-point arithmetic on persisted amounts.
 */

export class MoneyHelper {
  /**
   * Safely calculates percentage of integer amount and rounds to nearest integer
   */
  public static calculatePercentage(amountVnd: number, rate: number): number {
    return Math.round(amountVnd * rate);
  }

  /**
   * Calculates 15% platform commission and 85% nurse payout on completed booking
   * Example: 500,000 VND -> platformFee: 75,000 VND, nursePayout: 425,000 VND
   */
  public static calculateSettlementSplit(totalAmountVnd: number, commissionRate = 0.15): {
    platformFee: number;
    nursePayout: number;
  } {
    const platformFee = Math.round(totalAmountVnd * commissionRate);
    const nursePayout = totalAmountVnd - platformFee;
    return { platformFee, nursePayout };
  }

  /**
   * Calculates cancellation SLA split (SRS §5.2 rows 1–3)
   */
  public static calculateCancellationSplit(
    totalAmountVnd: number,
    hoursBeforeStart: number
  ): {
    refundToCustomer: number;
    payoutToNurse: number;
    platformFee: number;
    penaltyRate: number;
  } {
    if (hoursBeforeStart > 12) {
      // Scenario 1: > 12h: 100% refund, 0% penalty
      return {
        refundToCustomer: totalAmountVnd,
        payoutToNurse: 0,
        platformFee: 0,
        penaltyRate: 0,
      };
    } else if (hoursBeforeStart >= 2) {
      // Scenario 2: 2h–12h: 20% penalty (80% refund to customer, 15% to nurse, 5% to platform)
      const penalty = Math.round(totalAmountVnd * 0.20);
      const refundToCustomer = totalAmountVnd - penalty;
      const payoutToNurse = Math.round(totalAmountVnd * 0.15);
      const platformFee = totalAmountVnd - refundToCustomer - payoutToNurse; // exact remaining balance
      return {
        refundToCustomer,
        payoutToNurse,
        platformFee,
        penaltyRate: 0.20,
      };
    } else {
      // Scenario 3: < 2h: 50% penalty (50% refund to customer, 40% to nurse, 10% to platform)
      const penalty = Math.round(totalAmountVnd * 0.50);
      const refundToCustomer = totalAmountVnd - penalty;
      const payoutToNurse = Math.round(totalAmountVnd * 0.40);
      const platformFee = totalAmountVnd - refundToCustomer - payoutToNurse;
      return {
        refundToCustomer,
        payoutToNurse,
        platformFee,
        penaltyRate: 0.50,
      };
    }
  }

  /**
   * Formats integer VND to Vietnamese locale string
   */
  public static formatVnd(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }
}

