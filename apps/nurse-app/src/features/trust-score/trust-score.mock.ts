import type {
  ReceivedReviewDto,
  TrustScoreDto,
  TrustScoreHistoryItem,
} from '@healthcare-system/shared';

const DEFAULT_MOCK_SCORE = 92;

let mockCurrentScore = DEFAULT_MOCK_SCORE;

const BASE_HISTORY: TrustScoreHistoryItem[] = [
  {
    id: 'ts-h-1',
    delta: 2,
    reason: 'GOOD_RATING_RECOVERY',
    bookingCode: 'HC-2026-1048',
    note: 'Gia đình đánh giá 5★ sau ca chăm sóc vết thương',
    createdAt: '2026-11-23T18:30:00+07:00',
  },
  {
    id: 'ts-h-2',
    delta: 2,
    reason: 'GOOD_RATING_RECOVERY',
    bookingCode: 'HC-2026-1042',
    note: 'Gia đình đánh giá 5★ sau ca theo dõi sinh hiệu',
    createdAt: '2026-11-20T16:15:00+07:00',
  },
  {
    id: 'ts-h-3',
    delta: -5,
    reason: 'CANCEL_OVER_12H',
    bookingCode: 'HC-2026-1039',
    note: 'Hủy ca trước giờ hẹn 18 giờ',
    createdAt: '2026-11-15T09:00:00+07:00',
  },
  {
    id: 'ts-h-4',
    delta: 2,
    reason: 'GOOD_RATING_RECOVERY',
    bookingCode: 'HC-2026-1031',
    note: 'Gia đình đánh giá 4★ sau ca chăm sóc người cao tuổi',
    createdAt: '2026-11-10T20:45:00+07:00',
  },
];

const MOCK_RECEIVED_REVIEWS: ReceivedReviewDto[] = [
  {
    id: 'rev-1',
    bookingCode: 'HC-2026-1057',
    customerName: 'Bà Nguyễn Thị Hoa',
    rating: 5,
    comment: 'Điều dưỡng đến đúng giờ, thao tác nhẹ nhàng và hướng dẫn người nhà rất kỹ.',
    isVisible: false, // Đang ẩn theo cơ chế blind review 2 chiều
    createdAt: '2026-11-24T17:10:00+07:00',
  },
  {
    id: 'rev-2',
    bookingCode: 'HC-2026-1048',
    customerName: 'Ông Trần Minh Tuấn',
    rating: 5,
    comment: 'Rất tận tâm, thay băng sạch sẽ và theo dõi huyết áp cẩn thận.',
    isVisible: true,
    createdAt: '2026-11-23T18:20:00+07:00',
  },
  {
    id: 'rev-3',
    bookingCode: 'HC-2026-1042',
    customerName: 'Chị Lê Thu Hương',
    rating: 5,
    comment: 'Nhiệt tình, giải thích rõ ràng các chỉ số cho gia đình yên tâm.',
    isVisible: true,
    createdAt: '2026-11-20T16:05:00+07:00',
  },
  {
    id: 'rev-4',
    bookingCode: 'HC-2026-1031',
    customerName: 'Anh Phạm Quốc Bảo',
    rating: 4,
    comment: 'Chu đáo, đúng giờ.',
    isVisible: true,
    createdAt: '2026-11-10T20:30:00+07:00',
  },
];

export function mockSetScoreForTesting(score: number): void {
  mockCurrentScore = Math.max(0, Math.min(100, Math.round(score)));
}

export function resetTrustScoreMockState(): void {
  mockCurrentScore = DEFAULT_MOCK_SCORE;
}

export async function mockGetTrustScore(): Promise<TrustScoreDto> {
  const extraHistory: TrustScoreHistoryItem[] = [];

  if (mockCurrentScore < 70) {
    extraHistory.push({
      id: 'ts-h-test-cancel',
      delta: -20,
      reason: 'CANCEL_WITHIN_12H',
      bookingCode: 'HC-2026-1055',
      note: 'Hủy ca gấp trong vòng 12 giờ trước giờ hẹn',
      createdAt: '2026-11-24T07:30:00+07:00',
    });
  }

  if (mockCurrentScore < 60) {
    extraHistory.push({
      id: 'ts-h-test-dispute',
      delta: -25,
      reason: 'DISPUTE_UPHELD',
      bookingCode: 'HC-2026-1056',
      note: 'Khiếu nại của khách hàng được xác nhận đúng',
      createdAt: '2026-11-24T12:00:00+07:00',
    });
  }

  return {
    score: mockCurrentScore,
    ratingAvg: 4.9,
    ratingCount: 128,
    ratingDistribution: {
      star5: 84,
      star4: 12,
      star3: 3,
      star2: 1,
      star1: 0,
    },
    history: [...extraHistory, ...BASE_HISTORY],
  };
}

export async function mockGetReceivedReviews(): Promise<ReceivedReviewDto[]> {
  return MOCK_RECEIVED_REVIEWS.map((r) => ({ ...r }));
}
