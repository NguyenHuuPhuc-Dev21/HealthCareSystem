import {
  getTrustScoreReasonLabel,
  getTrustScoreTier,
  TRUST_SCORE_GOOD_THRESHOLD,
  TRUST_SCORE_REASON_LABELS,
  TRUST_SCORE_RULES,
  TRUST_SCORE_SUSPEND_THRESHOLD,
  TRUST_SCORE_WARNING_THRESHOLD,
  type ReceivedReviewDto,
  type TrustScoreRuleItem,
  type TrustScoreTier,
} from '@healthcare-system/shared';
import { tokens } from '../../styles/tokens';

export {
  getTrustScoreReasonLabel,
  getTrustScoreTier,
  getTrustScoreTier as getScoreTier,
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

export type TrustScoreBannerKind = 'none' | 'warning' | 'suspended';

export interface TrustScoreBannerState {
  kind: TrustScoreBannerKind;
  title: string;
  message: string;
}

export function getTrustScoreBannerState(score: number): TrustScoreBannerState {
  if (score < TRUST_SCORE_SUSPEND_THRESHOLD) {
    return {
      kind: 'suspended',
      title: 'Tài khoản đang tạm khóa nhận ca',
      message: `Điểm TrustScore hiện tại là ${score} / 100 (dưới ngưỡng ${TRUST_SCORE_SUSPEND_THRESHOLD} điểm). Bạn tạm thời không thể nhận ca mới từ Radar hoặc Job Board. Vui lòng liên hệ Admin để được hỗ trợ.`,
    };
  }
  if (score < TRUST_SCORE_WARNING_THRESHOLD) {
    return {
      kind: 'warning',
      title: `Cảnh báo: Điểm sắp chạm ngưỡng ${TRUST_SCORE_SUSPEND_THRESHOLD}`,
      message: `Điểm hiện tại là ${score} / 100. Khi dưới ${TRUST_SCORE_SUSPEND_THRESHOLD} điểm, hệ thống sẽ tạm khóa quyền nhận ca. Hãy hoàn thành tốt các ca sắp tới (+2 điểm mỗi ca được đánh giá ≥ 4★).`,
    };
  }
  return { kind: 'none', title: '', message: '' };
}

export interface ReviewDisplayState {
  isHidden: boolean;
  starsText: string | null;
  comment: string | null;
  hiddenNotice: string | null;
}

export function getReviewDisplayState(review: ReceivedReviewDto): ReviewDisplayState {
  if (!review.isVisible) {
    return {
      isHidden: true,
      starsText: null,
      comment: null,
      hiddenNotice:
        'Đánh giá đang được ẩn — hiển thị khi hai bên cùng đánh giá hoặc đủ 7 ngày.',
    };
  }
  const clamped = Math.max(0, Math.min(5, Math.round(review.rating)));
  return {
    isHidden: false,
    starsText: `${'★'.repeat(clamped)}${'☆'.repeat(5 - clamped)}`,
    comment: review.comment ?? null,
    hiddenNotice: null,
  };
}
