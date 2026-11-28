import {
  REVIEW_COMMENT_MAX_LENGTH,
  type CreateReviewInput,
  type PendingReviewDto,
  type SentReviewDto,
} from '@healthcare-system/shared';

const INITIAL_PENDING_REVIEWS: PendingReviewDto[] = [
  {
    bookingId: 'shift-completed-1',
    bookingCode: 'HC-2026-1057',
    customerName: 'Bà Nguyễn Thị Hoa',
    completedAt: '2026-11-24T17:00:00+07:00',
    expiresAt: '2026-12-01T17:00:00+07:00',
  },
  {
    bookingId: 'job-1',
    bookingCode: 'BK-20261102-001',
    customerName: 'Anh Nguyễn Minh Tuấn',
    completedAt: '2026-11-23T10:30:00+07:00',
    expiresAt: '2026-11-30T10:30:00+07:00',
  },
];

const INITIAL_SENT_REVIEWS: SentReviewDto[] = [
  {
    id: 'rev-sent-1',
    bookingCode: 'HC-2026-1048',
    customerName: 'Ông Trần Minh Tuấn',
    rating: 5,
    comment: 'Gia đình hỗ trợ rất chu đáo, chuẩn bị sẵn vật tư y tế.',
    tags: ['Hợp tác tốt', 'Thông tin bệnh nhân đúng', 'Môi trường sạch sẽ'],
    isVisible: true,
    createdAt: '2026-11-23T18:30:00+07:00',
  },
  {
    id: 'rev-sent-2',
    bookingCode: 'HC-2026-1042',
    customerName: 'Chị Lê Thu Hương',
    rating: 4,
    comment: 'Gia đình niềm nở, phối hợp tốt trong quá trình theo dõi sinh hiệu.',
    tags: ['Hợp tác tốt', 'Thanh toán đúng hạn'],
    isVisible: true,
    createdAt: '2026-11-20T16:30:00+07:00',
  },
  {
    id: 'rev-sent-3',
    bookingCode: 'HC-2026-1051',
    customerName: 'Anh Đỗ Quang Vinh',
    rating: 5,
    comment: 'Người nhà phối hợp nhịp nhàng theo hướng dẫn.',
    tags: ['Hợp tác tốt'],
    isVisible: false,
    createdAt: '2026-11-24T09:20:00+07:00',
  },
];

let pendingReviewsStore: PendingReviewDto[] = INITIAL_PENDING_REVIEWS.map((p) => ({ ...p }));
let sentReviewsStore: SentReviewDto[] = INITIAL_SENT_REVIEWS.map((s) => ({ ...s }));
let submittedBookingIds = new Set<string>();
let forcedErrorCode: 'REVIEW_ALREADY_SUBMITTED' | 'REVIEW_WINDOW_CLOSED' | null = null;

export function resetReviewsMockState(): void {
  pendingReviewsStore = INITIAL_PENDING_REVIEWS.map((p) => ({ ...p }));
  sentReviewsStore = INITIAL_SENT_REVIEWS.map((s) => ({ ...s }));
  submittedBookingIds = new Set<string>();
  forcedErrorCode = null;
}

export function mockSetReviewErrorForTesting(
  code: 'REVIEW_ALREADY_SUBMITTED' | 'REVIEW_WINDOW_CLOSED' | null
): void {
  forcedErrorCode = code;
}

export async function mockGetPendingReviews(): Promise<PendingReviewDto[]> {
  return pendingReviewsStore.map((item) => ({ ...item }));
}

export async function mockGetSentReviews(): Promise<SentReviewDto[]> {
  return sentReviewsStore.map((item) => ({ ...item }));
}

export async function mockSubmitCustomerRating(
  bookingId: string,
  input: CreateReviewInput
): Promise<{ review_id: string }> {
  if (forcedErrorCode === 'REVIEW_WINDOW_CLOSED') {
    const err: any = new Error('Thời hạn đánh giá đã kết thúc.');
    err.code = 'REVIEW_WINDOW_CLOSED';
    throw err;
  }

  if (forcedErrorCode === 'REVIEW_ALREADY_SUBMITTED') {
    const err: any = new Error('Bạn đã gửi đánh giá cho ca trực này rồi.');
    err.code = 'REVIEW_ALREADY_SUBMITTED';
    throw err;
  }

  if (!input.rating || input.rating < 1 || input.rating > 5) {
    const err: any = new Error('Số sao đánh giá phải từ 1 đến 5.');
    err.code = 'INVALID_RATING';
    throw err;
  }

  if (input.comment && input.comment.length > REVIEW_COMMENT_MAX_LENGTH) {
    const err: any = new Error(
      `Nhận xét không được vượt quá ${REVIEW_COMMENT_MAX_LENGTH} ký tự.`
    );
    err.code = 'COMMENT_TOO_LONG';
    throw err;
  }

  const pendingItem = pendingReviewsStore.find((p) => p.bookingId === bookingId);
  const bookingCode = pendingItem?.bookingCode || `BK-${bookingId}`;
  const customerName = pendingItem?.customerName || 'Khách hàng CareNest';

  if (
    submittedBookingIds.has(bookingId) ||
    sentReviewsStore.some((s) => s.bookingCode === bookingCode)
  ) {
    const err: any = new Error('Bạn đã gửi đánh giá cho ca trực này rồi.');
    err.code = 'REVIEW_ALREADY_SUBMITTED';
    throw err;
  }

  const reviewId = `rev-sent-${Date.now()}`;
  const newSent: SentReviewDto = {
    id: reviewId,
    bookingCode,
    customerName,
    rating: input.rating,
    comment: input.comment?.trim() || undefined,
    tags: input.tags && input.tags.length > 0 ? [...input.tags] : undefined,
    isVisible: false,
    createdAt: new Date().toISOString(),
  };

  submittedBookingIds.add(bookingId);
  sentReviewsStore = [newSent, ...sentReviewsStore];
  pendingReviewsStore = pendingReviewsStore.filter((p) => p.bookingId !== bookingId);

  return { review_id: reviewId };
}
