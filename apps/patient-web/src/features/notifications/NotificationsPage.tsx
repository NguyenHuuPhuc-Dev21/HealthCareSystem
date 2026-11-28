import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { Alert, Button } from '../../components';
import { PatientLayout } from '../../components/layout/PatientLayout';
import { getErrorMessage } from '../../lib/errors';
import { useAuth } from '../auth';
import { iconForNotification, routeForNotification, timeAgo } from './notification-routing';
import { useNotifications } from './NotificationProvider';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from './notifications.api';
import type { NotificationDto } from './notifications.api';

type Tab = 'all' | 'unread';
type Status = 'loading' | 'ready' | 'error';

const PAGE = 20;

/**
 * Trung tâm thông báo (FR-NOTIF-01): danh sách mới nhất trước, lọc chưa đọc, đọc từng cái hoặc đọc hết, bấm để tới đúng ca/khiếu nại/hoàn tiền.
 * Đọc thông báo cũng là xác nhận đã nhận — backend sẽ không gửi SMS dự phòng cho thông báo khẩn cùng sự kiện.
 */
export function NotificationsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, adjustUnread, refreshUnread, onNew } = useNotifications();

  const [tab, setTab] = useState<Tab>('all');
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const seq = useRef(0);

  const loadFirst = useCallback(
    async (silent = false) => {
      const id = ++seq.current;
      if (!silent) setStatus('loading');
      const res = await getNotifications({ limit: PAGE, unreadOnly: tab === 'unread' });
      if (id !== seq.current) return;
      if (!res.success) {
        if (!silent) {
          setStatus('error');
          setError(getErrorMessage(res.error, 'Chưa tải được thông báo.'));
        }
        return;
      }
      setItems(res.data.items);
      setCursor(res.data.nextCursor);
      setStatus('ready');
      setError(null);
    },
    [tab],
  );

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  // Có thông báo mới (WebSocket) hoặc số chưa đọc đổi do polling → làm mới danh sách âm thầm
  useEffect(() => onNew((n) => setItems((prev) => (tab === 'all' || !n.readAt ? [n, ...prev.filter((x) => x.id !== n.id)] : prev))), [onNew, tab]);
  const lastUnread = useRef(unreadCount);
  useEffect(() => {
    if (unreadCount > lastUnread.current) loadFirst(true);
    lastUnread.current = unreadCount;
  }, [unreadCount, loadFirst]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const res = await getNotifications({ cursor, limit: PAGE, unreadOnly: tab === 'unread' });
    setLoadingMore(false);
    if (!res.success) {
      setError(getErrorMessage(res.error));
      return;
    }
    setItems((prev) => [...prev, ...res.data.items.filter((n) => !prev.some((p) => p.id === n.id))]);
    setCursor(res.data.nextCursor);
  };

  const open = async (n: NotificationDto) => {
    if (!n.readAt) {
      // Cập nhật ngay (lạc quan), rồi báo server; lỗi thì hoàn lại.
      const at = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: at } : x)));
      adjustUnread(-1);
      const res = await markNotificationRead(n.id);
      if (!res.success) {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: null } : x)));
        refreshUnread();
      }
    }
    const to = routeForNotification(n);
    if (to) navigate(to);
  };

  const readAll = async () => {
    setBusyAll(true);
    const res = await markAllNotificationsRead();
    setBusyAll(false);
    if (!res.success) {
      setError(getErrorMessage(res.error, 'Chưa đánh dấu được. Vui lòng thử lại.'));
      return;
    }
    const at = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: at })));
    adjustUnread('zero');
    if (tab === 'unread') loadFirst(true);
  };

  return (
    <PatientLayout fullName={user?.full_name} phone={user?.phone} onSignOut={signOut}>
      <div className="page-head page-head--row">
        <div>
          <h1>Thông báo</h1>
          <p>Cập nhật về khiếu nại, tin nhắn, ca đặt và hoàn tiền của bạn.</p>
        </div>
        <Button type="button" variant="secondary" onClick={readAll} loading={busyAll} disabled={unreadCount === 0}>
          <CheckCheck size={16} style={{ marginRight: 6 }} aria-hidden="true" /> Đánh dấu tất cả đã đọc
        </Button>
      </div>

      <div className="nt-tabs" role="tablist" aria-label="Lọc thông báo">
        <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'is-on' : ''} onClick={() => setTab('all')}>Tất cả</button>
        <button type="button" role="tab" aria-selected={tab === 'unread'} className={tab === 'unread' ? 'is-on' : ''} onClick={() => setTab('unread')}>
          Chưa đọc{unreadCount > 0 && <span className="nt-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      </div>

      {error && status !== 'error' && <Alert title={error} />}
      {status === 'loading' && <div className="card step-card skeleton">Đang tải thông báo…</div>}
      {status === 'error' && <Alert title={error}><Button type="button" variant="secondary" size="sm" onClick={() => loadFirst()}>Thử lại</Button></Alert>}

      {status === 'ready' && items.length === 0 && (
        <div className="card step-card text-center">
          <b className="text-navy">{tab === 'unread' ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo nào'}</b>
          <p className="step-card__sub" style={{ marginTop: 6 }}>Thông báo mới sẽ xuất hiện ở đây ngay khi có cập nhật.</p>
        </div>
      )}

      {status === 'ready' && items.length > 0 && (
        <>
          <ul className="nt-list">
            {items.map((n) => {
              const to = routeForNotification(n);
              return (
                <li key={n.id}>
                  <button type="button" className={`card nt-item${n.readAt ? '' : ' is-unread'}${n.priority === 'HIGH' ? ' is-high' : ''}`} onClick={() => open(n)} aria-label={`${n.readAt ? '' : 'Chưa đọc. '}${n.title}`}>
                    <span className="nt-item__icon" aria-hidden="true">{iconForNotification(n)}</span>
                    <span className="nt-item__main">
                      <b>{n.title}{n.priority === 'HIGH' && <span className="chip red">Khẩn</span>}</b>
                      <span>{n.body}</span>
                      <small>{timeAgo(n.createdAt)}{to ? ' · bấm để xem' : ''}</small>
                    </span>
                    {!n.readAt && <span className="nt-item__dot" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {cursor && (
            <div className="step-card__actions" style={{ justifyContent: 'center' }}>
              <Button type="button" variant="secondary" onClick={loadMore} loading={loadingMore}>Xem thêm</Button>
            </div>
          )}
        </>
      )}
    </PatientLayout>
  );
}
