import { apiClient } from '../../lib/api-client';

export interface TrustScoreDto {
  trust_score: number;
  history: Array<{ delta: number; reason: string; created_at: string }>;
}

export async function getTrustScore() {
  return apiClient<TrustScoreDto>('/nurse/trust-score');
}

