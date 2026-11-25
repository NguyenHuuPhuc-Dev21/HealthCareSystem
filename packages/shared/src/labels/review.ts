export const REVIEW_COMMENT_MAX_LENGTH = 500;
export const REVIEW_BLIND_HOLD_DAYS = 7;
export const REVIEW_LOW_RATING_THRESHOLD = 2;

export const REVIEW_QUICK_TAGS: readonly string[] = [
  'Hợp tác tốt',
  'Thông tin bệnh nhân đúng',
  'Môi trường sạch sẽ',
  'Thanh toán đúng hạn',
  'Thân thiện, tôn trọng',
  'Người nhà theo sát dặn dò',
];

export const STAR_RATING_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Rất không hài lòng',
  2: 'Không hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Rất hài lòng',
};

export const REVIEW_BLIND_SUCCESS_MESSAGE = `Đánh giá sẽ hiện khi khách cũng đánh giá hoặc sau ${REVIEW_BLIND_HOLD_DAYS} ngày`;

export const REVIEW_LOW_RATING_HINT =
  'Nếu có sự cố, hãy mở khiếu nại để bộ phận hỗ trợ xử lý và bảo vệ quyền lợi của bạn.';

export const REVIEW_ERROR_MESSAGES: Record<string, string> = {
  REVIEW_ALREADY_SUBMITTED: 'Bạn đã gửi đánh giá cho ca trực này rồi.',
  REVIEW_WINDOW_CLOSED: `Thời hạn đánh giá cho ca này đã kết thúc (quá ${REVIEW_BLIND_HOLD_DAYS} ngày kể từ khi hoàn tất).`,
};
