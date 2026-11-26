import {
  NotificationPriority,
  type GetNotificationsQuery,
  type NotificationDto,
  type NotificationsListResponse,
} from '@healthcare-system/shared';
import { NOTIFICATION_CONFIG } from './notification-labels';

type NotificationSubscriber = (notif: NotificationDto) => void;

const subscribers = new Set<NotificationSubscriber>();
const ackedIds = new Set<string>();

function buildInitialNotifications(): NotificationDto[] {
  const now = Date.now();
  return [
    {
      id: 'notif-1',
      type: 'COMMISSION_DUE',
      priority: NotificationPriority.HIGH,
      title: 'Cần nộp hoa hồng ca tiền mặt 15%',
      body: 'Ca trực BK-20261102-001 đã hoàn tất thu tiền mặt 500.000đ. Hoa hồng cần nộp là 75.000đ qua VietQR.',
      data: { commissionId: 'comm-1', bookingId: 'bk-cash-1057' },
      readAt: null,
      createdAt: new Date(now - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-2',
      type: 'DISPUTE_OPENED',
      priority: NotificationPriority.HIGH,
      title: 'Khách hàng mở khiếu nại ca trực',
      body: 'Khiếu nại DSP-20261102-001 cần gửi giải trình trong vòng 24 giờ.',
      data: { disputeId: 'disp-1', bookingId: 'job-1' },
      readAt: null,
      createdAt: new Date(now - 25 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-3',
      type: 'NEW_MESSAGE',
      priority: NotificationPriority.NORMAL,
      title: 'Tin nhắn mới từ người nhà người bệnh',
      body: 'Anh Tuấn: "Gia đình đã chuẩn bị sẵn hồ sơ bệnh án và y lệnh gốc tại bàn rồi nhé."',
      data: { bookingId: 'job-1', conversationId: 'conv-job-1' },
      readAt: null,
      createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-4',
      type: 'DIRECT_INVITE',
      priority: NotificationPriority.NORMAL,
      title: 'Khách hàng quen chỉ định nhận ca trực',
      body: 'Gia đình ông Trần Văn Nam gửi lời mời bạn nhận ca 08:00 sáng mai.',
      data: { bookingId: 'job-2', bookingCode: 'BK-20261102-002' },
      readAt: null,
      createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-5',
      type: 'DEPOSIT_WITHHELD',
      priority: NotificationPriority.HIGH,
      title: 'Thông báo giữ lại ký quỹ (ADR-0004)',
      body: 'Hệ thống giữ lại 30% thù lao ca chuyển khoản để bổ sung số dư ký quỹ tối thiểu 300.000đ.',
      data: {},
      readAt: null,
      createdAt: new Date(now - 4 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-6',
      type: 'DEPOSIT_PENALTY',
      priority: NotificationPriority.HIGH,
      title: 'Khấu trừ phạt từ quỹ ký quỹ (ADR-0004)',
      body: 'Khoản phạt 50.000đ đã được trừ do hủy ca muộn. Bạn có 3 ngày để khiếu nại.',
      data: { transactionId: 'tx-penalty-1' },
      readAt: new Date(now - 26 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 28 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-7',
      type: 'PENALTY_REVERSED',
      priority: NotificationPriority.NORMAL,
      title: 'Hoàn lại tiền ký quỹ sau kháng cáo (ADR-0004)',
      body: 'Kháng cáo của bạn được chấp thuận. Khoản phạt đã được hoàn về số dư ký quỹ.',
      data: { transactionId: 'tx-penalty-1' },
      readAt: new Date(now - 30 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 32 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-8',
      type: 'DEPOSIT_REFUND_STATUS',
      priority: NotificationPriority.NORMAL,
      title: 'Cập nhật hoàn tiền ký quỹ khi đóng tài khoản',
      body: 'Yêu cầu hoàn ký quỹ đang trong thời gian chờ 7 ngày không khiếu nại.',
      data: {},
      readAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 50 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-9',
      type: 'GPHN_EXPIRING',
      priority: NotificationPriority.NORMAL,
      title: 'Giấy phép hành nghề sắp hết hạn',
      body: 'GPHN của bạn còn 25 ngày hiệu lực. Vui lòng cập nhật để tránh gián đoạn nhận ca cấp 2.',
      data: {},
      readAt: new Date(now - 52 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 54 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-10',
      type: 'REVIEW_RECEIVED',
      priority: NotificationPriority.NORMAL,
      title: 'Bạn nhận được đánh giá 5 sao mới',
      body: 'Gia đình bà Mai đã gửi đánh giá tích cực cho ca trực vừa hoàn thành.',
      data: { bookingId: 'job-1' },
      readAt: new Date(now - 70 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 72 * 3600 * 1000).toISOString(),
    },
    {
      id: 'notif-11',
      type: 'SETTLEMENT_DONE',
      priority: NotificationPriority.NORMAL,
      title: 'Quyết toán thù lao thành công',
      body: '+425.000đ đã được chuyển vào số dư khả dụng của bạn.',
      data: { bookingId: 'job-completed-1042' },
      readAt: new Date(now - 90 * 3600 * 1000).toISOString(),
      createdAt: new Date(now - 96 * 3600 * 1000).toISOString(),
    },
  ];
}

let notificationStore: NotificationDto[] = buildInitialNotifications();

export async function mockGetNotifications(
  query?: GetNotificationsQuery
): Promise<NotificationsListResponse> {
  await new Promise((r) => setTimeout(r, NOTIFICATION_CONFIG.MOCK_DELAY_MS));

  let filtered = [...notificationStore];
  if (query?.unreadOnly) {
    filtered = filtered.filter((n) => !n.readAt);
  }

  const limit = query?.limit ?? NOTIFICATION_CONFIG.PAGE_SIZE;
  let startIndex = 0;
  if (query?.cursor) {
    const idx = filtered.findIndex((n) => n.id === query.cursor);
    if (idx !== -1) startIndex = idx + 1;
  }

  const items = filtered.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < filtered.length;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;
  const totalUnread = notificationStore.filter((n) => !n.readAt).length;

  return {
    items,
    nextCursor,
    totalUnread,
  };
}

export async function mockMarkRead(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 30));
  const nowIso = new Date().toISOString();
  notificationStore = notificationStore.map((n) =>
    n.id === id && !n.readAt ? { ...n, readAt: nowIso } : n
  );
  ackedIds.add(id);
}

export async function mockMarkAllRead(): Promise<void> {
  await new Promise((r) => setTimeout(r, 40));
  const nowIso = new Date().toISOString();
  notificationStore = notificationStore.map((n) => {
    ackedIds.add(n.id);
    return n.readAt ? n : { ...n, readAt: nowIso };
  });
}

export async function mockAckNotification(id: string): Promise<{ success: boolean }> {
  ackedIds.add(id);
  return { success: true };
}

export function getMockAckedNotificationIds(): string[] {
  return Array.from(ackedIds);
}

export function mockPushNotification(notif: NotificationDto): void {
  notificationStore = [notif, ...notificationStore];
  subscribers.forEach((cb) => {
    try {
      cb(notif);
    } catch {
      // Ignore subscriber error
    }
  });
}

export function subscribeToMockNotifications(
  onNew: (notif: NotificationDto) => void
): () => void {
  subscribers.add(onNew);
  return () => {
    subscribers.delete(onNew);
  };
}

export function resetNotificationsMockState(): void {
  notificationStore = buildInitialNotifications();
  subscribers.clear();
  ackedIds.clear();
}
