import { NotificationPriority } from '@healthcare-system/shared';
import type {
  GetNotificationsQuery,
  NotificationDto,
  NotificationsListResponse,
} from '@healthcare-system/shared';

const STORAGE_KEY = 'carenest_mock_nurse_notifications';

type NotificationSubscriber = (notif: NotificationDto) => void;
const subscribers: Set<NotificationSubscriber> = new Set();

const INITIAL_NOTIFICATIONS: NotificationDto[] = [
  {
    id: 'notif-1',
    type: 'RADAR_URGENT',
    priority: NotificationPriority.HIGH,
    title: 'Radar khẩn cấp: Cần điều dưỡng gấp trong 45 phút',
    body: 'Ca chăm sóc vết mổ sau sinh tại Quận 7 cần điều dưỡng nhận ngay. Thù lao ca gấp +20%.',
    data: { bookingId: 'job-1', bookingCode: 'BK-20261102-001' },
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 phút trước
  },
  {
    id: 'notif-2',
    type: 'DISPUTE_OPENED',
    priority: NotificationPriority.HIGH,
    title: 'Khách hàng mở khiếu nại ca trực',
    body: 'Khiếu nại DSP-20261102-001 (Đến muộn > 15 phút). Vui lòng gửi biên bản giải trình trước 18:00.',
    data: { disputeId: 'DSP-20261102-001', bookingId: 'job-1' },
    readAt: null,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-3',
    type: 'NEW_MESSAGE',
    priority: NotificationPriority.NORMAL,
    title: 'Tin nhắn mới từ người nhà người bệnh',
    body: 'Bà Mai: "Gia đình đã chuẩn bị sẵn hồ sơ bệnh án và y lệnh gốc của bác sĩ rồi nhé cô."',
    data: { bookingId: 'job-1', conversationId: 'conv-job-1' },
    readAt: null,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-4',
    type: 'COMMISSION_DUE',
    priority: NotificationPriority.NORMAL,
    title: 'Cần nộp hoa hồng ca tiền mặt 15%',
    body: 'Ca trực BK-20261102-001 đã hoàn tất thu tiền mặt 500.000đ. Hoa hồng cần nộp là 75.000đ qua VietQR.',
    data: { commissionId: 'comm-1', bookingId: 'job-1' },
    readAt: null,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-5',
    type: 'DIRECT_INVITE',
    priority: NotificationPriority.NORMAL,
    title: 'Khách hàng quen chỉ định nhận ca trực',
    body: 'Khách hàng Trần Văn Nam gửi lời mời bạn thực hiện ca trực vào 08:00 sáng mai.',
    data: { bookingId: 'job-2', bookingCode: 'BK-20261102-002' },
    readAt: null,
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-6',
    type: 'SHIFT_REMINDER',
    priority: NotificationPriority.NORMAL,
    title: 'Nhắc nhở: Ca trực sắp bắt đầu sau 60 phút',
    body: 'Ca thay băng vết loét cho cụ Mai tại P. Tân Phong, Q.7 bắt đầu lúc 14:00. Hãy di chuyển sớm để nhận định 30 phút.',
    data: { bookingId: 'job-1' },
    readAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-7',
    type: 'DEPOSIT_WITHHELD',
    priority: NotificationPriority.HIGH,
    title: 'Thông báo giữ lại ký quỹ (ADR-0004)',
    body: 'Hệ thống tạm giữ 500.000đ tiền ký quỹ để phục vụ đối soát trong thời gian xử lý khiếu nại DSP-20261102-001.',
    data: { disputeId: 'DSP-20261102-001' },
    readAt: null,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-8',
    type: 'DEPOSIT_PENALTY',
    priority: NotificationPriority.HIGH,
    title: 'Khấu trừ tiền phạt vi phạm từ quỹ ký quỹ (ADR-0004)',
    body: 'Khoản khấu trừ 200.000đ đã được áp dụng do lỗi hủy ca sát giờ theo quy định. Bạn có 48h để khiếu nại.',
    data: { disputeId: 'DSP-20261102-002' },
    readAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-9',
    type: 'PENALTY_REVERSED',
    priority: NotificationPriority.NORMAL,
    title: 'Hoàn lại tiền ký quỹ sau kháng cáo (ADR-0004)',
    body: 'Kháng cáo của bạn đã được Hội đồng chuyên môn phê duyệt. Khoản phạt 200.000đ đã được hoàn lại vào số dư ký quỹ.',
    data: {},
    readAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-10',
    type: 'DEPOSIT_REFUND_STATUS',
    priority: NotificationPriority.NORMAL,
    title: 'Cập nhật trạng thái hoàn tiền ký quỹ (ADR-0004)',
    body: 'Yêu cầu hoàn ký quỹ khi đóng tài khoản đã được xác nhận. Giai đoạn ân hạn 30 ngày đang được tính.',
    data: {},
    readAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-11',
    type: 'SETTLEMENT_DONE',
    priority: NotificationPriority.NORMAL,
    title: 'Quyết toán thù lao ca trực thành công',
    body: '+425.000đ từ ca trực BK-20261102-001 đã được ghi nhận vào số dư ví khả dụng của bạn.',
    data: { bookingId: 'job-1' },
    readAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-12',
    type: 'REVIEW_RECEIVED',
    priority: NotificationPriority.NORMAL,
    title: 'Khách hàng gửi đánh giá 5 sao cho bạn',
    body: 'Gia đình bà Mai: "Điều dưỡng thao tác nhẹ nhàng, xử lý vết loét rất sạch sẽ và hướng dẫn gia đình tận tình."',
    data: { bookingId: 'job-1' },
    readAt: new Date(Date.now() - 35 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
  },
  {
    id: 'notif-13',
    type: 'GPHN_EXPIRING',
    priority: NotificationPriority.HIGH,
    title: 'Nhắc hạn chứng chỉ: GPHN sắp hết hạn trong 30 ngày',
    body: 'Giấy phép hành nghề số 012345/BYT của bạn sẽ hết hạn vào 15/12/2026. Hãy cập nhật hồ sơ để duy trì quyền nhận ca.',
    data: {},
    readAt: null,
    createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString(),
  },
];

function getStoredNotifications(): NotificationDto[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  setStoredNotifications(INITIAL_NOTIFICATIONS);
  return INITIAL_NOTIFICATIONS;
}

function setStoredNotifications(items: NotificationDto[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export async function mockGetNotifications(
  query?: GetNotificationsQuery
): Promise<NotificationsListResponse> {
  await new Promise((r) => setTimeout(r, 120));

  let items = getStoredNotifications();

  if (query?.unreadOnly) {
    items = items.filter((n) => !n.readAt);
  }

  const totalUnread = items.filter((n) => !n.readAt).length;

  return {
    items,
    nextCursor: null,
    totalUnread,
  };
}

export async function mockMarkRead(id: string): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 60));
  const items = getStoredNotifications();
  const target = items.find((n) => n.id === id);
  if (target && !target.readAt) {
    target.readAt = new Date().toISOString();
    setStoredNotifications(items);
  }
  return true;
}

export async function mockMarkAllRead(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 80));
  const items = getStoredNotifications();
  const now = new Date().toISOString();
  items.forEach((n) => {
    if (!n.readAt) n.readAt = now;
  });
  setStoredNotifications(items);
  return true;
}

export function subscribeToMockNotifications(
  callback: (notif: NotificationDto) => void
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Đẩy một thông báo giả lập mới vào hệ thống (phục vụ test thủ công & kịch bản thông báo HIGH)
 */
export function mockPushNotification(notif: NotificationDto): void {
  const items = getStoredNotifications();
  items.unshift(notif);
  setStoredNotifications(items);

  subscribers.forEach((cb) => {
    try {
      cb(notif);
    } catch {
      // ignore
    }
  });
}
