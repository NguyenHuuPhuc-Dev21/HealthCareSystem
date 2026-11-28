import {
  TRUST_SCORE_GOOD_THRESHOLD,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
} from '../constants';
import type { TrustScoreReason } from '../contracts/trust-score.contracts';

export type TrustScoreTier = 'good' | 'fair' | 'warning' | 'suspended';

export const TRUST_SCORE_REASON_LABELS: Record<TrustScoreReason, string> = {
  GOOD_RATING_RECOVERY: 'Được đánh giá tốt (≥ 4★)',
  CANCEL_OVER_12H: 'Hủy ca trước giờ hẹn > 12h',
  CANCEL_WITHIN_12H: 'Hủy ca gấp trong vòng 12h',
  DISPUTE_UPHELD: 'Khiếu nại khách hàng được xác nhận đúng',
  ADMIN_ADJUSTMENT: 'Điều chỉnh bởi Quản trị viên',
};

export function getTrustScoreReasonLabel(reason: TrustScoreReason): string {
  return TRUST_SCORE_REASON_LABELS[reason] ?? reason;
}

export function getTrustScoreTier(score: number): TrustScoreTier {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped < TRUST_SCORE_SUSPEND_THRESHOLD) return 'suspended';
  if (clamped < TRUST_SCORE_WARNING_THRESHOLD) return 'warning';
  if (clamped < TRUST_SCORE_GOOD_THRESHOLD) return 'fair';
  return 'good';
}

export interface TrustScoreRuleItem {
  reason: TrustScoreReason;
  delta: number;
  title: string;
}

export const TRUST_SCORE_RULES: TrustScoreRuleItem[] = [
  {
    reason: 'GOOD_RATING_RECOVERY',
    delta: 2,
    title: 'Ca quyết toán, được đánh giá ≥ 4★',
  },
  {
    reason: 'CANCEL_OVER_12H',
    delta: -5,
    title: 'Hủy ca trước giờ hẹn trên 12 giờ',
  },
  {
    reason: 'CANCEL_WITHIN_12H',
    delta: -20,
    title: 'Hủy ca gấp (trong vòng 12 giờ)',
  },
  {
    reason: 'DISPUTE_UPHELD',
    delta: -25,
    title: 'Khiếu nại của khách được xác nhận đúng',
  },
];
