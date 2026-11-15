import { apiClient } from '../../lib/api-client';

export interface WalletBalancesDto {
  available_balance: number;
  escrow_locked_balance: number;
  deposit_balance: number;
}

export async function getWalletBalances() {
  return apiClient<WalletBalancesDto>('/wallets/me');
}

export async function requestWithdrawal(amount: number) {
  return apiClient<{ withdrawal_id: string }>('/wallets/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

