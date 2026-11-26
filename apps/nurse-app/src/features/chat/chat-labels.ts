export const CHAT_CONFIG = {
  POLL_INTERVAL_MS: 5000,
  MOCK_NETWORK_DELAY_MS: 80,
  MOCK_REPLY_DELAY_MS: 1800,
  MAX_MESSAGE_LENGTH: 2000,
  WS_HEARTBEAT_INTERVAL_MS: 30000,
  WS_MAX_RECONNECT_ATTEMPTS: 5,
  WS_RECONNECT_BASE_MS: 1000,
  WS_RECONNECT_MAX_MS: 16000,
} as const;

export const CHAT_LABELS = {
  screenTitleFallback: 'Khách hàng',
  maskedPhoneFallback: '09•• ••• 123',
  statusOpen: 'Đang mở',
  statusClosed: 'Đã đóng',
  securityNoticeTitle: 'Bảo mật CareNest:',
  securityNoticeBody:
    'Số điện thoại hai bên được che. Không chia sẻ liên hệ cá nhân hoặc giao dịch ngoài ứng dụng.',
  loadingHistory: 'Đang tải lịch sử trao đổi...',
  emptyHistory: 'Chưa có tin nhắn nào trong ca trực này.',
  errorLoadFallback: 'Không thể tải cuộc hội thoại',
  errorNetwork: 'Lỗi kết nối máy chủ',
  errorSendFallback: 'Gửi thất bại',
  errorNetworkSend: 'Lỗi mạng khi gửi',
  errorRetryFallback: 'Gửi lại thất bại',
  errorNetworkRetry: 'Lỗi mạng khi gửi lại',
  errorSendFailedLabel: 'Không gửi được tin nhắn',
  retryButton: 'Gửi lại',
  statusSending: 'Đang gửi...',
  statusSent: 'Đã gửi',
  statusRead: 'Đã đọc',
  flaggedWarning:
    'Cảnh báo: Nội dung có dấu hiệu chia sẻ liên hệ hoặc thanh toán ngoài ứng dụng.',
  composerPlaceholder: 'Nhắn tin cho khách hàng...',
  composerLockedTitle: 'Kênh nhắn tin đang khóa',
  composerLockedReason:
    'Chỉ nhắn tin được khi ca trực đã xác nhận (CONFIRMED). Hội thoại sẽ đóng sau khi ca kết thúc.',
  composerSendAccessibility: 'Gửi tin nhắn',
  offPlatformDialogTitle: 'Cảnh báo quy định CareNest',
  offPlatformDialogMessage:
    'Chia sẻ liên hệ ngoài ứng dụng vi phạm quy định, vẫn gửi?',
  offPlatformDialogCancel: 'Chỉnh sửa',
  offPlatformDialogConfirm: 'Vẫn gửi',
  chatActionButton: 'Nhắn tin',
  backAccessibility: 'Quay lại',
  pushNewMessageTitleFallback: 'Tin nhắn mới từ khách hàng',
} as const;
