import {
  getTrustScoreReasonLabel,
  getTrustScoreTier,
  TRUST_SCORE_GOOD_THRESHOLD,
  TRUST_SCORE_REASON_LABELS,
  TRUST_SCORE_RULES,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
  type TrustScoreRuleItem,
  type TrustScoreTier,
} from '@healthcare-system/shared';
import { tokens } from '../../styles/tokens';

export {
  getTrustScoreReasonLabel,
  getTrustScoreTier,
  TRUST_SCORE_GOOD_THRESHOLD,
  TRUST_SCORE_REASON_LABELS,
  TRUST_SCORE_RULES,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
};
export type { TrustScoreRuleItem, TrustScoreTier };

export interface ScoreTierMeta {
  tier: TrustScoreTier;
  color: string;
  softColor: string;
  label: string;
  summary: string;
}

const SCORE_TIER_META_MAP: Record<TrustScoreTier, ScoreTierMeta> = {
  good: {
    tier: 'good',
    color: tokens.colors.brandJade,
    softColor: tokens.colors.brandJadeSoft,
    label: 'Mức rất tốt',
    summary: 'Bạn được ưu tiên gợi ý ca trên Radar.',
  },
  fair: {
    tier: 'fair',
    color: tokens.colors.accentOchre,
    softColor: tokens.colors.accentOchreSoft,
    label: 'Khá',
    summary: 'Duy trì dịch vụ tốt để tích lũy thêm điểm uy tín.',
  },
  warning: {
    tier: 'warning',
    color: '#EA580C',
    softColor: tokens.colors.accentOchreSoft,
    label: 'Cảnh báo',
    summary: `Điểm sắp chạm ngưỡng ${TRUST_SCORE_SUSPEND_THRESHOLD} — dưới ${TRUST_SCORE_SUSPEND_THRESHOLD} tài khoản sẽ bị tạm khóa nhận ca.`,
  },
  suspended: {
    tier: 'suspended',
    color: tokens.colors.alertCrimson,
    softColor: tokens.colors.alertCrimsonSoft,
    label: 'Tạm khóa',
    summary: `Tài khoản đang tạm khóa nhận ca (dưới ${TRUST_SCORE_SUSPEND_THRESHOLD} điểm).`,
  },
};

export function getScoreColor(score: number): string {
  return SCORE_TIER_META_MAP[getTrustScoreTier(score)].color;
}

export function getScoreTierMeta(score: number): ScoreTierMeta {
  return SCORE_TIER_META_MAP[getTrustScoreTier(score)];
}
