export interface CreateReviewInput {
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string; // tối đa 500 ký tự
  tags?: string[]; // ví dụ: 'Hợp tác tốt', 'Thông tin bệnh nhân đúng'
}

export interface PendingReviewDto {
  bookingId: string;
  bookingCode: string;
  customerName: string;
  completedAt: string;
  expiresAt: string;
}

export interface SentReviewDto extends CreateReviewInput {
  id: string;
  bookingCode: string;
  customerName: string;
  isVisible: boolean; // false = đang ẩn theo cơ chế blind review 7 ngày
  createdAt: string;
}
