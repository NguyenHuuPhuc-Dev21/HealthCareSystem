export type TrustScoreReason =
  | 'CANCEL_OVER_12H' // −5
  | 'CANCEL_WITHIN_12H' // −20
  | 'DISPUTE_UPHELD' // −25
  | 'GOOD_RATING_RECOVERY' // +2
  | 'ADMIN_ADJUSTMENT';

export interface TrustScoreHistoryItem {
  id: string;
  delta: number;
  reason: TrustScoreReason;
  bookingCode?: string;
  note?: string;
  createdAt: string;
}

export interface RatingDistributionDto {
  star5: number;
  star4: number;
  star3: number;
  star2: number;
  star1: number;
}

export interface TrustScoreDto {
  score: number;
  ratingAvg: number | null;
  ratingCount: number;
  ratingDistribution?: RatingDistributionDto;
  history: TrustScoreHistoryItem[];
}

export interface ReceivedReviewDto {
  id: string;
  bookingCode: string;
  customerName?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  isVisible: boolean; // false = đang ẩn chờ hai bên cùng đánh giá hoặc đủ 7 ngày
  createdAt: string;
}
