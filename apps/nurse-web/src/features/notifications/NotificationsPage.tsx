import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Briefcase,
  Calendar,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  ShieldAlert,
  Star,
  Wallet,
  Zap,
} from 'lucide-react';
import { NotificationPriority } from '@healthcare-system/shared';
import type { NotificationDto, NurseNotificationType } from '@healthcare-system/shared';
import { useNotifications } from './NotificationContext';
import {
  getNotificationCategory,
  getNotificationRoute,
} from './notification-routes';
import { pushTestNotification } from './notifications.api';

function formatRelativeTime(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return new Date(dateIso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderNotificationIcon(type: NurseNotificationType) {
  switch (type) {
    case 'RADAR_URGENT':
      return <Zap size={18} className="notif-type-icon notif-type-icon--radar" aria-hidden="true" />;
    case 'DISPUTE_OPENED':
    case 'DISPUTE_RESOLVED':
      return <ShieldAlert size={18} className="notif-type-icon notif-type-icon--dispute" aria-hidden="true" />;
    case 'COMMISSION_DUE':
    case 'COMMISSION_OVERDUE':
      return <DollarSign size={18} className="notif-type-icon notif-type-icon--commission" aria-hidden="true" />;
    case 'DEPOSIT_LOW':
    case 'DEPOSIT_WITHHELD':
    case 'DEPOSIT_PENALTY':
    case 'PENALTY_REVERSED':
    case 'DEPOSIT_REFUND_STATUS':
      return <Wallet size={18} className="notif-type-icon notif-type-icon--deposit" aria-hidden="true" />;
    case 'NEW_JOB':
    case 'DIRECT_INVITE':
      return <Briefcase size={18} className="notif-type-icon notif-type-icon--job" aria-hidden="true" />;
    case 'BOOKING_CANCELLED':
      return <AlertCircle size={18} className="notif-type-icon notif-type-icon--cancel" aria-hidden="true" />;
    case 'SHIFT_REMINDER':
    case 'EXTENSION_REQUEST':
      return <Calendar size={18} className="notif-type-icon notif-type-icon--shift" aria-hidden="true" />;
    case 'NEW_MESSAGE':
      return <MessageSquare size={18} className="notif-type-icon notif-type-icon--chat" aria-hidden="true" />;
    case 'REVIEW_RECEIVED':
      return <Star size={18} className="notif-type-icon notif-type-icon--review" aria-hidden="true" />;
    case 'CREDENTIAL_REVIEWED':
    case 'GPHN_EXPIRING':
      return <FileText size={18} className="notif-type-icon notif-type-icon--credential" aria-hidden="true" />;
    default:
      return <Bell size={18} className="notif-type-icon notif-type-icon--general" aria-hidden="true" />;
  }
}

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications();
  const navigate = useNavigate();

  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterMode === 'unread' && n.readAt) return false;
      if (selectedCategory !== 'ALL') {
        const cat = getNotificationCategory(n.type);
        if (cat.label !== selectedCategory) return false;
      }
      return true;
    });
  }, [notifications, filterMode, selectedCategory]);

  const handleItemClick = (notif: NotificationDto) => {
    if (!notif.readAt) {
      markAsRead(notif.id);
    }
    const route = getNotificationRoute(notif);
    navigate(route);
  };

  const handleTriggerTestHighAlert = () => {
    pushTestNotification({
      id: `test-high-${Date.now()}`,
      type: 'RADAR_URGENT',
      priority: NotificationPriority.HIGH,
      title: 'Radar khẩn cấp: Khách đặt ca trực gấp trong 30 phút!',
      body: 'Người bệnh cần hỗ trợ tiêm kháng sinh tại Quận 1. Đơn giá tăng +25%.',
      data: { bookingId: 'job-1' },
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="notifications-page">
      {/* 1. Header & Quick Actions */}
      <div className="notifications-header">
        <div>
          <h1 className="notifications-title">Trung tâm thông báo</h1>
          <p className="notifications-subtitle">
            Cập nhật tức thời về ca trực, điều phối, hoa hồng nộp chậm, biến động ký quỹ (ADR-0004) và giải quyết khiếu nại.
          </p>
        </div>

        <div className="notifications-header__actions">
          {import.meta.env.DEV && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleTriggerTestHighAlert}
              title="Mô phỏng server gửi thông báo khẩn cấp HIGH để kiểm tra âm thanh & popup toast"
            >
              <Zap size={14} style={{ color: 'var(--alert-crimson)' }} aria-hidden="true" />
              <span>Thử thông báo khẩn (HIGH)</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            title="Đánh dấu tất cả thông báo là đã đọc"
          >
            <CheckCheck size={16} aria-hidden="true" />
            <span>Đánh dấu đã đọc tất cả</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Navigation Bar */}
      <div className="notifications-filter-bar">
        <div className="notifications-tabs" role="tablist" aria-label="Bộ lọc trạng thái đọc">
          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'all'}
            className={`notif-tab ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            <span>Tất cả</span>
            <span className="notif-tab__badge">{notifications.length}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={filterMode === 'unread'}
            className={`notif-tab ${filterMode === 'unread' ? 'active' : ''}`}
            onClick={() => setFilterMode('unread')}
          >
            <span>Chưa đọc</span>
            {unreadCount > 0 && <span className="notif-tab__badge notif-tab__badge--unread">{unreadCount}</span>}
          </button>
        </div>

        {/* Categories Chips */}
        <div className="notifications-categories">
          {['ALL', 'Việc mới', 'Ca trực', 'Khiếu nại', 'Hoa hồng', 'Ký quỹ', 'Ví & Rút tiền', 'Tin nhắn'].map(
            (cat) => (
              <button
                key={cat}
                type="button"
                className={`notif-cat-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'ALL' ? 'Tất cả loại' : cat}
              </button>
            )
          )}
        </div>
      </div>

      {/* 3. Notifications List */}
      <div className="notifications-list-container" role="region" aria-label="Danh sách thông báo">
        {loading ? (
          <div className="notifications-empty">
            <Clock size={28} style={{ color: 'var(--ink-muted)', marginBottom: 8 }} aria-hidden="true" />
            <div>Đang tải dữ liệu thông báo...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            {filterMode === 'unread' ? (
              <>
                <CheckCircle2 size={36} style={{ color: 'var(--teal-primary)', marginBottom: 12 }} aria-hidden="true" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Hộp thư đã được đọc hết</h3>
                <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
                  Bạn không có thông báo nào chưa đọc trong danh mục này.
                </p>
              </>
            ) : (
              <>
                <Bell size={36} style={{ color: 'var(--ink-muted)', marginBottom: 12 }} aria-hidden="true" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Chưa có thông báo nào</h3>
                <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: 14 }}>
                  Các thông báo mới về ca trực, ký quỹ và khiếu nại sẽ xuất hiện tại đây.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((n) => {
              const isUnread = !n.readAt;
              const isHigh = n.priority === NotificationPriority.HIGH;
              const cat = getNotificationCategory(n.type);

              return (
                <div
                  key={n.id}
                  className={`notif-card ${isUnread ? 'notif-card--unread' : ''} ${
                    isHigh ? 'notif-card--high' : ''
                  }`}
                  onClick={() => handleItemClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleItemClick(n);
                    }
                  }}
                  aria-label={`${n.title}. ${isUnread ? 'Chưa đọc.' : 'Đã đọc.'}`}
                >
                  <div className="notif-card__icon-wrap">{renderNotificationIcon(n.type)}</div>

                  <div className="notif-card__body">
                    <div className="notif-card__meta">
                      <div className="notif-card__badges">
                        {isHigh && (
                          <span className="notif-badge notif-badge--urgent">
                            <AlertTriangle size={11} aria-hidden="true" />
                            ƯU TIÊN CAO
                          </span>
                        )}
                        <span className={`notif-badge ${cat.tagClass}`}>{cat.label}</span>
                      </div>
                      <time className="notif-card__time" dateTime={n.createdAt}>
                        {formatRelativeTime(n.createdAt)}
                      </time>
                    </div>

                    <h2 className="notif-card__title">
                      {n.title}
                      {isUnread && <span className="notif-card__unread-dot" title="Chưa đọc" />}
                    </h2>

                    <p className="notif-card__text">{n.body}</p>
                  </div>

                  <div className="notif-card__arrow">
                    <ChevronRight size={18} aria-hidden="true" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
