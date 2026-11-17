import type {
  ReceivedReviewDto,
  TrustScoreDto,
} from '@healthcare-system/shared';

const TRUST_SCORE_STORAGE_KEY = 'carenest_mock_trust_score_v1';
const WALLET_STORAGE_KEY = 'carenest_mock_wallet_v2';

function syncTrustScoreSuspension(score: number): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return;
    const walletState = JSON.parse(raw);
    if (score < 60) {
      walletState.isSuspended = true;
      walletState.suspendedReason = 'TRUST_SCORE_LOW';
    } else if (walletState.suspendedReason === 'TRUST_SCORE_LOW') {
      walletState.isSuspended = false;
      walletState.suspendedReason = null;
    }
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletState));
  } catch {
    // ignore
  }
}

interface MockTrustScoreState {
  score: number;
  ratingAvg: number;
  ratingCount: number;
  ratingDistribution: {
    star5: number;
    star4: number;
    star3: number;
    star2: number;
    star1: number;
  };
  history: TrustScoreDto['history'];
  receivedReviews: ReceivedReviewDto[];
}

const INITIAL_TRUST_SCORE_STATE: MockTrustScoreState = {
  score: 92,
  ratingAvg: 4.9,
  ratingCount: 128,
  ratingDistribution: {
    star5: 84,
    star4: 12,
    star3: 3,
    star2: 1,
    star1: 0,
  },
  history: [
    {
      id: 'tsh-1',
      delta: 2,
      reason: 'GOOD_RATING_RECOVERY',
      bookingCode: 'HC-2026-1039',
      note: 'Ca quyết toán, được đánh giá 5★',
      createdAt: '2026-10-29T10:30:00.000Z',
    },
    {
      id: 'tsh-2',
      delta: 2,
      reason: 'GOOD_RATING_RECOVERY',
      bookingCode: 'HC-2026-1027',
      note: 'Ca quyết toán, được đánh giá 4★',
      createdAt: '2026-10-27T16:45:00.000Z',
    },
    {
      id: 'tsh-3',
      delta: -20,
      reason: 'CANCEL_WITHIN_12H',
      bookingCode: 'HC-2026-1031',
      note: 'Hủy ca gấp trong 12 giờ — đồng thời trừ ký quỹ',
      createdAt: '2026-10-25T08:15:00.000Z',
    },
    {
      id: 'tsh-4',
      delta: -5,
      reason: 'CANCEL_OVER_12H',
      bookingCode: 'HC-2026-1015',
      note: 'Hủy ca trước giờ hẹn trên 12 giờ',
      createdAt: '2026-10-15T14:20:00.000Z',
    },
    {
      id: 'tsh-5',
      delta: 2,
      reason: 'GOOD_RATING_RECOVERY',
      bookingCode: 'HC-2026-1010',
      note: 'Ca quyết toán, được đánh giá 5★',
      createdAt: '2026-10-10T11:00:00.000Z',
    },
    {
      id: 'tsh-6',
      delta: 2,
      reason: 'GOOD_RATING_RECOVERY',
      bookingCode: 'HC-2026-1004',
      note: 'Ca quyết toán, được đánh giá 5★',
      createdAt: '2026-10-05T09:30:00.000Z',
    },
  ],
  receivedReviews: [
    {
      id: 'rev-1',
      bookingCode: 'HC-2026-1039',
      customerName: 'Anh Nguyễn Văn An',
      rating: 5,
      comment:
        'Chị Mai thay băng rất nhẹ nhàng, đến đúng giờ, còn hướng dẫn gia đình cách theo dõi vết mổ. Rất yên tâm.',
      isVisible: true,
      createdAt: '2026-10-29T10:30:00.000Z',
    },
    {
      id: 'rev-2',
      bookingCode: 'HC-2026-1042',
      customerName: 'Gia đình bà Hoa',
      rating: 5,
      comment: 'Đánh giá đang ẩn chờ hai bên cùng đánh giá',
      isVisible: false,
      createdAt: '2026-11-12T14:20:00.000Z',
    },
    {
      id: 'rev-3',
      bookingCode: 'HC-2026-1027',
      customerName: 'Cô Phạm Thị Thu',
      rating: 4,
      comment: 'Điều dưỡng thao tác chuyên nghiệp, chu đáo với người bệnh cao tuổi.',
      isVisible: true,
      createdAt: '2026-10-27T16:45:00.000Z',
    },
  ],
};

function loadTrustScoreState(): MockTrustScoreState {
  if (typeof window === 'undefined') return INITIAL_TRUST_SCORE_STATE;
  try {
    const raw = localStorage.getItem(TRUST_SCORE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(TRUST_SCORE_STORAGE_KEY, JSON.stringify(INITIAL_TRUST_SCORE_STATE));
      return INITIAL_TRUST_SCORE_STATE;
    }
    return JSON.parse(raw) as MockTrustScoreState;
  } catch {
    return INITIAL_TRUST_SCORE_STATE;
  }
}

export function saveTrustScoreState(state: MockTrustScoreState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRUST_SCORE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  syncTrustScoreSuspension(state.score);
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockGetTrustScore(): Promise<TrustScoreDto> {
  await delay(180);
  const state = loadTrustScoreState();
  syncTrustScoreSuspension(state.score);
  return {
    score: state.score,
    ratingAvg: state.ratingAvg,
    ratingCount: state.ratingCount,
    ratingDistribution: state.ratingDistribution,
    history: state.history,
  };
}

export async function mockGetReceivedReviews(): Promise<ReceivedReviewDto[]> {
  await delay(180);
  const state = loadTrustScoreState();
  return state.receivedReviews;
}

export function mockSetScoreForTesting(score: number): void {
  const state = loadTrustScoreState();
  state.score = score;
  saveTrustScoreState(state);
}

export function mockAddPositiveRatingRecovery(bookingCode?: string, note?: string): void {
  const state = loadTrustScoreState();
  if (state.score >= 100) return;

  const newScore = Math.min(100, state.score + 2);
  state.score = newScore;
  const newItem = {
    id: `tsh-${Date.now()}`,
    delta: 2,
    reason: 'GOOD_RATING_RECOVERY' as const,
    bookingCode: bookingCode || 'HC-2026-MOCK',
    note: note || 'Ca quyết toán, được đánh giá tốt (≥ 4★)',
    createdAt: new Date().toISOString(),
  };
  state.history = [newItem, ...state.history];
  saveTrustScoreState(state);
}

export function mockResetTrustScore(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRUST_SCORE_STORAGE_KEY, JSON.stringify(INITIAL_TRUST_SCORE_STATE));
  syncTrustScoreSuspension(INITIAL_TRUST_SCORE_STATE.score);
}
