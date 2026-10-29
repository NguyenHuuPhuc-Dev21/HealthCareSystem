import { apiClient } from '../../lib/api-client';

export interface FinancialReconDto {
  total_escrow_held: number;
  total_commission_collected: number;
  total_payouts: number;
  total_refunds: number;
  pending_withdrawals: number;
}

export async function getFinancialReconciliation() {
  return apiClient<FinancialReconDto>('/admin/finance/reconciliation');
}

