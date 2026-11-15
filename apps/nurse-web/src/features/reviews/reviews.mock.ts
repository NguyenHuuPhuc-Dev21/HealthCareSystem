import type {
  CreateReviewInput,
  PendingReviewDto,
  SentReviewDto,
} from '@healthcare-system/shared';

const STORAGE_PENDING_KEY = 'carenest_mock_pending_reviews_v1';
const STORAGE_SENT_KEY = 'carenest_mock_sent_reviews_v1';

const INITIAL_PENDING_REVIEWS: PendingReviewDto[] = [
  {
    bookingId: 'job-1',
    bookingCode: 'BK-20261102-001',
    customerName: 'Anh Nguyễn Minh Tuấn',
    completedAt: '2026-11-13T10:30:00Z',
    expiresAt: '2026-11-20T10:30:00Z',
  },
  {
    bookingId: 'job-3',
    bookingCode: 'BK-20261105-004',
    customerName: 'Chị Lê Hoàng Yến',
    completedAt: '2026-11-14T16:00:00Z',
    expiresAt: '2026-11-21T16:00:00Z',
  },
];

const INITIAL_SENT_REVIEWS: SentReviewDto[] = [
  {
    id: 'rev-sent-1',
    bookingCode: 'BK-20261028-011',
    customerName: 'Bác sĩ Vũ Hoàng Hải',
    rating: 5,
    comment:
      'Gia đình hỗ trợ rất chu đáo, chuẩn bị sẵn vật tư y tế và tạo điều kiện tối đa cho điều dưỡng thao tác.',
    tags: ['Hợp tác tốt', 'Thông tin đúng', 'Môi trường sạch sẽ'],
    isVisible: true,
    createdAt: '2026-10-28T18:15:00Z',
  },
  {
    id: 'rev-sent-2',
    bookingCode: 'BK-20261101-019',
    customerName: 'Chị Phạm Thu Trang',
    rating: 4,
    comment: 'Gia đình niềm nở, hướng dẫn chi tiết vị trí phòng người bệnh.',
    tags: ['Hợp tác tốt', 'Thanh toán đúng hạn'],
    isVisible: true,
    createdAt: '2026-11-01T12:45:00Z',
  },
  {
    id: 'rev-sent-3',
    bookingCode: 'BK-20261112-033',
    customerName: 'Anh Đỗ Quang Vinh',
    rating: 5,
    comment: 'Người nhà phối hợp nhịp nhàng, chăm sóc người bệnh chu đáo theo hướng dẫn.',
    tags: ['Hợp tác tốt', 'Thông tin đúng'],
    isVisible: false, // Blind review: đang ẩn chờ khách hàng đánh giá hoặc đủ 7 ngày
    createdAt: '2026-11-12T09:20:00Z',
  },
];

function getPendingStorage(): PendingReviewDto[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_PENDING_KEY);
    return raw ? JSON.parse(raw) : INITIAL_PENDING_REVIEWS;
  } catch {
    return INITIAL_PENDING_REVIEWS;
  }
}

function setPendingStorage(list: PendingReviewDto[]): void {
  try {
    sessionStorage.setItem(STORAGE_PENDING_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function getSentStorage(): SentReviewDto[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_SENT_KEY);
    return raw ? JSON.parse(raw) : INITIAL_SENT_REVIEWS;
  } catch {
    return INITIAL_SENT_REVIEWS;
  }
}

function setSentStorage(list: SentReviewDto[]): void {
  try {
    sessionStorage.setItem(STORAGE_SENT_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export async function mockGetPendingReviews(): Promise<PendingReviewDto[]> {
  await new Promise((r) => setTimeout(r, 150));
  return getPendingStorage();
}

export async function mockGetSentReviews(): Promise<SentReviewDto[]> {
  await new Promise((r) => setTimeout(r, 150));
  return getSentStorage();
}

export async function mockSubmitCustomerRating(
  bookingId: string,
  input: CreateReviewInput
): Promise<{ review_id: string }> {
  await new Promise((r) => setTimeout(r, 200));

  if (!input.rating || input.rating < 1 || input.rating > 5) {
    const err: any = new Error('Số sao đánh giá phải từ 1 đến 5');
    err.code = 'INVALID_RATING';
    throw err;
  }

  if (input.comment && input.comment.length > 500) {
    const err: any = new Error('Nhận xét không được vượt quá 500 ký tự');
    err.code = 'COMMENT_TOO_LONG';
    throw err;
  }

  const sentList = getSentStorage();
  const pendingList = getPendingStorage();

  // Find if pending
  const pendingItem = pendingList.find((p) => p.bookingId === bookingId);
  const bookingCode = pendingItem?.bookingCode || `BK-${bookingId}`;
  const customerName = pendingItem?.customerName || 'Khách hàng';

  // Check if already submitted
  if (sentList.some((s) => s.bookingCode === bookingCode)) {
    const err: any = new Error('Bạn đã gửi đánh giá cho ca trực này rồi.');
    err.code = 'REVIEW_ALREADY_SUBMITTED';
    throw err;
  }

  const newReviewId = `rev-sent-${Date.now()}`;
  const newSent: SentReviewDto = {
    id: newReviewId,
    bookingCode,
    customerName,
    rating: input.rating,
    comment: input.comment?.trim() || undefined,
    tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
    isVisible: false, // Ban đầu luôn là ẩn theo FR-RATE-01 (Blind Review)
    createdAt: new Date().toISOString(),
  };

  // Update storage
  setSentStorage([newSent, ...sentList]);
  setPendingStorage(pendingList.filter((p) => p.bookingId !== bookingId));

  return { review_id: newReviewId };
}

export function resetMockReviews(): void {
  try {
    sessionStorage.removeItem(STORAGE_PENDING_KEY);
    sessionStorage.removeItem(STORAGE_SENT_KEY);
  } catch {
    // ignore
  }
}
